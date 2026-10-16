import type { RequestHandler } from 'express'
import type { ZodTypeAny } from 'zod'

type Target = 'body' | 'query' | 'params'

/**
 * Express định nghĩa `req.query` bằng getter nên phải ghi đè bằng defineProperty.
 * Giá trị đã phân tích (đã ép kiểu, đã lọc trường lạ) thay thế giá trị gốc.
 */
function assign(req: import('express').Request, target: Target, value: unknown): void {
  Object.defineProperty(req, target, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

/** Kiểm tra và chuẩn hoá dữ liệu vào. Lỗi ZodError được bộ chuyển lỗi đổi thành 422. */
export function validate(schema: ZodTypeAny, target: Target = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(target === 'body' ? req.body : (req as never)[target])
    if (!result.success) return next(result.error)
    assign(req, target, result.data)
    next()
  }
}
