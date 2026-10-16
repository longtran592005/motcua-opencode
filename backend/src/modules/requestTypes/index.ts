import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { requestTypeDto } from '../shared/dto'

const listQuery = z.object({
  hoatDong: z.enum(['true', 'false']).optional(),
  nhom: z.string().trim().max(200).optional(),
})
const idParam = z.object({ id: z.string().min(1).max(200) })

const include = {
  formFields: { orderBy: { order: 'asc' as const } },
  requiredDocs: true,
}

export const requestTypeRouter: Router = Router()

requestTypeRouter.use(authenticate)

requestTypeRouter.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuery>
    const rows = await prisma.requestType.findMany({
      where: {
        deletedAt: null,
        ...(q.hoatDong ? { hoatDong: q.hoatDong === 'true' } : {}),
        ...(q.nhom ? { nhom: q.nhom } : {}),
      },
      include,
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

requestTypeRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.requestType.findFirst({
      where: { ...(isUuid(id) ? { id } : { ma: id }), deletedAt: null },
      include,
    })
    if (!row) throw AppError.notFound('Không tìm thấy loại đơn.')
    send(res, requestTypeDto(row))
  }),
)
