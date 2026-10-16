import { z } from 'zod'

export const approveBody = z.object({
  ghiChu: z.string().trim().max(2000).optional(),
  challengeId: z.string().max(200).optional(),
  otp: z.string().regex(/^\d{6}$/, 'Mã OTP gồm 6 chữ số.').optional(),
})

export const rejectBody = z.object({
  lyDo: z.string().trim().min(1, 'Vui lòng nhập lý do từ chối.').max(2000),
})

export const requestSupplementBody = z.object({
  noiDung: z.string().trim().min(1, 'Vui lòng nhập nội dung cần bổ sung.').max(2000),
})

export const batchApproveBody = z.object({
  maHoSoList: z.array(z.string().min(1)).min(1).max(50),
  ghiChu: z.string().trim().max(2000).optional(),
})

export const otpSendBody = z.object({
  maHoSo: z.string().min(1).max(200),
})

export const otpIdParam = z.object({
  id: z.string().min(1).max(200),
})

export const maParam = z.object({ ma: z.string().min(1).max(200) })

export const limitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
})
