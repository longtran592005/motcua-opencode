// Đặt trước khi `src/config/env.ts` được nạp: dotenv KHÔNG ghi đè biến đã có,
// nên NODE_ENV=test ở đây sẽ thắng giá trị trong tệp .env.
process.env.NODE_ENV = 'test'
process.env.OTP_CHANNEL ??= 'CAPTURE'
process.env.ENABLE_SLA_JOB ??= 'false'
process.env.LOG_LEVEL ??= 'silent'
process.env.ENABLE_QUICK_LOGIN ??= 'true'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'
}

if (!process.env.DATABASE_URL.toLowerCase().includes('test')) {
  throw new Error(
    'TỪ CHỐI CHẠY TEST: DATABASE_URL không chứa "test". ' +
      'Các bài kiểm thử chỉ chạy trên CSDL riêng (ví dụ motcua_test), không được đụng CSDL phát triển.',
  )
}
