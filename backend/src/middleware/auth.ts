import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'
import { verifyAccessToken } from '../lib/jwt'

function bearerToken(req: import('express').Request): string | null {
  const header = req.header('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (!token || scheme?.toLowerCase() !== 'bearer') return null
  return token
}

/**
 * Xác thực bằng JWT access token rồi NẠP LẠI người dùng từ CSDL.
 * Nhờ vậy quyền luôn theo dữ liệu mới nhất (đổi vai trò, khoá tài khoản…),
 * đúng tinh thần quyết định B1: kiểm tra quyền trên bản ghi vừa tìm được.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = bearerToken(req)
    if (!token) throw AppError.unauthorized()

    const payload = verifyAccessToken(token)
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        maSo: true,
        hoTen: true,
        email: true,
        role: true,
        facultyId: true,
        departmentId: true,
        chucVu: true,
        trangThai: true,
      },
    })
    if (!user) throw AppError.unauthorized()
    if (user.trangThai === 'LOCKED') {
      throw new AppError('UNAUTHORIZED', 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.')
    }

    req.user = {
      id: user.id,
      maSo: user.maSo,
      hoTen: user.hoTen,
      email: user.email,
      role: user.role,
      facultyId: user.facultyId,
      departmentId: user.departmentId,
      chucVu: user.chucVu,
    }
    next()
  })().catch(next)
}

/** Xác thực tuỳ chọn: nạp thông tin người dùng nếu có token hợp lệ, không chặn nếu không có. */
export const authenticateOptional: RequestHandler = (req, _res, next) => {
  void (async () => {
    const token = bearerToken(req)
    if (!token) return next()

    try {
      const payload = verifyAccessToken(token)
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: {
          id: true,
          maSo: true,
          hoTen: true,
          email: true,
          role: true,
          facultyId: true,
          departmentId: true,
          chucVu: true,
          trangThai: true,
        },
      })
      if (user && user.trangThai !== 'LOCKED') {
        req.user = {
          id: user.id,
          maSo: user.maSo,
          hoTen: user.hoTen,
          email: user.email,
          role: user.role,
          facultyId: user.facultyId,
          departmentId: user.departmentId,
          chucVu: user.chucVu,
        }
      }
    } catch {
      // Bỏ qua nếu token không hợp lệ
    }
    next()
  })().catch(next)
}


/** Chỉ cho phép các vai trò liệt kê truy cập (ADMIN không tự động vượt qua). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user
    if (!user) return next(AppError.unauthorized())
    if (!roles.includes(user.role)) {
      return next(
        AppError.forbidden('Bạn không có quyền thực hiện thao tác này với vai trò hiện tại.'),
      )
    }
    next()
  }
}

/** Vai trò xử lý nghiệp vụ phê duyệt (kể cả ADMIN). */
export const APPROVER_ROLES: Role[] = ['CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN']

export function currentUser(req: import('express').Request): Express.AuthUser {
  if (!req.user) throw AppError.unauthorized()
  return req.user
}
