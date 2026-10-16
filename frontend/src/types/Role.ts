/**
 * Vai trò người dùng trong hệ thống Một cửa.
 * Dùng const-object thay cho enum (tsconfig bật `erasableSyntaxOnly`).
 */
export const ROLES = [
  'SINH_VIEN',
  'CO_VAN',
  'TRUONG_KHOA',
  'PHONG_DAO_TAO',
  'ADMIN',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  SINH_VIEN: 'Sinh viên',
  CO_VAN: 'Cố vấn học tập',
  TRUONG_KHOA: 'Trưởng khoa',
  PHONG_DAO_TAO: 'Phòng Đào tạo',
  ADMIN: 'Quản trị hệ thống',
}

/** Nhãn ngắn dùng cho bảng, badge. */
export const ROLE_SHORT_LABELS: Record<Role, string> = {
  SINH_VIEN: 'Sinh viên',
  CO_VAN: 'Cố vấn HT',
  TRUONG_KHOA: 'Trưởng khoa',
  PHONG_DAO_TAO: 'P. Đào tạo',
  ADMIN: 'Quản trị',
}

/** Cấp duyệt theo thứ tự nghiệp vụ. */
export const APPROVAL_ROLES: Role[] = [
  'CO_VAN',
  'TRUONG_KHOA',
  'PHONG_DAO_TAO',
]

export function isApproverRole(role: Role): boolean {
  return APPROVAL_ROLES.includes(role) || role === 'ADMIN'
}
