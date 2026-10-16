import 'dotenv/config'
import { z } from 'zod'

/** Chuỗi bí mật mặc định CHỈ dùng khi phát triển/kiểm thử — bị chặn ở production. */
export const DEV_JWT_SECRET = 'dev-only-secret-khong-dung-o-production-0123456789'

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
  if (isProduction && env.JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error(
      'TỪ CHỐI KHỞI ĐỘNG: đang ở production nhưng JWT_SECRET vẫn là giá trị mặc định. ' +
        'Hãy đặt JWT_SECRET ngẫu nhiên >= 32 ký tự.',
    )
  }
}

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean)
