import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { signedDocumentDto, signedDocumentInclude } from '../documents/dto'

const tokenParam = z.object({ token: z.string().min(8).max(200) })
const soParam = z.object({ so: z.string().min(1).max(200) })
const compareBody = z.object({
  maBamNguoiDung: z.string().trim().min(8).max(128),
})
const recentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(6),
})

/**
 * Tra cứu công khai — KHÔNG cần đăng nhập.
 * MỌI phản hồi ở đây đều được CHE dữ liệu cá nhân tại máy chủ (quyết định A3):
 * chỉ trả họ tên/MSSV đã che, không có email hay số điện thoại.
 */
export const publicRouter: Router = Router()

async function findByToken(token: string) {
  const doc = await prisma.signedDocument.findFirst({
    where: { tokenXacThuc: token, deletedAt: null },
    include: signedDocumentInclude,
  })
  if (!doc) throw AppError.notFound('Không tìm thấy văn bản tương ứng với mã tra cứu.')
  return doc
}

publicRouter.get(
  '/verify/token/:token',
  validate(tokenParam, 'params'),
  asyncHandler(async (req, res) => {
    const { token } = req.params as { token: string }
    const doc = await findByToken(token)
    send(res, {
      trangThai: doc.trangThai,
      vanBan: signedDocumentDto(doc, { mask: true, includeDownloads: false }),
    })
  }),
)

publicRouter.get(
  '/verify/so-van-ban/:so',
  validate(soParam, 'params'),
  asyncHandler(async (req, res) => {
    const so = decodeURIComponent((req.params as { so: string }).so)
    const doc = await prisma.signedDocument.findFirst({
      where: { soVanBan: so, deletedAt: null },
      include: signedDocumentInclude,
    })
    if (!doc) throw AppError.notFound('Không tìm thấy văn bản với số đã nhập.')
    send(res, {
      trangThai: doc.trangThai,
      vanBan: signedDocumentDto(doc, { mask: true, includeDownloads: false }),
    })
  }),
)

publicRouter.post(
  '/verify/token/:token/compare',
  validate(tokenParam, 'params'),
  validate(compareBody),
  asyncHandler(async (req, res) => {
    const { token } = req.params as { token: string }
    const { maBamNguoiDung } = req.body as { maBamNguoiDung: string }
    const doc = await findByToken(token)
    if (doc.trangThai === 'REVOKED') {
      throw new AppError('DOCUMENT_REVOKED', 'Văn bản đã bị thu hồi nên không đối chiếu được.')
    }
    send(res, {
      trangThai: doc.trangThai,
      vanBan: signedDocumentDto(doc, { mask: true, includeDownloads: false }),
      ketQuaDoiChieu: {
        maBamNguoiDung,
        trungKhop: maBamNguoiDung.trim().toLowerCase() === doc.maBamSha256.toLowerCase(),
        luc: new Date().toISOString(),
      },
    })
  }),
)

publicRouter.get(
  '/verify/recent',
  validate(recentQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as never as { limit: number }
    const rows = await prisma.signedDocument.findMany({
      where: { deletedAt: null, trangThai: 'VALID' },
      include: signedDocumentInclude,
      orderBy: { ngayCap: 'desc' },
      take: limit,
    })
    send(res, rows.map((r) => signedDocumentDto(r, { mask: true, includeDownloads: false })))
  }),
)
