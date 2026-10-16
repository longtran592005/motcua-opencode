/**
 * Kiểu trường dữ liệu cho trình thiết kế biểu mẫu động.
 */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'email',
  'phone',
  'upload',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Văn bản ngắn',
  textarea: 'Văn bản dài',
  number: 'Số',
  date: 'Ngày',
  select: 'Chọn một (danh sách)',
  radio: 'Chọn một (nút)',
  checkbox: 'Chọn nhiều',
  email: 'Email',
  phone: 'Số điện thoại',
  upload: 'Tệp đính kèm',
}

export interface FieldOption {
  label: string
  value: string
}

export interface FormField {
  id: string
  /** Khóa dữ liệu, dùng để lưu giá trị vào `Application.duLieu`. */
  key: string
  label: string
  type: FieldType
  placeholder?: string
  helpText?: string
  required: boolean
  options?: FieldOption[]
  defaultValue?: string | number | boolean | null
  /** Với type = number. */
  min?: number
  max?: number
  /** Với type = textarea. */
  rows?: number
  /** Với type = upload. */
  accept?: string
  maxSizeMb?: number
  /** Bố cục trên lưới 2 cột của máy tính. */
  width?: 'full' | 'half'
  order: number
  /** Trường hệ thống, tự điền và chỉ đọc (họ tên, MSSV, lớp...). */
  readOnly?: boolean
}
