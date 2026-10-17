import rateLimit from 'express-rate-limit'
import { env, isTest } from '../config/env'
import { sendError } from '../lib/envelope'

/**
 * Giới hạn tần suất. Khi vượt ngưỡng trả mã nghiệp vụ `RATE_LIMITED` (429)
 * kèm header `Retry-After` (giây) — xem docs/QUYET_DINH.md.
 *
 * Mặc định tắt khi chạy kiểm thử để bộ test không bị chặn; bật lại bằng
 * `setRateLimitEnabled(true)` trong bài kiểm thử dành riêng cho 429.
 */
let rateLimitEnabled = !isTest

export function setRateLimitEnabled(value: boolean): void {
  rateLimitEnabled = value
}

export function isRateLimitEnabled(): boolean {
  return rateLimitEnabled
}

const skipDisabled = (): boolean => !rateLimitEnabled

function tooMany(res: Parameters<typeof sendError>[0], windowMs: number): void {
  const giay = Math.max(1, Math.ceil(windowMs / 1000))
  sendError(
    res,
    429,
    'RATE_LIMITED',
    'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít giây.',
    { retryAfterGiay: giay },
    { 'Retry-After': String(giay) },
  )
}

/** Giới hạn tần suất chung cho toàn bộ API. */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipDisabled,
  handler: (_req, res, _next, options) => {
    tooMany(res, options.windowMs)
  },
})

/** Giới hạn chặt hơn cho đăng nhập / gửi OTP để chống dò mật khẩu. */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipDisabled,
  handler: (_req, res, _next, options) => {
    tooMany(res, options.windowMs)
  },
})
