import { Router } from 'express'
import { APPROVER_ROLES, authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { requireUser } from '../../lib/context'
import { AppError } from '../../lib/errors'
import { loadApplication } from '../applications/service'
import { assertCanApprove } from '../approvals/service'
import * as s from '../approvals/schemas'
import * as service from './service'

export const otpRouter: Router = Router()

otpRouter.use(authenticate, requireRole(...APPROVER_ROLES))

otpRouter.post(
  '/send',
  validate(s.otpSendBody),
  asyncHandler(async (req, res) => {
    const user = requireUser(req)
    const { maHoSo } = req.body as { maHoSo: string }
    const app = await loadApplication(maHoSo)
    const si = assertCanApprove(app, user)
    if (si.mode !== 'OTP') {
      throw AppError.validation('Bước xử lý hiện tại không yêu cầu ký OTP.')
    }
    send(
      res,
      await service.createChallenge({
        userId: user.id,
        applicationId: app.id,
        stepOrder: si.stepOrder,
      }),
    )
  }),
)

otpRouter.get(
  '/:id',
  validate(s.otpIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    send(res, await service.statusChallenge(id, requireUser(req).id))
  }),
)

otpRouter.post(
  '/:id/resend',
  validate(s.otpIdParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    send(res, await service.resendChallenge(id, requireUser(req).id))
  }),
)
