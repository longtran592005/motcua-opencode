import { formatDate } from './formatters'

/** Biến hợp lệ trong mẫu văn bản (không kèm dấu ngoặc). */
export const TEMPLATE_KEYS = [
  'ho_ten',
  'mssv',
  'ngay_sinh',
  'lop',
  'khoa',
  'nganh',
  'khoa_hoc',
  'so_van_ban',
  'ngay_cap',
  'trich_yeu',
  'ly_do',
  'ten_truong',
  'het_han',
] as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_SAMPLE_VALUES: Record<string, string> = {
  ho_ten: 'Nguyễn Văn An',
  mssv: '20211234',
  ngay_sinh: '18/04/2003',
  lop: 'K19-CNTT1',
  khoa: 'Khoa Công nghệ thông tin',
  nganh: 'Công nghệ thông tin',
  khoa_hoc: 'K19 (2021 - 2025)',
  so_van_ban: '132/GXN-ĐHTB',
  ngay_cap: '16/02/2026',
  trich_yeu: 'Xác nhận sinh viên đang theo học tại Trường',
  ly_do: 'Vay vốn ngân hàng',
  ten_truong: 'Trường Đại học Thái Bình',
  het_han: '30/06/2026',
}

/** Thay các biến {{ten_bien}} bằng giá trị tương ứng; biến thiếu giữ nguyên dạng {{...}}. */
export function renderTemplate(
  noiDung: string,
  values: Record<string, string | number | undefined | null>,
): string {
  return noiDung.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined || value === null || value === '') return match
    return String(value)
  })
}

/** Liệt kê các biến đang dùng trong một mẫu. */
export function extractVariables(noiDung: string): string[] {
  const found = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(noiDung)) !== null) found.add(m[1])
  return [...found]
}

/** Dữ liệu mẫu dùng cho phần xem trước A4 của trang quản trị. */
export function previewValues(
  extra: Record<string, string | number | undefined> = {},
): Record<string, string | number | undefined> {
  return {
    ...TEMPLATE_SAMPLE_VALUES,
    ngay_cap: formatDate(new Date()),
    ...extra,
  }
}
