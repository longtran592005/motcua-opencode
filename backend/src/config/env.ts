import 'dotenv/config'
import { z } from 'zod'

/**
 * Chuỗi bí mật mặc định CHỈ-DÙNG-DEV (quyết định Q2).
 *
 * Chỉ được phép dùng khi `NODE_ENV` đúng bằng "development" hoặc "test".
 * Khi `NODE_ENV` chưa đặt hoặc mang giá trị khác (production, staging…) mà
 * thiếu `SIGNATURE_HMAC_SECRET` thì ứng dụng TỪ CHỐI KHỞI ĐỘNG.
 */
export const DEV_JWT_SECRET = 'dev-only-secret-khong-dung-o-production-0123456789'
export const DEV_HMAC_SECRET = 'dev-only-hmac-secret-doi-o-production-0123456789'

/** Danh sách môi trường được phép dùng khoá mặc định CHỈ-DÙNG-DEV. */
export const DEV_ONLY_ENVS = ['development', 'test'] as const

const boolFromEnv = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((v) => v === 'true')

const schema = z.object({
  /**
   * Môi trường chạy. KHÔNG có giá trị mặc định (quyết định Q2): khi biến này
   * chưa được đặt, ứng dụng coi như môi trường "khác" — không được dùng khoá
   * bí mật mặc định CHỈ-DÙNG-DEV. Cho phép mọi giá trị (development, test,
   * production, staging…) để việc triển khai không bị chặn oan.
   */
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),

  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET phải dài ít nhất 16 ký tự').default(DEV_JWT_SECRET),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'JWT_ACCESS_TTL dạng 15m / 1h / 7d').default('15m'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'JWT_REFRESH_TTL dạng 15m / 1h / 7d').default('7d'),

  /** Miền công khai ghép vào liên kết QR xác thực văn bản. */
  PUBLIC_DOMAIN: z.string().default('http://localhost:5173'),
  PUBLIC_BASE_URL: z.string().optional(),
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
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  /* ------------------------------------------------------------------ *
   * Giai đoạn 4 — job SLA
   * ------------------------------------------------------------------ */

  /** Bật/tắt job SLA chạy nền (đánh dấu quá hạn, nhắc trước hạn, leo thang). */
  ENABLE_SLA_JOB: boolFromEnv(true),
  /** Chu kỳ quét job SLA (giây). */
  SLA_JOB_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),

  /* ------------------------------------------------------------------ *
   * Chatbot AI (Giai đoạn chatbot)
   * ------------------------------------------------------------------ */

  /** Khoá Gemini API — CHỈ đặt trong backend/.env, không đưa vào frontend/Git. */
  GEMINI_API_KEY: z.string().optional(),
  /** Tên mô hình sinh văn bản (miễn phí: gemini-2.5-flash). */
  GEMINI_MODEL: z.string().min(3).default('gemini-2.5-flash'),
  /** Tên mô hình embedding (miễn phí: gemini-embedding-001). */
  GEMINI_EMBED_MODEL: z.string().min(3).default('gemini-embedding-001'),
  /** Số điểm truy xuất tối thiểu để coi là "có căn cứ" trả lời. */
  CHAT_MIN_SCORE: z.coerce.number().nonnegative().default(0.6),
  /** Giới hạn theo người dùng: số tin nhắn / 10 phút và / ngày. */
  CHAT_USER_PER_10MIN: z.coerce.number().int().positive().default(15),
  CHAT_USER_PER_DAY: z.coerce.number().int().positive().default(80),
  /** Giới hạn toàn hệ thống: lượt gọi Gemini / ngày. */
  CHAT_GLOBAL_PER_DAY: z.coerce.number().int().positive().default(1000),
  /** Số câu chuyển lên cán bộ tối đa mỗi người mỗi ngày. */
  CHAT_HANDOFF_PER_DAY: z.coerce.number().int().positive().default(5),
  /** Số ngày giữ lịch sử tin nhắn trước khi dọn. */
  CHAT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
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
export const isDevelopment = env.NODE_ENV === 'development'
/** Được phép dùng các bí mật mặc định CHỈ-DÙNG-DEV hay không. */
export const mayUseDevOnlySecrets = (DEV_ONLY_ENVS as readonly string[]).includes(env.NODE_ENV ?? '')

/**
 * Kiểm tra khoá ký HMAC (quyết định Q2). Trả về thông báo lỗi nếu cấu hình
 * buộc phải TỪ CHỐI KHỞI ĐỘNG, hoặc `null` nếu hợp lệ.
 *
 * Hàm thuần (nhận tham số, không đọc module) để dễ kiểm thử.
 */
export function signatureSecretProblem(
  nodeEnv: string | undefined,
  provider: string,
  hmacSecret: string,
): string | null {
  if (provider !== 'INTERNAL_HMAC') return null
  if (hmacSecret !== DEV_HMAC_SECRET) return null
  const duocPhep = (DEV_ONLY_ENVS as readonly string[]).includes(nodeEnv ?? '')
  if (duocPhep) return null
  const moTa = nodeEnv === undefined ? 'chưa đặt' : `"${nodeEnv}"`
  return (
    `TỪ CHỐI KHỞI ĐỘNG: NODE_ENV=${moTa} nhưng thiếu SIGNATURE_HMAC_SECRET. ` +
    'Khoá HMAC mặc định CHỈ-DÙNG-DEV chỉ được phép khi NODE_ENV là "development" hoặc "test"; ' +
    'các môi trường khác bắt buộc đặt SIGNATURE_HMAC_SECRET (>= 16 ký tự).'
  )
}

/**
 * Bắt buộc kiểm tra khoá ký HMAC ngay khi khởi động. Ném lỗi để chặn khởi động
 * nếu đang dùng khoá mặc định CHỈ-DÙNG-DEV ở môi trường không được phép; in
 * cảnh báo rõ ràng khi (hợp lệ) đang dùng khoá CHỈ-DÙNG-DEV.
 */
export function assertSignatureSecret(): void {
  const problem = signatureSecretProblem(
    env.NODE_ENV,
    env.SIGNATURE_PROVIDER,
    env.SIGNATURE_HMAC_SECRET,
  )
  if (problem) throw new Error(problem)
  if (env.SIGNATURE_PROVIDER === 'INTERNAL_HMAC' && env.SIGNATURE_HMAC_SECRET === DEV_HMAC_SECRET) {
    process.stderr.write(
      '[CẢNH BÁO] Đang dùng khoá ký HMAC mặc định CHỈ-DÙNG-DEV — tuyệt đối không dùng ở production.\n',
    )
  }
}

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

export const publicBaseUrl = env.PUBLIC_BASE_URL ?? env.PUBLIC_DOMAIN
