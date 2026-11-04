/**
 * Riêng tư (Q6): che thông tin cá nhân trước khi gửi cho Gemini.
 * - Che theo hồ sơ người dùng đang đăng nhập: họ tên, mã số (MSSV), email,
 *   số điện thoại.
 * - Che theo regex: email, số điện thoại VN, CCCD 12 số, chuỗi MSSV hình
 *   Kyy + 8 số (ví dụ 1951061234), ngày sinh dd/mm/yyyy.
 * - Che TÊN câu hỏi CHƯA biết trước: kết quả công cụ gửi cho mô hình KHÔNG
 *   chứa tên/MSSV/nội dung đơn (đảm bảo sẵn ở tools.ts).
 */
import { keywords, normalizeText } from './vietnamese'

export interface MaskContext {
  hoTen?: string | null
  maSo?: string | null
  email?: string | null
  soDienThoai?: string | null
  ngaySinh?: string | null
}

const MASK = '[ĐÃ CHE]'

/** Ghép các mẫu chính tả nhận dạng cá nhân (dùng độc lập với hồ sơ). */
const PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, label: 'EMAIL' },
  // 10 số liên tiếp, hoặc +84/0 + 9 số (tách trước để tránh nuốt CCCD).
  { re: /(?:\+84|0084|0)(?:\s?[1-9]\d\s?){8,9}\d/g, label: 'SĐT' },
  { re: /\b\d{12}\b/g, label: 'CCCD' },
  { re: /\b\d{2}\/\d{2}\/\d{4}\b/g, label: 'NGÀY SINH' },
]

export interface MaskResult {
  text: string
  /** Số vị trí đã che. */
  masked: number
}

/** Che một chuỗi theo hồ sơ + regex. Không bỏ sót trước khi cho LLM. */
export function maskPii(input: string, ctx: MaskContext = {}): string {
  if (!input) return input
  let text = input
  let masked = 0

  // 1) Hồ sơ người dùng: ưu tiên chuỗi dài trước (họ tên đầy đủ).
  const profile: Array<[string | undefined, string]> = [
    [ctx.hoTen ?? undefined, 'HỌ TÊN'],
    [ctx.maSo ?? undefined, 'MSSV'],
    [ctx.email ?? undefined, 'EMAIL'],
    [ctx.soDienThoai ?? undefined, 'SĐT'],
    [ctx.ngaySinh ?? undefined, 'NGÀY SINH'],
  ]
  profile
    .filter((p): p is [string, string] => Boolean(p[0] && p[0].length >= 3))
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([, label]) => {
      const needle = text
      if (needle.includes(label)) return
      const value = profile.find((p) => p[1] === label)?.[0]
      if (!value) return
      const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
      const re = new RegExp(esc, 'gi')
      text = text.replace(re, () => {
        masked += 1
        return `[${label}]`
      })
    })

  // 2) Regex phổ quát (email, sđt lạ, cccd, mssv, ngày sinh).
  for (const { re } of PATTERNS) {
    const re2 = new RegExp(re.source, re.flags)
    text = text.replace(re2, (m) => {
      masked += 1
      const label = m.includes('@') ? 'EMAIL' : (m.match(/\//g)?.length ?? 0) >= 2 ? 'NGÀY SINH' : 'SỐ'
      return `[${label}]`
    })
  }

  // 3) MSSV dạng "19 + 8 số" hoặc "K + 2 số + N + số" (Thanh học đường).
  const maSoRe = /\b(?:19|20)\d{8}\b|\b[Kk]\d{2}[A-Za-z]{2,3}\d{0,4}\b/g
  text = text.replace(maSoRe, (m) => {
    masked += 1
    return '[MSSV]'
  })

  return text
}

/** Bộ nhớ đệm câu trả lời: chỉ đệm khi chuẩn hóa truy vấn KHÔNG chứa số/MSSV/phủ định. */
export function cacheableQuery(query: string, ctx: MaskContext = {}): boolean {
  const norm = normalizeText(query)
  // Xuất hiện MSSV/số điện thoại/CCCD → không đệm.
  if (/[0-9]{8,}/.test(norm)) return false
  if (norm.length < 6) return false
  // Câu hỏi tra cứu đơn thường dùng "tra cứu", "trạng thái", "hồ sơ" → cá nhân.
  if (/\b(tra cuu|trang thai|ho so|don cua toi|don cua em)\b/.test(norm)) return false
  return keywords(query).length >= 2
}
