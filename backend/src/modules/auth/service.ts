import bcrypt from 'bcryptjs'
import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { randomToken, sha256 } from '../../lib/crypto'
import { accessTtlSeconds, refreshTtlSeconds, signAccessToken } from '../../lib/jwt'
import { recordAudit } from '../../lib/audit'
import type { RequestContext } from '../../lib/context'
import { env } from '../../config/env'
import { userDto, userInclude, type UserRow } from '../shared/userDto'

/** Băm giả để cân bằng thời gian phản hồi khi không tìm thấy người dùng. */
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4FfKQ0m0K0K0K0K0K0K0K0K0K0K0'

export interface SessionPayload {
  token: string
  user: ReturnType<typeof userDto>
  hetHan: string
  refreshToken: string
  refreshHetHan: string
}

async function issueSession(user: UserRow, ctx: RequestContext): Promise<SessionPayload> {
  const accessToken = signAccessToken({ sub: user.id, maSo: user.maSo, role: user.role })
  const refreshToken = randomToken(32)
  const hetHan = new Date(Date.now() + refreshTtlSeconds * 1000)

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      hetHan,
      userAgent: ctx.userAgent.slice(0, 300),
      diaChiIp: ctx.ip,
    },
  })

  return {
    token: accessToken,
    user: userDto(user),
    hetHan: new Date(Date.now() + accessTtlSeconds * 1000).toISOString(),
    refreshToken,
    refreshHetHan: hetHan.toISOString(),
  }
}

export async function login(
  ctx: RequestContext,
  input: { dinhDanh: string; matKhau: string },
): Promise<SessionPayload> {
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        // Mã số người dùng được so khớp không phân biệt hoa thường (CV001 = cv001).
        { maSo: { equals: input.dinhDanh, mode: 'insensitive' } },
        { email: { equals: input.dinhDanh, mode: 'insensitive' } },
      ],
    },
    include: userInclude,
  })

  const hopLe = await bcrypt.compare(input.matKhau, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !hopLe) {
    throw AppError.unauthorized('Thông tin đăng nhập không đúng.')
  }
  if (user.trangThai === 'LOCKED') {
    throw new AppError('UNAUTHORIZED', 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.')
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const session = await issueSession(user, ctx)
  await recordAudit({
    nguoiThucHien: user,
    hanhDong: 'LOGIN',
    doiTuong: 'Phiên đăng nhập',
    doiTuongId: user.maSo,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
  return session
}

/** Đăng nhập nhanh theo vai trò — chỉ bật khi ENABLE_QUICK_LOGIN=true (trình diễn). */
export async function quickLogin(ctx: RequestContext, role: Role): Promise<SessionPayload> {
  if (!env.ENABLE_QUICK_LOGIN) {
    throw AppError.notFound('Đăng nhập nhanh đã bị tắt trên môi trường này.')
  }
  const user = await prisma.user.findFirst({
    where: { role, deletedAt: null, trangThai: 'ACTIVE' },
    include: userInclude,
    orderBy: { maSo: 'asc' },
  })
  if (!user) throw AppError.notFound(`Không có tài khoản nào với vai trò ${role}.`)
  return issueSession(user, ctx)
}

/**
 * Xoay vòng refresh token. Nếu phát hiện token cũ bị dùng lại, thu hồi
 * TOÀN BỘ phiên của người dùng (quyết định: phát hiện dùng lại token cũ).
 */
export async function refresh(ctx: RequestContext, refreshToken: string): Promise<SessionPayload> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(refreshToken) },
  })
  if (!row) throw AppError.unauthorized('Phiên làm việc không hợp lệ.')

  if (row.daThuHoi) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, daThuHoi: false },
      data: { daThuHoi: true },
    })
    await recordAudit({
      nguoiThucHien: null,
      hanhDong: 'REFRESH_REUSE_DETECTED',
      doiTuong: 'Phiên đăng nhập',
      doiTuongId: row.userId,
      giaTriSau: 'Thu hồi toàn bộ phiên do phát hiện dùng lại refresh token',
      diaChiIp: ctx.ip,
      thietBi: ctx.userAgent,
    })
    throw AppError.unauthorized(
      'Phát hiện phiên đăng nhập được dùng lại. Toàn bộ phiên đã bị thu hồi, vui lòng đăng nhập lại.',
    )
  }

  if (row.hetHan.getTime() < Date.now()) {
    throw AppError.unauthorized('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')
  }

  const user = await prisma.user.findFirst({
    where: { id: row.userId, deletedAt: null },
    include: userInclude,
  })
  if (!user) throw AppError.unauthorized('Phiên làm việc không hợp lệ.')
  if (user.trangThai === 'LOCKED') {
    throw new AppError('UNAUTHORIZED', 'Tài khoản đã bị khoá.')
  }

  const accessToken = signAccessToken({ sub: user.id, maSo: user.maSo, role: user.role })
  const newToken = randomToken(32)
  const hetHan = new Date(Date.now() + refreshTtlSeconds * 1000)

  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(newToken),
        hetHan,
        userAgent: ctx.userAgent.slice(0, 300),
        diaChiIp: ctx.ip,
      },
    })
    await tx.refreshToken.update({
      where: { id: row.id },
      data: { daThuHoi: true, replacedById: created.id },
    })
  })

  return {
    token: accessToken,
    user: userDto(user),
    hetHan: new Date(Date.now() + accessTtlSeconds * 1000).toISOString(),
    refreshToken: newToken,
    refreshHetHan: hetHan.toISOString(),
  }
}

export async function logout(ctx: RequestContext & { userId: string }): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId: ctx.userId, daThuHoi: false },
    data: { daThuHoi: true },
  })
  await recordAudit({
    nguoiThucHien: null,
    hanhDong: 'LOGOUT',
    doiTuong: 'Phiên đăng nhập',
    doiTuongId: ctx.userId,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
}

export async function me(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: userInclude,
  })
  if (!user) throw AppError.unauthorized()
  return userDto(user)
}

export async function updateProfile(
  ctx: RequestContext & { userId: string },
  patch: { hoTen?: string; soDienThoai?: string; avatarUrl?: string },
) {
  const user = await prisma.user.findFirst({
    where: { id: ctx.userId, deletedAt: null },
    include: userInclude,
  })
  if (!user) throw AppError.unauthorized()

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(patch.hoTen ? { hoTen: patch.hoTen } : {}),
      ...(patch.soDienThoai ? { soDienThoai: patch.soDienThoai } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    },
    include: userInclude,
  })

  await recordAudit({
    nguoiThucHien: updated,
    hanhDong: 'UPDATE_USER',
    doiTuong: 'Người dùng',
    doiTuongId: updated.maSo,
    giaTriTruoc: user.hoTen,
    giaTriSau: updated.hoTen,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return userDto(updated)
}
