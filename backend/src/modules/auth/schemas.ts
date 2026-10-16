import { z } from 'zod'

export const ROLES = ['SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'] as const

export const loginBody = z.object({
  dinhDanh: z.string().trim().min(1, 'Vui lòng nhập mã số hoặc email.').max(200),
  matKhau: z.string().min(1, 'Vui lòng nhập mật khẩu.').max(200),
})

export const quickLoginBody = z.object({
  role: z.enum(ROLES),
})

export const refreshBody = z.object({
  refreshToken: z.string().min(10, 'Thiếu refresh token.').max(400),
})

export const updateProfileBody = z.object({
  hoTen: z.string().trim().min(2, 'Họ tên quá ngắn.').max(150).optional(),
  soDienThoai: z
    .string()
    .trim()
    .regex(/^[0-9+\s().-]{6,20}$/, 'Số điện thoại không hợp lệ.')
    .optional(),
  avatarUrl: z.string().trim().max(2000).optional(),
})
