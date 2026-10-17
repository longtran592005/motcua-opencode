import { ApiError, type ErrorCode } from '@/types'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api').replace(
  /\/$/,
  '',
)

const TOKEN_KEY = 'motcua.accessToken'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* bỏ qua */
  }
}

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  query?: Record<string, unknown>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)))
    else params.append(key, String(value))
  })
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

const WRITE_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Sinh UUID v4 ngẫu nhiên để dùng làm Idempotency-Key. */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback cho môi trường không hỗ trợ crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Gọi API thật; chuyển mã lỗi HTTP thành `ApiError` với `ErrorCode` nghiệp vụ. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options

  // Tránh gửi /auth/me qua mạng khi chưa có token để không gây lỗi 401 console
  if (path === '/auth/me' && !getToken()) {
    throw new ApiError('UNAUTHORIZED', 'Chưa đăng nhập.', 401)
  }

  let response: Response
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (WRITE_METHODS.has(method as HttpMethod)) {
      headers['Idempotency-Key'] = generateIdempotencyKey()
    }

    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Không kết nối được tới máy chủ.', 0)
  }

  if (response.status === 204) return undefined as T

  const raw = await response.text()
  const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}

  if (!response.ok) {
    const errorObj = payload.error as Record<string, unknown> | undefined
    const code =
      (errorObj?.code as ErrorCode | undefined) ??
      (payload.code as ErrorCode | undefined) ??
      mapStatus(response.status)
    const message =
      (errorObj?.message as string | undefined) ??
      (payload.message as string | undefined) ??
      'Đã xảy ra lỗi khi xử lý yêu cầu.'
    const details = (errorObj?.details ?? payload.chiTiet) as Record<string, unknown> | undefined
    throw new ApiError(code, message, response.status, details)
  }

  // Bóc phong bì envelope của backend: { success: true, data: ..., meta?: ... }
  if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
    if (payload.meta && Array.isArray(payload.data)) {
      return {
        items: payload.data,
        ...(payload.meta as Record<string, unknown>),
      } as T
    }
    return payload.data as T
  }

  return payload as T
}


function mapStatus(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN_SCOPE'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'INVALID_TRANSITION'
  if (status === 422) return 'VALIDATION_ERROR'
  return 'UNKNOWN'
}

/* --------------------------- Nhà máy service HTTP --------------------------- */

export interface RouteSpec {
  method: HttpMethod
  path: (...args: never[]) => string
  body?: (...args: never[]) => unknown
  query?: (...args: never[]) => Record<string, unknown>
}

export type RouteTable<S> = { [K in keyof S]: RouteSpec }

/**
 * Sinh service thật từ bảng khai báo route. Mỗi phương thức trong contract
 * tương ứng một dòng route, giúp việc nối backend chỉ cần khai báo đường dẫn.
 */
export function createHttpService<S extends object>(routes: RouteTable<S>): S {
  const out: Record<string, unknown> = {}
  Object.entries(routes as Record<string, RouteSpec>).forEach(([name, spec]) => {
    out[name] = (...args: unknown[]) =>
      request(spec.path(...(args as never[])), {
        method: spec.method,
        body: spec.body?.(...(args as never[])),
        query: spec.query?.(...(args as never[])),
      })
  })
  return out as S
}
