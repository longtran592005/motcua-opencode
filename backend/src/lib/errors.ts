/**
 * Mã lỗi nghiệp vụ và ánh xạ sang HTTP — khớp docs/QUYET_DINH.md (Phụ lục)
 * và frontend/src/types/common.ts (ERROR_CODES).
 */
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
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const ERROR_HTTP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN_SCOPE: 403,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  ALREADY_PROCESSED: 409,
  DUPLICATE_ACTION: 409,
  VALIDATION_ERROR: 422,
  MISSING_ATTACHMENT: 422,
  OTP_INVALID: 400,
  OTP_EXPIRED: 410,
  OTP_LOCKED: 423,
  DOCUMENT_REVOKED: 410,
  UNKNOWN: 500,
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    status?: number,
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status ?? ERROR_HTTP[code] ?? 500
    this.details = details
  }

  static unauthorized(message = 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.') {
    return new AppError('UNAUTHORIZED', message)
  }

  static forbidden(message = 'Bạn không có quyền truy cập tài nguyên này.') {
    return new AppError('FORBIDDEN_SCOPE', message)
  }

  static notFound(message = 'Không tìm thấy dữ liệu yêu cầu.') {
    return new AppError('NOT_FOUND', message)
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION_ERROR', message, details)
  }

  static invalidTransition(message: string) {
    return new AppError('INVALID_TRANSITION', message)
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}
