import express, { type Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { corsOrigins } from './config/env'
import { logger } from './lib/logger'
import { requestId } from './middleware/requestId'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { globalLimiter } from './middleware/rateLimit'
import { apiRouter } from './routes'

/** Dựng ứng dụng Express — tách riêng để kiểm thử có thể dùng lại. */
export function createApp(): Express {
  const app = express()

  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(requestId)
  app.use(helmet())
  app.use(
    cors({
      origin: corsOrigins.length ? corsOrigins : true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: false }))
  app.use(globalLimiter)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  )

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { ok: true, uptime: process.uptime() }, error: null })
  })

  app.use('/api/v1', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
