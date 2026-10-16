import { ApiError, type Paginated } from '@/types'
import { sleep } from '@/lib/utils'

const MIN = Number(import.meta.env.VITE_MOCK_DELAY_MIN ?? 300)
const MAX = Number(import.meta.env.VITE_MOCK_DELAY_MAX ?? 600)
/** Tỉ lệ lỗi ngẫu nhiên của các thao tác ĐỌC, để kiểm tra giao diện lỗi. */
const ERROR_RATE = Number(import.meta.env.VITE_MOCK_ERROR_RATE ?? 0.03)

function randomDelay() {
  const lo = Number.isFinite(MIN) ? MIN : 300
  const hi = Number.isFinite(MAX) ? MAX : 600
  return Math.round(lo + Math.random() * Math.max(0, hi - lo))
}

/** Mô phỏng độ trễ mạng 300-600ms. */
export async function mockDelay(): Promise<void> {
  await sleep(randomDelay())
}

/**
 * Bọc một thao tác đọc: thêm độ trễ và thi thoảng trả lỗi mạng ngẫu nhiên.
 * Các thao tác ghi (nộp, duyệt, ký) gọi `mockDelay` trực tiếp để demo luôn thành công.
 */
export async function readOp<T>(fn: () => T | Promise<T>): Promise<T> {
  await mockDelay()
  if (ERROR_RATE > 0 && Math.random() < ERROR_RATE) {
    throw new ApiError(
      'NETWORK_ERROR',
      'Không kết nối được tới máy chủ. Vui lòng thử lại.',
      503,
    )
  }
  return fn()
}

/** Bọc một thao tác ghi: chỉ thêm độ trễ mô phỏng. */
export async function writeOp<T>(fn: () => T | Promise<T>): Promise<T> {
  await mockDelay()
  return fn()
}

export function paginate<T>(
  items: T[],
  page = 1,
  pageSize = 10,
): Paginated<T> {
  const safeSize = Math.max(1, pageSize)
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / safeSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    total,
    page: safePage,
    pageSize: safeSize,
    totalPages,
  }
}

export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function addHoursIso(hours: number, from: string | Date = new Date()): string {
  const base = typeof from === 'string' ? new Date(from) : from
  return new Date(base.getTime() + hours * 3_600_000).toISOString()
}

/** Sắp xếp theo một khóa thời gian, hỗ trợ chiều tăng/giảm. */
export function sortByDate<T>(
  items: T[],
  getValue: (item: T) => string | undefined,
  direction: 'asc' | 'desc' = 'desc',
): T[] {
  return [...items].sort((a, b) => {
    const av = getValue(a) ?? ''
    const bv = getValue(b) ?? ''
    return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })
}
