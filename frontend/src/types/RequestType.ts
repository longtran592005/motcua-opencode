import type { FormField } from './FormField'

export interface AttachmentRequirement {
  key: string
  label: string
  batBuoc: boolean
  accept?: string
  helpText?: string
}

export interface RequestType {
  id: string
  ma: string
  ten: string
  nhom: string
  moTa: string
  /** Tên icon lucide-react. */
  icon: string
  /** Token màu Tailwind, ví dụ 'brand' | 'emerald'. */
  mau: string
  formFields: FormField[]
  giayTo: AttachmentRequirement[]
  workflowId: string
  templateId: string
  soNgayXuLy: number
  lePhi: number
  hoatDong: boolean
  soLuotNop?: number
}

export const REQUEST_TYPE_GROUPS = [
  'Giấy xác nhận & Bảng điểm',
  'Học vụ & Thi cử',
  'Nguyện vọng & Chuyển ngành',
  'Tốt nghiệp & Bằng cấp',
] as const
