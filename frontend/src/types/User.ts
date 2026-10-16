import type { Role } from './Role'

export const GENDERS = ['NAM', 'NU', 'KHAC'] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  NAM: 'Nam',
  NU: 'Nữ',
  KHAC: 'Khác',
}

export type UserStatus = 'ACTIVE' | 'LOCKED'

export interface User {
  id: string
  /** Mã số sinh viên hoặc mã cán bộ. */
  maSo: string
  hoTen: string
  email: string
  role: Role
  avatarUrl?: string
  soDienThoai?: string
  ngaySinh?: string
  gioiTinh?: Gender
  chucVu?: string
  /** Đơn vị (khoa/phòng). */
  donViId?: string
  donViTen?: string
  /** Thông tin riêng của sinh viên. */
  lopId?: string
  lopTen?: string
  nganhTen?: string
  khoaHoc?: string
  trangThai: UserStatus
}

/** Phiên đăng nhập trả về từ authService. */
export interface Session {
  token: string
  user: User
  hetHan: string
}

export interface LoginPayload {
  /** Mã số sinh viên/cán bộ hoặc email. */
  dinhDanh: string
  matKhau: string
}
