import type { Prisma, Role } from '@prisma/client'
import { AppError } from './errors'

export interface ScopeUser {
  id: string
  role: Role
  facultyId: string | null
}

const NO_MATCH = '00000000-0000-0000-0000-000000000000'

/**
 * Phạm vi dữ liệu theo vai trò (quyết định A2/B1):
 *  - SINH_VIEN   : chỉ hồ sơ của mình
 *  - CO_VAN      : chỉ hồ sơ của sinh viên lớp mình phụ trách
 *  - TRUONG_KHOA : chỉ hồ sơ thuộc khoa mình
 *  - PHONG_DAO_TAO / ADMIN : toàn trường
 */
export function scopeWhere(user: ScopeUser): Prisma.ApplicationWhereInput {
  switch (user.role) {
    case 'SINH_VIEN':
      return { applicantId: user.id }
    case 'CO_VAN':
      return { class: { coVanId: user.id } }
    case 'TRUONG_KHOA':
      return user.facultyId
        ? {
            OR: [
              { facultyId: user.facultyId },
              { class: { facultyId: user.facultyId } },
            ],
          }
        : { id: NO_MATCH }
    case 'PHONG_DAO_TAO':
    case 'ADMIN':
      return {}
    default:
      return { id: NO_MATCH }
  }
}

export interface ScopeRecord {
  applicantId: string
  facultyId: string | null
  class?: { coVanId: string | null; facultyId: string } | null
}

/** Kiểm tra phạm vi TRÊN BẢN GHI đã tìm được (chống IDOR). */
export function inScope(app: ScopeRecord, user: ScopeUser): boolean {
  switch (user.role) {
    case 'SINH_VIEN':
      return app.applicantId === user.id
    case 'CO_VAN':
      return app.class?.coVanId === user.id
    case 'TRUONG_KHOA':
      return (
        !!user.facultyId &&
        (app.facultyId === user.facultyId || app.class?.facultyId === user.facultyId)
      )
    case 'PHONG_DAO_TAO':
    case 'ADMIN':
      return true
    default:
      return false
  }
}

export function assertInScope(app: ScopeRecord, user: ScopeUser): void {
  if (!inScope(app, user)) {
    throw AppError.forbidden('Bạn không có quyền truy cập hồ sơ này.')
  }
}
