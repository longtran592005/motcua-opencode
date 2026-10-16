import { z } from 'zod'

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'NEED_SUPPLEMENT',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const

export const applicationStatusEnum = z.enum(APPLICATION_STATUSES)

export const attachmentInput = z.object({
  id: z.string().max(200).optional(),
  ten: z.string().trim().min(1, 'Thiếu tên tệp').max(300),
  loai: z.string().trim().min(1).max(150),
  kichThuoc: z.number().int().nonnegative().max(200 * 1024 * 1024),
  url: z.string().max(2000).optional(),
  uploadedAt: z.string().max(40).optional(),
  nguoiTaiLen: z.string().max(200).optional(),
  requirementKey: z.string().max(100).nullable().optional(),
})

export const applicationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  trangThai: z.union([applicationStatusEnum, z.literal('ALL')]).optional(),
  requestTypeId: z.string().max(200).optional(),
  tuKhoa: z.string().trim().max(200).optional(),
  khoa: z.string().max(200).optional(),
  lop: z.string().max(200).optional(),
  hanXuLy: z.enum(['ALL', 'SAP_HET_HAN', 'QUA_HAN']).optional(),
  sapXep: z.enum(['MOI_NHAT', 'CU_NHAT', 'HAN_GAN_NHAT']).optional(),
  choVaiTro: z.string().max(50).optional(),
})

export const recentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
})

export const createApplicationBody = z.object({
  requestTypeId: z.string().min(1, 'Thiếu loại đơn'),
  duLieu: z.record(z.unknown()).default({}),
  tepDinhKem: z.array(attachmentInput).max(30).default([]),
})

export const updateApplicationBody = createApplicationBody

export const cancelBody = z.object({
  lyDo: z.string().trim().max(1000).optional(),
})

export const supplementBody = z.object({
  duLieu: z.record(z.unknown()).optional(),
  tepDinhKem: z.array(attachmentInput).max(30).optional(),
  ghiChu: z.string().trim().max(2000).optional(),
})

export const idParam = z.object({ ma: z.string().min(1).max(200) })
