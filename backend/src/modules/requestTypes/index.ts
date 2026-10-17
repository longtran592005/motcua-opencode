import { Router } from 'express'
import { z } from 'zod'
import { authenticate, authenticateOptional, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { requestContext, requireUser } from '../../lib/context'
import { requestTypeDto } from '../shared/dto'
import * as service from './service'

const listQuery = z.object({
  hoatDong: z.enum(['true', 'false']).optional(),
  nhom: z.string().trim().max(200).optional(),
})
const idParam = z.object({ id: z.string().trim().min(1).max(200) })

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'radio',
  'checkbox',
  'email',
  'phone',
  'upload',
] as const

const formFieldSchema = z.object({
  key: z.string().trim().min(1, 'Thiếu khoá trường.').max(50),
  label: z.string().trim().min(1, 'Thiếu nhãn trường.').max(300),
  type: z.enum(FIELD_TYPES),
  placeholder: z.string().trim().max(300).optional(),
  helpText: z.string().trim().max(1000).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  rows: z.number().int().min(1).max(50).optional(),
  accept: z.string().trim().max(300).optional(),
  maxSizeMb: z.number().positive().max(200).optional(),
  width: z.string().trim().max(50).optional(),
  order: z.number().int().min(0).max(200).optional(),
  readOnly: z.boolean().optional(),
})

const requiredDocSchema = z.object({
  key: z.string().trim().min(1, 'Thiếu khoá giấy tờ.').max(50),
  label: z.string().trim().min(1, 'Thiếu tên giấy tờ.').max(300),
  batBuoc: z.boolean().optional(),
  accept: z.string().trim().max(300).optional(),
  helpText: z.string().trim().max(1000).optional(),
})

const requestTypeBody = z.object({
  ma: z.string().trim().min(1).max(50).optional(),
  ten: z.string().trim().min(1).max(300).optional(),
  nhom: z.string().trim().min(1).max(200).optional(),
  moTa: z.string().trim().max(2000).optional(),
  icon: z.string().trim().max(100).optional(),
  mau: z.enum(['brand', 'emerald', 'amber', 'violet', 'rose']).optional(),
  formFields: z.array(formFieldSchema).max(100).optional(),
  giayTo: z.array(requiredDocSchema).max(50).optional(),
  workflowId: z.string().trim().max(200).nullable().optional(),
  templateId: z.string().trim().max(200).nullable().optional(),
  soNgayXuLy: z.number().int().min(0).max(365).optional(),
  lePhi: z.number().int().min(0).max(100_000_000).optional(),
  hoatDong: z.boolean().optional(),
})

const requestTypeCreateBody = requestTypeBody.extend({
  ma: z.string().trim().min(1, 'Thiếu mã loại đơn.').max(50),
  ten: z.string().trim().min(1, 'Thiếu tên loại đơn.').max(300),
  nhom: z.string().trim().min(1, 'Thiếu nhóm loại đơn.').max(200),
})

export const requestTypeRouter: Router = Router()

// Cho phép xem danh sách loại đơn công khai (phục vụ trang chủ/tra cứu)
requestTypeRouter.get(
  '/',
  authenticateOptional,
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuery>
    const rows = await prisma.requestType.findMany({
      where: {
        deletedAt: null,
        ...(q.hoatDong ? { hoatDong: q.hoatDong === 'true' } : {}),
        ...(q.nhom ? { nhom: q.nhom } : {}),
      },
      include: service.requestTypeInclude,
      orderBy: [{ nhom: 'asc' }, { ten: 'asc' }],
    })
    const counts = await prisma.application.groupBy({
      by: ['requestTypeId'],
      where: { deletedAt: null },
      _count: { _all: true },
    })
    const map = new Map(counts.map((c) => [c.requestTypeId, c._count._all]))
    send(
      res,
      rows.map((r) => requestTypeDto(r, map.get(r.id) ?? 0)),
    )
  }),
)

requestTypeRouter.get(
  '/stats',
  authenticate,
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  asyncHandler(async (_req, res) => {
    const rows = await prisma.application.groupBy({
      by: ['requestTypeId'],
      where: { deletedAt: null },
      _count: { _all: true },
    })
    const types = await prisma.requestType.findMany({
      where: { deletedAt: null },
      select: { id: true, ten: true, ma: true },
    })
    const map = new Map(types.map((t) => [t.id, t]))
    send(
      res,
      rows
        .map((r) => {
          const t = map.get(r.requestTypeId)
          return { requestTypeId: r.requestTypeId, ten: t?.ten ?? '', ma: t?.ma ?? '', soLuong: r._count._all }
        })
        .sort((a, b) => b.soLuong - a.soLuong),
    )
  }),
)

requestTypeRouter.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  idempotent(),
  validate(requestTypeCreateBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof requestTypeCreateBody>
    send(res, await service.createRequestType({ user: requireUser(req), ...requestContext(req) }, body), 201)
  }),
)

requestTypeRouter.get(
  '/:id',
  authenticateOptional,
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    send(res, requestTypeDto(await service.loadRequestType(id)))
  }),
)

requestTypeRouter.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  idempotent(),
  validate(idParam, 'params'),
  validate(requestTypeBody),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const body = req.body as z.infer<typeof requestTypeBody>
    send(res, await service.updateRequestType({ user: requireUser(req), ...requestContext(req) }, id, body))
  }),
)

requestTypeRouter.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    await service.deleteRequestType({ user: requireUser(req), ...requestContext(req) }, id)
    res.status(204).end()
  }),
)

