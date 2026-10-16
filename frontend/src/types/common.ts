/**
 * Trạng thái hồ sơ — enum thống nhất toàn hệ thống.
 */
export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'NEED_SUPPLEMENT',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Đã nộp',
  PENDING_APPROVAL: 'Đang chờ duyệt',
  NEED_SUPPLEMENT: 'Cần bổ sung',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã rút',
}

/** Class Tailwind cho badge trạng thái (dùng token trong tailwind.config). */
export const STATUS_BADGE_CLASSES: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-status-draft-soft text-status-draft border-status-draft/30',
  SUBMITTED:
    'bg-status-submitted-soft text-status-submitted border-status-submitted/30',
  PENDING_APPROVAL:
    'bg-status-pending-soft text-status-pending border-status-pending/30',
  NEED_SUPPLEMENT:
    'bg-status-supplement-soft text-status-supplement border-status-supplement/40',
  REJECTED:
    'bg-status-rejected-soft text-status-rejected border-status-rejected/30',
  COMPLETED:
    'bg-status-completed-soft text-status-completed border-status-completed/30',
  CANCELLED:
    'bg-status-cancelled-soft text-status-cancelled border-status-cancelled/30',
}

/** Mã lỗi nghiệp vụ — hợp đồng với backend. */
export const ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN_SCOPE',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'INVALID_TRANSITION',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_LOCKED',
  'MISSING_ATTACHMENT',
  'ALREADY_PROCESSED',
  'DUPLICATE_ACTION',
  'DOCUMENT_REVOKED',
  'NETWORK_ERROR',
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export class ApiError extends Error {
  code: ErrorCode
  status: number
  chiTiet?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    status = 400,
    chiTiet?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.chiTiet = chiTiet
  }
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ListResult<T> {
  data: T
}
