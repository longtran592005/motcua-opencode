import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { requestContext, requireUser } from '../../lib/context'
import { userDto, userInclude } from '../shared/userDto'
import { requestTypeDto } from '../shared/dto'
import * as service from './service'

const ROLES = ['SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'] as const
const GENDERS = ['NAM', 'NU', 'KHAC'] as const

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tuKhoa: z.string().trim().max(200).optional(),
  vaiTro: z.union([z.enum(ROLES), z.literal('ALL')]).optional(),
  trangThai: z.union([z.enum(['ACTIVE', 'LOCKED']), z.literal('ALL')]).optional(),
  donViId: z.string().max(200).optional(),
})

const idParam = z.object({ id: z.string().trim().min(1).max(200) })

const userBody = z.object({
  maSo: z.string().trim().min(1, 'Thiếu mã số.').max(50).optional(),
  hoTen: z.string().trim().min(1, 'Thiếu họ tên.').max(200).optional(),
  email: z.string().trim().email('Email không hợp lệ.').max(200).optional(),
  role: z.enum(ROLES).optional(),
  soDienThoai: z.string().trim().max(30).nullable().optional(),
  ngaySinh: z.string().trim().max(40).nullable().optional(),
  gioiTinh: z.enum(GENDERS).nullable().optional(),
  chucVu: z.string().trim().max(200).nullable().optional(),
  donViId: z.string().uuid('Đơn vị không hợp lệ.').nullable().optional(),
  lopId: z.string().uuid('Lớp không hợp lệ.').nullable().optional(),
  trangThai: z.enum(['ACTIVE', 'LOCKED']).optional(),
  matKhau: z.string().min(6, 'Mật khẩu phải dài ít nhất 6 ký tự.').max(100).optional(),
})

const userCreateBody = userBody.extend({
  maSo: z.string().trim().min(1, 'Thiếu mã số.').max(50),
  hoTen: z.string().trim().min(1, 'Thiếu họ tên.').max(200),
  email: z.string().trim().email('Email không hợp lệ.').max(200),
  role: z.enum(ROLES),
})

export const userRouter: Router = Router()

userRouter.use(authenticate)

userRouter.get(
  '/',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuery>
    const where: Prisma.UserWhereInput = { deletedAt: null }
    if (q.vaiTro && q.vaiTro !== 'ALL') where.role = q.vaiTro
    if (q.trangThai && q.trangThai !== 'ALL') where.trangThai = q.trangThai
    if (q.donViId) where.OR = [{ facultyId: q.donViId }, { departmentId: q.donViId }]
    if (q.tuKhoa) {
      where.OR = [
        { hoTen: { contains: q.tuKhoa, mode: 'insensitive' } },
        { maSo: { contains: q.tuKhoa, mode: 'insensitive' } },
        { email: { contains: q.tuKhoa, mode: 'insensitive' } },
      ]
    }

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { maSo: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ])
    sendPage(res, rows.map(userDto), { page: q.page, pageSize: q.pageSize, total })
  }),
)

/** Danh sách cố vấn học tập để gán cho lớp. */
userRouter.get(
  '/advisors',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.user.findMany({
      where: { role: 'CO_VAN', deletedAt: null },
      include: userInclude,
      orderBy: { maSo: 'asc' },
    })
    send(res, rows.map(userDto))
  }),
)

userRouter.post(
  '/',
  requireRole('ADMIN'),
  idempotent(),
  validate(userCreateBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof userCreateBody>
    send(res, await service.createUser({ user: requireUser(req), ...requestContext(req) }, body), 201)
  }),
)

/** Các loại đơn được phép nộp cho một người dùng. */
userRouter.get(
  '/:id/request-types',
  validate(idParam, 'params'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.requestType.findMany({
      where: { hoatDong: true, deletedAt: null },
      include: { formFields: { orderBy: { order: 'asc' } }, requiredDocs: true },
      orderBy: [{ nhom: 'asc' }, { ten: 'asc' }],
    })
    send(res, rows.map((r) => requestTypeDto(r)))
  }),
)

/** Đặt lại mật khẩu — trả về mật khẩu tạm cho quản trị viên. */
userRouter.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    send(res, await service.resetPassword({ user: requireUser(req), ...requestContext(req) }, id))
  }),
)

userRouter.get(
  '/:id',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.user.findFirst({
      where: { ...(isUuid(id) ? { id } : { maSo: id }), deletedAt: null },
      include: userInclude,
    })
    if (!row) throw AppError.notFound('Không tìm thấy người dùng.')
    send(res, userDto(row))
  }),
)

userRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  idempotent(),
  validate(idParam, 'params'),
  validate(userBody),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const body = req.body as z.infer<typeof userBody>
    send(res, await service.updateUser({ user: requireUser(req), ...requestContext(req) }, id, body))
  }),
)

userRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    await service.deleteUser({ user: requireUser(req), ...requestContext(req) }, id)
    res.status(204).end()
  }),
)
