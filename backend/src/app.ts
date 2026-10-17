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

  app.get('/health', async (_req, res) => {
    const { prisma } = await import('./lib/prisma')
    let db = false
    try {
      await prisma.$queryRaw`SELECT 1`
      db = true
    } catch {
      db = false
    }
    res.status(db ? 200 : 503).json({
      success: db,
      data: { ok: db, db, uptime: process.uptime() },
      error: db ? null : { code: 'DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu.' },
    })
  })

  app.use('/api/v1', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
