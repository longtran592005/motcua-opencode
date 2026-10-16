import type { RequestHandler, Response } from 'express'
import { AppError } from '../lib/errors'
import { prisma } from '../lib/prisma'
import { sha256 } from '../lib/crypto'
import { logger } from '../lib/logger'

export const IDEMPOTENCY_HEADER = 'idempotency-key'
/** Khóa được lưu tối đa 24 giờ (quyết định B2). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Existing =
  | { status: 'new' }
  | { status: 'conflict' }
  | { status: 'replay'; code: number; body: unknown }

/**
 * Giữ chỗ hoặc phân giải một khóa idempotency (quyết định B2):
 *  - Chưa có khóa           -> giữ chỗ (responseStatus = 0) rồi cho xử lý.
 *  - Cùng nội dung          -> chờ yêu cầu gốc xong và trả lại nguyên kết quả cũ.
 *  - Khác nội dung/đường dẫn -> DUPLICATE_ACTION (409).
 *  - Khóa đang được xử lý   -> chờ tối đa 2 giây; quá hạn -> ALREADY_PROCESSED (409).
 */
async function resolveExisting(
  userId: string,
  key: string,
  endpoint: string,
  requestHash: string,
): Promise<Existing> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const row = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    })

    if (!row) {
      try {
        await prisma.idempotencyKey.create({
          data: {
            key,
            userId,
            endpoint,
            requestHash,
            responseStatus: 0,
            responseBody: {},
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          },
        })
        return { status: 'new' }
      } catch {
        // Đua tranh: một yêu cầu khác vừa giữ chỗ — thử lại để đọc bản ghi đó.
        continue
      }
    }

    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.idempotencyKey.delete({ where: { id: row.id } }).catch(() => undefined)
      continue
    }

    if (row.endpoint !== endpoint || row.requestHash !== requestHash) {
      return { status: 'conflict' }
    }

    let snapshot = row
    for (let i = 0; i < 40 && snapshot.responseStatus === 0; i += 1) {
      await sleep(50)
      snapshot =
        (await prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId, key } },
        })) ?? snapshot
    }
    if (snapshot.responseStatus === 0) {
      throw new AppError(
        'ALREADY_PROCESSED',
        'Một yêu cầu trùng khóa đang được xử lý. Vui lòng thử lại sau ít giây.',
      )
    }
    return { status: 'replay', code: snapshot.responseStatus, body: snapshot.responseBody }
  }
  throw new AppError(
    'ALREADY_PROCESSED',
    'Không xác nhận được khóa idempotency, vui lòng thử lại.',
  )
}

/**
 * Bắt buộc `Idempotency-Key` cho mọi thao tác ghi nghiệp vụ (quyết định B2).
 * Thiếu khóa -> VALIDATION_ERROR (422).
 */
export function idempotent(): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const key = req.header(IDEMPOTENCY_HEADER)?.trim()
      if (!key) {
        throw AppError.validation('Thiếu tiêu đề Idempotency-Key cho thao tác ghi.', {
          truongThieu: [IDEMPOTENCY_HEADER],
        })
      }
      if (key.length < 8 || key.length > 200) {
        throw AppError.validation('Idempotency-Key phải dài từ 8 đến 200 ký tự.')
      }

      const user = req.user
      if (!user) throw AppError.unauthorized()

      const endpoint = `${req.method} ${req.baseUrl}${req.path}`
      const requestHash = sha256(JSON.stringify({ endpoint, body: req.body ?? null }))

      const existing = await resolveExisting(user.id, key, endpoint, requestHash)
      if (existing.status === 'conflict') {
        throw new AppError(
          'DUPLICATE_ACTION',
          'Idempotency-Key đã được dùng cho một yêu cầu khác. Hãy dùng khóa mới.',
          { daDung: true },
        )
      }
      if (existing.status === 'replay') {
        req.idempotencyReplay = true
        res.setHeader('idempotency-replayed', 'true')
        res.status(existing.code).json(existing.body)
        return
      }

      const originalJson = res.json.bind(res)
      res.json = ((body: unknown) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void prisma.idempotencyKey
            .update({
              where: { userId_key: { userId: user.id, key } },
              data: { responseStatus: res.statusCode, responseBody: body as object },
            })
            .catch((e: unknown) =>
              logger.warn(
                { reqId: req.requestId, err: String(e) },
                'Không lưu được kết quả idempotency',
              ),
            )
        } else {
          // Lỗi nghiệp vụ: nhả chỗ giữ để lần gửi sau được xử lý lại bình thường.
          void prisma.idempotencyKey
            .delete({ where: { userId_key: { userId: user.id, key } } })
            .catch(() => undefined)
        }
        return originalJson(body)
      }) as Response['json']

      next()
    })().catch(next)
  }
}

/** Dọn khóa idempotency đã hết hạn (gọi định kỳ hoặc lúc khởi động). */
export async function purgeExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
