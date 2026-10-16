import { Router } from 'express'
import { APPROVER_ROLES, authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent, IDEMPOTENCY_HEADER } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { requestContext, requireUser } from '../../lib/context'
import { applicationListQuery } from '../applications/schemas'
import * as service from './service'
import * as s from './schemas'

export const approvalsRouter: Router = Router()

approvalsRouter.use(authenticate, requireRole(...APPROVER_ROLES))

approvalsRouter.get(
  '/pending',
  validate(applicationListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const query = req.query as never as Parameters<typeof service.listPending>[1]
    const result = await service.listPending(user, query)
    sendPage(res, result.items, result)
  }),
)

approvalsRouter.get(
  '/processed',
  validate(applicationListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const query = req.query as never as Parameters<typeof service.listProcessed>[1]
    const result = await service.listProcessed(user, query)
    sendPage(res, result.items, result)
  }),
)

approvalsRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    send(res, await service.statsApproval(requireUser(req)))
  }),
)

approvalsRouter.get(
  '/overdue',
  validate(s.limitQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as never as { limit: number }
    send(res, await service.listOverdue(requireUser(req), limit))
  }),
)

approvalsRouter.get(
  '/pending-count',
  asyncHandler(async (req, res) => {
    send(res, await service.pendingCount(requireUser(req)))
  }),
)

approvalsRouter.post(
  '/batch',
  idempotent(),
  validate(s.batchApproveBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const body = req.body as never as Parameters<typeof service.approveBatch>[1]
    send(res, await service.approveBatch(ctx, body, req.header(IDEMPOTENCY_HEADER) ?? null))
  }),
)

approvalsRouter.post(
  '/:ma/approve',
  idempotent(),
  validate(s.maParam, 'params'),
  validate(s.approveBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const body = req.body as { ghiChu?: string; challengeId?: string; otp?: string }
    send(res, await service.approve(ctx, { maHoSo: ma, ...body }, req.header(IDEMPOTENCY_HEADER) ?? null))
  }),
)

approvalsRouter.post(
  '/:ma/reject',
  idempotent(),
  validate(s.maParam, 'params'),
  validate(s.rejectBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const { lyDo } = req.body as { lyDo: string }
    send(res, await service.reject(ctx, ma, lyDo))
  }),
)

approvalsRouter.post(
  '/:ma/request-supplement',
  idempotent(),
  validate(s.maParam, 'params'),
  validate(s.requestSupplementBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { ma } = req.params as { ma: string }
    const { noiDung } = req.body as { noiDung: string }
    send(res, await service.requestSupplement(ctx, ma, noiDung))
  }),
)

