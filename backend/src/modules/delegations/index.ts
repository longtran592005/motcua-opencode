import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { recordAudit } from '../../lib/audit'
import { requireUser } from '../../lib/context'
import { userDto, userInclude } from '../shared/userDto'
import { delegationDto, delegationInclude } from './service'

const ROLES = ['SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'] as const

const delegationBody = z
  .object({
    nguoiNhanId: z.string().uuid('Người nhận ủy quyền không hợp lệ.'),
    vaiTro: z.enum(ROLES),
    tuNgay: z.coerce.date({ invalid_type_error: 'Ngày bắt đầu không hợp lệ.' }),
    denNgay: z.coerce.date({ invalid_type_error: 'Ngày kết thúc không hợp lệ.' }),
    lyDo: z.string().trim().min(1, 'Vui lòng nhập lý do ủy quyền.').max(1000),
  })
  .refine((v) => v.denNgay.getTime() > v.tuNgay.getTime(), {
    message: 'Ngày kết thúc phải sau ngày bắt đầu.',
    path: ['denNgay'],
  })

const eligibleQuery = z.object({ vaiTro: z.enum(ROLES) })
const idParam = z.object({ id: z.string().trim().min(1).max(200) })

export const delegationRouter: Router = Router()

delegationRouter.use(authenticate, requireRole('CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'))

/** Người có thể nhận ủy quyền theo vai trò (đặt trước `/:id` để không bị nuốt đường dẫn). */
delegationRouter.get(
  '/eligible-users',
  validate(eligibleQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { vaiTro } = req.query as unknown as z.infer<typeof eligibleQuery>
    const rows = await prisma.user.findMany({
      where: { role: vaiTro, trangThai: 'ACTIVE', deletedAt: null },
      include: userInclude,
      orderBy: { maSo: 'asc' },
    })
    send(res, rows.map(userDto))
  }),
)

delegationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const where: Prisma.DelegationWhereInput = { deletedAt: null }
    if (user.role !== 'ADMIN') {
      where.OR = [{ nguoiUyQuyenId: user.id }, { nguoiNhanId: user.id }]
    }
    const rows = await prisma.delegation.findMany({
      where,
      include: delegationInclude,
      orderBy: { createdAt: 'desc' },
    })
    send(res, rows.map(delegationDto))
  }),
)

delegationRouter.post(
  '/',
  idempotent(),
  validate(delegationBody),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const body = req.body as z.infer<typeof delegationBody>

    const nhan = await prisma.user.findFirst({
      where: { id: body.nguoiNhanId, deletedAt: null },
      select: { id: true, hoTen: true, role: true, trangThai: true },
    })
    if (!nhan) throw AppError.notFound('Không tìm thấy người nhận ủy quyền.')
    if (nhan.trangThai !== 'ACTIVE') {
      throw AppError.validation('Người nhận ủy quyền đang bị khoá.')
    }
    if (nhan.id === user.id) {
      throw AppError.validation('Không thể ủy quyền cho chính mình.')
    }
    if (nhan.role !== body.vaiTro) {
      throw AppError.validation('Người nhận không giữ vai trò được ủy quyền.')
    }

    const created = await prisma.delegation.create({
      data: {
        nguoiUyQuyenId: user.id,
        nguoiNhanId: nhan.id,
        vaiTro: body.vaiTro,
        tuNgay: body.tuNgay,
        denNgay: body.denNgay,
        lyDo: body.lyDo,
        hieuLuc: true,
      },
      include: delegationInclude,
    })

    await recordAudit({
      nguoiThucHien: user,
      hanhDong: 'DELEGATE_APPROVAL',
      doiTuong: 'Ủy quyền duyệt',
      doiTuongId: created.id,
      giaTriSau: `${nhan.hoTen} nhận ủy quyền ${body.vaiTro}`,
      diaChiIp: req.ip,
      thietBi: req.get('user-agent') ?? undefined,
    })

    send(res, delegationDto(created), 201)
  }),
)

delegationRouter.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const { id } = req.params as { id: string }
    if (!isUuid(id)) throw AppError.notFound('Không tìm thấy bản ghi ủy quyền.')
    const row = await prisma.delegation.findFirst({
      where: { id, deletedAt: null },
      include: delegationInclude,
    })
    if (!row) throw AppError.notFound('Không tìm thấy bản ghi ủy quyền.')
    if (user.role !== 'ADMIN' && row.nguoiUyQuyenId !== user.id) {
      throw AppError.forbidden('Bạn không thể huỷ ủy quyền này.')
    }
    if (!row.hieuLuc) {
      throw AppError.invalidTransition('Ủy quyền này đã được huỷ trước đó.')
    }

    await prisma.delegation.update({ where: { id: row.id }, data: { hieuLuc: false } })

    await recordAudit({
      nguoiThucHien: user,
      hanhDong: 'DELEGATE_APPROVAL',
      doiTuong: 'Ủy quyền duyệt',
      doiTuongId: row.id,
      giaTriTruoc: 'Đang hiệu lực',
      giaTriSau: 'Đã huỷ',
      diaChiIp: req.ip,
      thietBi: req.get('user-agent') ?? undefined,
    })

    res.status(204).end()
  }),
)
