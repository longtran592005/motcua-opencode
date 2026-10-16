import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Quyết định B1: mã nghiệp vụ KHÔNG bao giờ có dạng UUID. Hàm này dùng để
 * (a) từ chối mã nghiệp vụ dạng UUID khi ghi, (b) biết một tham số đường dẫn
 * là UUID nội bộ hay mã công khai khi tra cứu.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Sinh token ngẫu nhiên dạng hex (mặc định 32 byte = 256 bit). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/** So sánh hai chuỗi theo thời gian hằng số. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Sinh mã OTP 6 chữ số (từ nguồn ngẫu nhiên an toàn). */
export function randomOtp(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0')
}
