import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { requestContext, requireUser } from '../../lib/context'
import { workflowDto } from '../shared/dto'
import * as service from './service'

const ROLES = ['SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'] as const

const idParam = z.object({ id: z.string().trim().min(1).max(200) })

const stepSchema = z.object({
  order: z.number().int().min(1).max(20).optional(),
  ten: z.string().trim().min(1, 'Thiếu tên bước.').max(300),
  role: z.enum(ROLES),
  mode: z.enum(['ONE_CLICK', 'OTP']),
  slaHours: z.number().int().min(1, 'Thời hạn xử lý phải lớn hơn 0 giờ.').max(2000),
  nhacTruocGio: z.number().int().min(0).max(1000).optional(),
  leoThangSauGio: z.number().int().min(0).max(1000).optional(),
  escalateTo: z.enum(ROLES).nullable().optional(),
  allowReject: z.boolean(),
  allowSupplement: z.boolean(),
  moTa: z.string().trim().max(1000).nullable().optional(),
})

const workflowBody = z.object({
  ma: z.string().trim().min(1).max(50).optional(),
  ten: z.string().trim().min(1).max(300).optional(),
  requestTypeIds: z.array(z.string().trim().min(1).max(200)).max(200).optional(),
  steps: z.array(stepSchema).max(service.TOI_DA_CAP_DUYET).optional(),
  hoatDong: z.boolean().optional(),
})

const workflowCreateBody = workflowBody.extend({
  ma: z.string().trim().min(1, 'Thiếu mã luồng duyệt.').max(50),
  ten: z.string().trim().min(1, 'Thiếu tên luồng duyệt.').max(300),
  steps: z.array(stepSchema).min(1, 'Luồng duyệt phải có ít nhất một bước.').max(service.TOI_DA_CAP_DUYET),
})

/**
 * Quy đổi danh sách loại đơn: chấp nhận CẢ mã nghiệp vụ lẫn UUID (quyết định B1),
 * kiểm tra trên bản ghi tìm được và trả về UUID.
 */
async function resolveRequestTypeIds(
  entries: string[] | undefined,
): Promise<string[] | undefined> {
  if (!entries) return undefined
  if (!entries.length) return []
  const rows = await prisma.requestType.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: { in: entries.filter(isUuid) } },
        { ma: { in: entries.filter((e) => !isUuid(e)) } },
      ],
    },
    select: { id: true, ma: true },
  })
  const thieu = entries.filter(
    (e) => !rows.some((r) => r.id === e || r.ma === e),
  )
  if (thieu.length) {
    throw AppError.notFound(`Không tìm thấy loại đơn: ${thieu.join(', ')}.`)
  }
  return rows.map((r) => r.id)
}

export const workflowRouter: Router = Router()

workflowRouter.use(authenticate)

workflowRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    send(res, await service.listWorkflows())
  }),
)

/** Kiểm tra cấu hình luồng duyệt mà không ghi gì. */
workflowRouter.post(
  '/validate',
  requireRole('ADMIN'),
  validate(workflowBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof workflowBody>
    send(res, service.kiemTraWorkflow(body))
  }),
)

workflowRouter.post(
  '/',
  requireRole('ADMIN'),
  idempotent(),
  validate(workflowCreateBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof workflowCreateBody>
    const requestTypeIds = await resolveRequestTypeIds(body.requestTypeIds)
    send(res, await service.createWorkflow({ user: requireUser(req), ...requestContext(req) }, { ...body, requestTypeIds }), 201)
  }),
)

workflowRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    send(res, workflowDto(await service.loadWorkflow(id)))
  }),
)

/** Sửa = tạo phiên bản mới; chỉ áp cho hồ sơ nộp sau. */
workflowRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  idempotent(),
  validate(idParam, 'params'),
  validate(workflowBody),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const body = req.body as z.infer<typeof workflowBody>
    const requestTypeIds = await resolveRequestTypeIds(body.requestTypeIds)
    send(
      res,
      await service.updateWorkflow(
        { user: requireUser(req), ...requestContext(req) },
        id,
        { ...body, requestTypeIds },
      ),
    )
  }),
)

workflowRouter.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    await service.deleteWorkflow({ user: requireUser(req), ...requestContext(req) }, id)
    res.status(204).end()
  }),
)
