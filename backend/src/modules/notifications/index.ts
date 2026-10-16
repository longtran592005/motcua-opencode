import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { requireUser } from '../../lib/context'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { z } from 'zod'

const idParam = z.object({ id: z.string().min(1).max(200) })

function notificationDto(n: {
  id: string
  tieuDe: string
  noiDung: string
  loai: string
  nguoiNhanId: string
  applicationId: string | null
  maHoSo: string | null
  daDoc: boolean
  lienKet: string | null
  createdAt: Date
}) {
  return {
    id: n.id,
    tieuDe: n.tieuDe,
    noiDung: n.noiDung,
    loai: n.loai,
    nguoiNhanId: n.nguoiNhanId,
    ...(n.applicationId ? { applicationId: n.applicationId } : {}),
    ...(n.maHoSo ? { maHoSo: n.maHoSo } : {}),
    daDoc: n.daDoc,
    luc: n.createdAt.toISOString(),
    ...(n.lienKet ? { lienKet: n.lienKet } : {}),
  }
}

export const notificationRouter: Router = Router()

notificationRouter.use(authenticate)

notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const rows = await prisma.notification.findMany({
      where: { nguoiNhanId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    send(res, rows.map(notificationDto))
  }),
)

notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    send(res, await prisma.notification.count({ where: { nguoiNhanId: user.id, daDoc: false } }))
  }),
)

notificationRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    await prisma.notification.updateMany({
      where: { nguoiNhanId: user.id, daDoc: false },
      data: { daDoc: true },
    })
    res.status(204).end()
  }),
)

notificationRouter.post(
  '/:id/read',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const { id } = req.params as { id: string }
    const found = await prisma.notification.findFirst({ where: { id, nguoiNhanId: user.id } })
    if (!found) throw AppError.notFound('Không tìm thấy thông báo.')
    await prisma.notification.update({ where: { id }, data: { daDoc: true } })
    res.status(204).end()
  }),
)

notificationRouter.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const { id } = req.params as { id: string }
    const found = await prisma.notification.findFirst({ where: { id, nguoiNhanId: user.id } })
    if (!found) throw AppError.notFound('Không tìm thấy thông báo.')
    await prisma.notification.delete({ where: { id } })
    res.status(204).end()
  }),
)
