import { Router } from 'express'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { requestContext, requireUser } from '../../lib/context'
import * as service from './service'
import * as s from './schemas'
import * as documentService from '../documents/service'

export const applicationsRouter: Router = Router()

applicationsRouter.use(authenticate)

const onlyStudent = requireRole('SINH_VIEN')

applicationsRouter.get(
  '/mine',
  validate(s.applicationListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const query = req.query as never as Parameters<typeof service.listMine>[1]
    const result = await service.listMine(user, query)
    sendPage(res, result.items, result)
  }),
)

applicationsRouter.get(
  '/mine/recent',
  validate(s.recentQuery, 'query'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const { limit } = req.query as never as { limit: number }
    send(res, await service.recentMine(user, limit))
  }),
)

applicationsRouter.get(
  '/mine/stats',
  asyncHandler(async (req, res) => {
    send(res, await service.statsMine(requireUser(req)))
  }),
)

applicationsRouter.post(
  '/',
  onlyStudent,
  idempotent(),
  validate(s.createApplicationBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const body = req.body as never as Parameters<typeof service.createDraft>[1]
    send(res, await service.createDraft(ctx, body), 201)
  }),
)

applicationsRouter.get(
  '/:ma/next-approver-roles',
  validate(s.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { ma } = req.params as { ma: string }
    send(res, await service.nextApproverRoles(ma, requireUser(req)))
  }),
)

applicationsRouter.get(
  '/:ma/document',
  validate(s.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { ma } = req.params as { ma: string }
    send(res, await documentService.getByApplication(requireUser(req), ma))
  }),
)

applicationsRouter.get(
  '/:ma',
  validate(s.idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { ma } = req.params as { ma: string }
    send(res, await service.getByCode(ma, requireUser(req)))
  }),
)

applicationsRouter.put(
  '/:ma',
  onlyStudent,
  idempotent(),
  validate(s.updateApplicationBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const body = req.body as never as Parameters<typeof service.updateDraft>[2]
    send(res, await service.updateDraft(ctx, ma, body))
  }),
)

applicationsRouter.delete(
  '/:ma',
  onlyStudent,
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    await service.deleteDraft(ctx, ma)
    res.status(204).end()
  }),
)

applicationsRouter.post(
  '/:ma/submit',
  onlyStudent,
  idempotent(),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    send(res, await service.submit(ctx, ma))
  }),
)

applicationsRouter.post(
  '/:ma/cancel',
  onlyStudent,
  idempotent(),
  validate(s.cancelBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const { lyDo } = req.body as { lyDo?: string }
    send(res, await service.cancel(ctx, ma, lyDo))
  }),
)

applicationsRouter.post(
  '/:ma/supplement',
  onlyStudent,
  idempotent(),
  validate(s.supplementBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const body = req.body as never as Parameters<typeof service.supplement>[2]
    send(res, await service.supplement(ctx, ma, body))
  }),
)
