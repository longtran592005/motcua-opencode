import type { Role } from './Role'

export type SignatureMethod = 'OTP' | 'ELECTRONIC'

export const SIGNATURE_METHOD_LABELS: Record<SignatureMethod, string> = {
  OTP: 'Ký số OTP',
  ELECTRONIC: 'Duyệt điện tử',
}

export interface Signature {
  id: string
  applicationId: string
  vanBanId?: string
  /** Bước duyệt tương ứng trong luồng. */
  buocOrder: number
  tenBuoc: string
  nguoiKyId: string
  hoTen: string
  chucVu: string
  vaiTro: Role
  phuongThuc: SignatureMethod
  thoiDiemKy: string
  /** Mã băm SHA-256 nội dung hồ sơ tại thời điểm ký. */
  maBam: string
  /** Mã chữ ký rút gọn (8 ký tự đầu của mã băm). */
  maChuKy: string
  hopLe: boolean
  lyDoKhongHopLe?: string
}
