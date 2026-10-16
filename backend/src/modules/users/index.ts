import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { userDto, userInclude } from '../shared/userDto'
import { requestTypeDto } from '../shared/dto'

const ROLES = ['SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'] as const

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tuKhoa: z.string().trim().max(200).optional(),
  vaiTro: z.union([z.enum(ROLES), z.literal('ALL')]).optional(),
  trangThai: z.union([z.enum(['ACTIVE', 'LOCKED']), z.literal('ALL')]).optional(),
  donViId: z.string().max(200).optional(),
})

const idParam = z.object({ id: z.string().min(1).max(200) })

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
