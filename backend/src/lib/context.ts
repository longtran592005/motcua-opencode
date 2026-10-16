import type { Request } from 'express'
import { AppError } from './errors'

/** Ngữ cảnh yêu cầu dùng cho nhật ký: ai, từ đâu, bằng thiết bị nào. */
export interface RequestContext {
  ip: string
  userAgent: string
}

export function requestContext(req: Request): RequestContext {
  const forwarded = req.header('x-forwarded-for')
  const ip = (forwarded ? forwarded.split(',')[0]!.trim() : req.ip) || '0.0.0.0'
  return { ip, userAgent: req.header('user-agent') ?? 'không xác định' }
}

export function requireUser(req: Request): Express.AuthUser {
  if (!req.user) throw AppError.unauthorized()
  return req.user
}
