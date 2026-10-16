import { z } from 'zod'
import type { FormField, RequestType } from '@/types'

function truongSchema(field: FormField): z.ZodTypeAny {
  const batBuoc = field.required && !field.readOnly
  let base: z.ZodTypeAny

  switch (field.type) {
    case 'number': {
      base = z
        .union([z.string(), z.number()])
        .transform((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v))
        .refine((v) => !Number.isNaN(v), 'Giá trị phải là số.')
        .refine((v) => field.min === undefined || v >= field.min, `Giá trị nhỏ nhất là ${field.min}.`)
        .refine((v) => field.max === undefined || v <= field.max, `Giá trị lớn nhất là ${field.max}.`)
      break
    }
    case 'checkbox':
      base = field.options && field.options.length > 1 ? z.array(z.string()) : z.literal(true)
      break
    case 'email':
      base = z.string().email('Email không hợp lệ.')
      break
    case 'phone':
      base = z.string().regex(/^[0-9+\s.\-()]{9,15}$/, 'Số điện thoại không hợp lệ.')
      break
    default:
      base = z.string().trim().min(1, 'Trường này là bắt buộc.')
  }

  if (batBuoc) return base
  return base.optional().or(z.literal('')).or(z.literal(false))
}

/** Dựng schema kiểm tra dữ liệu động từ cấu hình của loại đơn. */
export function buildApplicationSchema(requestType: RequestType) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of requestType.formFields) {
    shape[field.key] = truongSchema(field)
  }
  return z.object(shape).passthrough()
}

export interface ApplicationFormErrors {
  [key: string]: string
}

/** Kiểm tra dữ liệu và trả về danh sách lỗi theo khóa trường. */
export function validateApplicationData(
  requestType: RequestType,
  duLieu: Record<string, unknown>,
): ApplicationFormErrors {
  const result = buildApplicationSchema(requestType).safeParse(duLieu)
  if (result.success) return {}
  const errors: ApplicationFormErrors = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !errors[key]) errors[key] = issue.message
  }
  return errors
}
