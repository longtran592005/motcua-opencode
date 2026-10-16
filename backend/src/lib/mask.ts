/**
 * Che dữ liệu cá nhân NGAY TẠI MÁY CHỦ (quyết định A3).
 *
 * Mọi API công khai (tra cứu văn bản bằng token/số văn bản, danh sách văn bản
 * mới cấp…) phải trả về dữ liệu đã che; không bao giờ trả họ tên, MSSV, email
 * hay số điện thoại đầy đủ. Giữ nguyên định dạng với frontend
 * (`frontend/src/lib/utils.ts` -> `maskName`, `maskMssv`).
 */

/** "Nguyễn Văn An" -> "Nguyễn V** A" */
export function maskName(hoTen: string): string {
  const parts = hoTen.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? ''
  const last = parts[parts.length - 1]
  const middle = parts.slice(1, -1).map((w) => '*'.repeat(w.length))
  return [parts[0], ...middle, last.charAt(0)].join(' ')
}

/** "20211234" -> "2021***" */
export function maskMssv(maSo: string): string {
  if (maSo.length <= 4) return '*'.repeat(maSo.length)
  return `${maSo.slice(0, 4)}${'*'.repeat(Math.max(3, maSo.length - 4))}`
}

/** "nguyen.van.an@tbu.edu.vn" -> "ngu***@tbu.edu.vn" */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const head = local.slice(0, Math.min(3, local.length))
  return `${head}***${email.slice(at)}`
}

/** "0912345678" -> "0912***678" */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s+/g, '')
  if (digits.length <= 4) return '*'.repeat(digits.length)
  const head = digits.slice(0, 4)
  const tail = digits.slice(-3)
  return `${head}***${tail}`
}

/** Che dữ liệu cá nhân trong văn bản tự do (nội dung/trích yếu văn bản). */
export function scrubText(text: string, sensitive: Array<string | null | undefined>): string {
  let out = text
  for (const value of sensitive) {
    if (!value || value.trim().length < 3) continue
    const masked = value.includes('@')
      ? maskEmail(value)
      : /^[0-9]+$/.test(value)
        ? maskMssv(value)
        : maskName(value)
    if (masked === value) continue
    out = out.split(value).join(masked)
  }
  return out
}

export interface StudentLike {
  hoTen: string
  mssv: string
  lop?: string
  khoa?: string
  nganh?: string
  khoaHoc?: string
  email?: string
  soDienThoai?: string
}

/** Bản sao đã che của thông tin sinh viên, dùng cho mọi phản hồi công khai. */
export function maskStudent<T extends StudentLike>(sv: T): StudentLike {
  return {
    hoTen: maskName(sv.hoTen),
    mssv: maskMssv(sv.mssv),
    ...(sv.lop ? { lop: sv.lop } : {}),
    ...(sv.khoa ? { khoa: sv.khoa } : {}),
    ...(sv.nganh ? { nganh: sv.nganh } : {}),
    ...(sv.khoaHoc ? { khoaHoc: sv.khoaHoc } : {}),
    ...(sv.email ? { email: maskEmail(sv.email) } : {}),
    ...(sv.soDienThoai ? { soDienThoai: maskPhone(sv.soDienThoai) } : {}),
  }
}
