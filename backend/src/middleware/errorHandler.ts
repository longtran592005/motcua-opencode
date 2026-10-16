import type { ErrorRequestHandler, RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AppError, isAppError } from '../lib/errors'
import { sendError } from '../lib/envelope'
import { logger } from '../lib/logger'

/** Đường dẫn không tồn tại — vẫn trả về khuôn lỗi thống nhất. */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `Không tìm thấy đường dẫn ${req.method} ${req.path}.`)
}

function zodDetails(err: ZodError): Record<string, unknown> {
  return {
    truongLoi: err.issues.map((i) => ({
      duongDan: i.path.join('.') || '(gốc)',
      thongDiep: i.message,
    })),
  }
}

/** Bộ chuyển lỗi trung tâm: mọi lỗi đều ra khuôn `{ success:false, error:{...} }`. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err)

  if (err instanceof ZodError) {
    sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ.', zodDetails(err))
    return
  }

  if (isAppError(err)) {
    sendError(res, err.status, err.code, err.message, err.details)
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target
      sendError(res, 422, 'VALIDATION_ERROR', 'Giá trị đã tồn tại, vui lòng kiểm tra lại.', {
        truongTrung: Array.isArray(target) ? target : target ? [String(target)] : [],
      })
      return
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.')
      return
    }
    if (err.code === 'P2003') {
      sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu tham chiếu không tồn tại.')
      return
    }
    if (err.code === 'P2010') {
      // Lỗi từ truy vấn thô (vi phạm CHECK…). Không lộ chi tiết SQL ra ngoài.
      logger.error({ reqId: req.requestId, err: err.message }, 'Lỗi truy vấn thô')
      sendError(res, 422, 'VALIDATION_ERROR', 'Dữ liệu không thỏa ràng buộc nghiệp vụ.')
      return
    }
  }

  const unknown = err as Error
  logger.error(
    { reqId: req.requestId, err: unknown?.message, stack: unknown?.stack },
    'Lỗi không mong đợi',
  )
  sendError(res, 500, 'UNKNOWN', 'Đã xảy ra lỗi khi xử lý yêu cầu.')
}

/** Bọc handler async để lỗi luôn đi tới `errorHandler`. */
export function asyncHandler<T extends RequestHandler>(handler: T): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export { AppError }
