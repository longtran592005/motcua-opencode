import type { Response } from 'express'
import type { ErrorCode } from './errors'

/** Dữ liệu phân trang chuẩn — frontend dựng lại `Paginated<T>` từ `meta`. */
export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Envelope<T> {
  success: boolean
  data: T | null
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> } | null
  meta?: PageMeta
}

/** Trả về một kết quả thành công (quyết định A1). */
export function send<T>(res: Response, data: T, status = 200, meta?: PageMeta): Response {
  const body: Envelope<T> = { success: true, data, error: null }
  if (meta) body.meta = meta
  return res.status(status).json(body)
}

/** Trả về một trang kết quả: `data` là mảng phần tử, `meta` là thông tin trang. */
export function sendPage<T>(
  res: Response,
  items: T[],
  info: { page: number; pageSize: number; total: number },
): Response {
  return send(res, items, 200, {
    page: info.page,
    pageSize: info.pageSize,
    total: info.total,
    totalPages: Math.max(1, Math.ceil(info.total / info.pageSize)),
  })
}

/** Trả về lỗi nghiệp vụ theo đúng khuôn `error: { code, message, details }`. */
export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: Envelope<never> = {
    success: false,
    data: null,
    error: details ? { code, message, details } : { code, message },
  }
  return res.status(status).json(body)
}
