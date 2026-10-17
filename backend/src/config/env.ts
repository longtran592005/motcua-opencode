import 'dotenv/config'
import { z } from 'zod'

/** Chuỗi bí mật mặc định CHỈ dùng khi phát triển/kiểm thử — bị chặn ở production. */
export const DEV_JWT_SECRET = 'dev-only-secret-khong-dung-o-production-0123456789'
export const DEV_HMAC_SECRET = 'dev-only-hmac-secret-doi-o-production-0123456789'

const boolFromEnv = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),

  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET phải dài ít nhất 16 ký tự').default(DEV_JWT_SECRET),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'JWT_ACCESS_TTL dạng 15m / 1h / 7d').default('15m'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'JWT_REFRESH_TTL dạng 15m / 1h / 7d').default('7d'),

  /** Miền công khai ghép vào liên kết QR xác thực văn bản. */
  PUBLIC_DOMAIN: z.string().default('http://localhost:5173'),
  /** Danh sách origin được phép CORS, phân tách bằng dấu phẩy. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  /** Đăng nhập nhanh theo vai trò — chỉ dùng khi trình diễn. */
  ENABLE_QUICK_LOGIN: boolFromEnv(false),

  /** Số phút hiệu lực của liên kết tải văn bản có chữ ký. */
  SIGNED_URL_TTL_MINUTES: z.coerce.number().int().positive().default(5),

  /* ------------------------------------------------------------------ *
   * Giai đoạn 4 — chữ ký số
   * ------------------------------------------------------------------ */

  /** Nhà cung cấp chữ ký: INTERNAL_HMAC (mặc định, nội bộ) | RSA_SHA256 | EXTERNAL_CA. */
  SIGNATURE_PROVIDER: z.enum(['INTERNAL_HMAC', 'RSA_SHA256', 'EXTERNAL_CA']).default('INTERNAL_HMAC'),
  /** Bí mật HMAC để ký nội bộ — bắt buộc đổi ở production. */
  SIGNATURE_HMAC_SECRET: z.string().min(16).default(DEV_HMAC_SECRET),
  /** Khoá riêng RSA dạng PEM (cho phép viết \n). Bắt buộc khi SIGNATURE_PROVIDER=RSA_SHA256. */
  SIGNATURE_RSA_PRIVATE_KEY: z.string().optional(),
  /** Khoá công khai RSA dạng PEM; nếu trống sẽ suy ra từ khoá riêng. */
  SIGNATURE_RSA_PUBLIC_KEY: z.string().optional(),

  /* ------------------------------------------------------------------ *
   * Giai đoạn 4 — kênh gửi OTP
   * ------------------------------------------------------------------ */

  /**
   * Kênh gửi OTP: CONSOLE (chỉ development — in ra console máy chủ) | CAPTURE (kiểm thử)
   * | EMAIL/SMS (bắt buộc cấu hình thật) | NONE (từ chối gửi).
   * Mặc định suy ra theo NODE_ENV.
   */
  OTP_CHANNEL: z.enum(['CONSOLE', 'CAPTURE', 'EMAIL', 'SMS', 'NONE']).optional(),

  /* ------------------------------------------------------------------ *
   * Giai đoạn 4 — job SLA
   * ------------------------------------------------------------------ */

  /** Bật/tắt job SLA chạy nền (đánh dấu quá hạn, nhắc trước hạn, leo thang). */
  ENABLE_SLA_JOB: boolFromEnv(true),
  /** Chu kỳ quét job SLA (giây). */
  SLA_JOB_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const chiTiet = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(gốc)'}: ${i.message}`)
    .join('\n')
  process.stderr.write(`Cấu hình môi trường không hợp lệ:\n${chiTiet}\n`)
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'

/** Chặn khởi động ở production khi còn dùng bí mật mặc định. */
export function assertProductionSecrets(): void {
  if (!isProduction) return

  const loi: string[] = []
  if (env.JWT_SECRET === DEV_JWT_SECRET) {
    loi.push('JWT_SECRET ngẫu nhiên >= 32 ký tự')
  }
  if (env.SIGNATURE_PROVIDER === 'INTERNAL_HMAC' && env.SIGNATURE_HMAC_SECRET === DEV_HMAC_SECRET) {
    loi.push('SIGNATURE_HMAC_SECRET ngẫu nhiên >= 32 ký tự')
  }
  if (env.SIGNATURE_PROVIDER === 'RSA_SHA256' && !env.SIGNATURE_RSA_PRIVATE_KEY) {
    loi.push('SIGNATURE_RSA_PRIVATE_KEY (PEM) khi dùng RSA_SHA256')
  }
  if (otpChannelName() === 'CONSOLE') {
    loi.push('OTP_CHANNEL thật (EMAIL/SMS) thay vì CONSOLE ở production')
  }

  if (loi.length) {
    throw new Error('TỪ CHỐI KHỞI ĐỘNG: production đang thiếu cấu hình — ' + loi.join('; ') + '.')
  }
}

/** Tên kênh gửi OTP hiệu lực (suy ra theo NODE_ENV khi không khai báo). */
export function otpChannelName(): 'CONSOLE' | 'CAPTURE' | 'EMAIL' | 'SMS' | 'NONE' {
  if (env.OTP_CHANNEL) return env.OTP_CHANNEL
  if (env.NODE_ENV === 'development') return 'CONSOLE'
  if (env.NODE_ENV === 'test') return 'CAPTURE'
  return 'NONE'
}

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
