import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../config/env'
import { AppError } from './errors'

export interface AccessPayload {
  sub: string
  maSo: string
  role: Role
}

/** Đổi chuỗi kiểu "15m" thành số giây. */
export function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl)
  if (!m) throw new Error(`TTL không hợp lệ: ${ttl}`)
  const n = Number(m[1])
  const unit = m[2]
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400
  return n * factor
}

export const accessTtlSeconds = ttlToSeconds(env.JWT_ACCESS_TTL)
export const refreshTtlSeconds = ttlToSeconds(env.JWT_REFRESH_TTL)

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: accessTtlSeconds,
    issuer: 'motcua-api',
    audience: 'motcua-web',
  })
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: 'motcua-api',
      audience: 'motcua-web',
    }) as AccessPayload
  } catch {
    throw AppError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
  }
}
