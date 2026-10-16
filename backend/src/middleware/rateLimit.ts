import rateLimit from 'express-rate-limit'
import { env, isTest } from '../config/env'
import { sendError } from '../lib/envelope'

/**
 * Giới hạn tần suất chung. 429 chưa có mã lỗi riêng trong hợp đồng frontend
 * nên dùng `UNKNOWN` (frontend quy về lỗi không xác định) — xem báo cáo Giai đoạn 3.
 */
export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res) => {
    sendError(res, 429, 'UNKNOWN', 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít giây.')
  },
})

/** Giới hạn chặt hơn cho đăng nhập / gửi OTP để chống dò mật khẩu. */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res) => {
    sendError(
      res,
      429,
      'UNKNOWN',
      'Bạn đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại.',
    )
  },
})
