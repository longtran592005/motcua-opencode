import { Router } from 'express'
import { authRouter } from './modules/auth/routes'
import { applicationsRouter } from './modules/applications/routes'
import { approvalsRouter } from './modules/approvals/routes'
import { otpRouter } from './modules/otp/routes'
import { notificationRouter } from './modules/notifications'
import { auditRouter } from './modules/audit'
import { catalogRouter } from './modules/catalog'
import { documentRouter } from './modules/documents/routes'
import { libraryRouter } from './modules/library'
import { requestTypeRouter } from './modules/requestTypes'
import { workflowRouter } from './modules/workflows'
import { userRouter } from './modules/users'
import { publicRouter } from './modules/public/verify'
import { delegationRouter } from './modules/delegations'

/** Gốc API phiên bản 1 — mọi đường dẫn khớp docs/openapi.yaml. */
export const apiRouter: Router = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/applications', applicationsRouter)
apiRouter.use('/approvals', approvalsRouter)
apiRouter.use('/otp', otpRouter)
apiRouter.use('/delegations', delegationRouter)
apiRouter.use('/notifications', notificationRouter)
apiRouter.use('/audit-logs', auditRouter)
apiRouter.use('/catalog', catalogRouter)
apiRouter.use('/documents', documentRouter)
apiRouter.use('/library', libraryRouter)
apiRouter.use('/request-types', requestTypeRouter)
apiRouter.use('/workflows', workflowRouter)
apiRouter.use('/users', userRouter)
apiRouter.use('/public', publicRouter)
