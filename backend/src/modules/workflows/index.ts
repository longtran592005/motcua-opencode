import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { workflowDto } from '../shared/dto'

const idParam = z.object({ id: z.string().min(1).max(200) })

const include = {
  steps: { orderBy: { order: 'asc' as const } },
  requestTypes: { select: { id: true } },
}

export const workflowRouter: Router = Router()

workflowRouter.use(authenticate)

workflowRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.workflow.findMany({
      where: { deletedAt: null },
      include,
      orderBy: { ma: 'asc' },
    })
    send(res, rows.map(workflowDto))
  }),
)

workflowRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.workflow.findFirst({
      where: { ...(isUuid(id) ? { id } : { ma: id }), deletedAt: null },
      include,
    })
    if (!row) throw AppError.notFound('Không tìm thấy luồng duyệt.')
    send(res, workflowDto(row))
  }),
)
