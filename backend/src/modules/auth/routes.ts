import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { authLimiter } from '../../middleware/rateLimit'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { requestContext, requireUser } from '../../lib/context'
import * as service from './service'
import * as s from './schemas'

export const authRouter: Router = Router()

authRouter.post(
  '/login',
  authLimiter,
  validate(s.loginBody),
  asyncHandler(async (req, res) => {
    const body = req.body as { dinhDanh: string; matKhau: string }
    send(res, await service.login(requestContext(req), body))
  }),
)

authRouter.post(
  '/quick-login',
  authLimiter,
  validate(s.quickLoginBody),
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: Parameters<typeof service.quickLogin>[1] }
    send(res, await service.quickLogin(requestContext(req), role))
  }),
)

authRouter.post(
  '/refresh',
  authLimiter,
  validate(s.refreshBody),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string }
    send(res, await service.refresh(requestContext(req), refreshToken))
  }),
)

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const ctx = { ...requestContext(req), userId: requireUser(req).id }
    await service.logout(ctx)
    res.status(204).end()
  }),
)

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    send(res, await service.me(requireUser(req).id))
  }),
)

authRouter.patch(
  '/profile',
  authenticate,
  validate(s.updateProfileBody),
  asyncHandler(async (req, res) => {
    const ctx = { ...requestContext(req), userId: requireUser(req).id }
    const patch = req.body as { hoTen?: string; soDienThoai?: string; avatarUrl?: string }
    send(res, await service.updateProfile(ctx, patch))
  }),
)
