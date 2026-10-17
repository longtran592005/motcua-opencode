import { assertProductionSecrets, env } from './config/env'
import { createApp } from './app'
import { logger } from './lib/logger'
import { prisma } from './lib/prisma'
import { purgeExpiredIdempotencyKeys } from './middleware/idempotency'
import { runSlaJobSafe } from './modules/workflow/sla'

assertProductionSecrets()

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Cổng Một cửa — API đã khởi động')
})

// Dọn khóa idempotency hết hạn mỗi giờ (khóa chỉ sống tối đa 24 giờ).
const cleanup = setInterval(() => {
  void purgeExpiredIdempotencyKeys().catch((e: unknown) =>
    logger.warn({ err: String(e) }, 'Không dọn được khóa idempotency hết hạn'),
  )
}, 3_600_000)

// Job SLA: nhắc trước hạn, đánh dấu quá hạn và leo thang lên cấp trên.
const sla = env.ENABLE_SLA_JOB
  ? setInterval(() => {
      void runSlaJobSafe()
    }, env.SLA_JOB_INTERVAL_SECONDS * 1000)
  : null

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Đang tắt máy chủ…')
  clearInterval(cleanup)
  if (sla) clearInterval(sla)
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
