import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { requestContext, requireUser } from '../../lib/context'
import { AppError } from '../../lib/errors'
import * as service from './service'

const idParam = z.object({ id: z.string().min(1).max(200) })
const revokeBody = z.object({
  lyDo: z.string().trim().min(1, 'Vui lòng nhập lý do thu hồi.').max(2000),
})

export const documentRouter: Router = Router()

documentRouter.use(authenticate)

documentRouter.get(
  '/',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  validate(service.documentListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as never as Parameters<typeof service.listIssued>[1]
    const result = await service.listIssued(requireUser(req), query)
    sendPage(res, result.items, result)
  }),
)

documentRouter.post(
  '/:id/revoke',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  idempotent(),
  validate(idParam, 'params'),
  validate(revokeBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { id } = req.params as { id: string }
    const { lyDo } = req.body as { lyDo: string }
    send(res, await service.revoke(ctx, id, lyDo))
  }),
)

documentRouter.post(
  '/:id/download-log',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { id } = req.params as { id: string }
    const doc = await service.logDownload(ctx, id)
    const { loadDocument } = service
    void loadDocument
    send(res, doc)
  }),
)

documentRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const doc = await service.loadDocument(id)
    if (doc.application.applicantId !== requireUser(req).id && requireUser(req).role === 'SINH_VIEN') {
      throw AppError.forbidden('Bạn không có quyền truy cập văn bản này.')
    }
    const { signedDocumentDto } = await import('./dto')
    send(res, signedDocumentDto(doc, { mask: false }))
  }),
)
