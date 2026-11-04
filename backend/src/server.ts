import { assertProductionSecrets, assertSignatureSecret, env } from './config/env'
import { createApp } from './app'
import { logger } from './lib/logger'
import { prisma } from './lib/prisma'
import { purgeExpiredIdempotencyKeys } from './middleware/idempotency'
import { runSlaJobSafe } from './modules/workflow/sla'
import { reloadKnowledgeIndex } from './modules/chatbot/retrieval'
import { clearChatAnswerCache } from './modules/chatbot/orchestrator'
import { getLlmProvider, warnIfModelMissing } from './modules/chatbot/llm/provider'

assertProductionSecrets()
// Quyết định Q2: từ chối khởi động nếu dùng khoá HMAC mặc định CHỈ-DÙNG-DEV ở
// môi trường không được phép (NODE_ENV chưa đặt, production, staging…).
assertSignatureSecret()

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

/* Chatbot: nạp chỉ mục truy xuất, cảnh báo tên mô hình, dọn dữ liệu cũ (3.5). */
const CHATBOT_FAIL_TIMEOUT_MS = 10 * 60 * 1000
void (async () => {
  try {
    // Chuyển các tài liệu PROCESSING quá 10 phút (hồ sơ treo khi khởi động lại) → FAILED.
    const cutoff = new Date(Date.now() - CHATBOT_FAIL_TIMEOUT_MS)
    const r = await prisma.knowledgeDocument.updateMany({
      where: { status: 'PROCESSING', updatedAt: { lt: cutoff } },
      data: { status: 'FAILED', errorMessage: 'Xử lý chưa hoàn tất khi khởi động lại.' },
    })
    if (r.count) logger.info({ count: r.count }, 'Chatbot: chuyển tài liệu PROCESSING treo → FAILED')
    const idx = await reloadKnowledgeIndex()
    logger.info({ chunks: idx.chunkCount, docs: idx.documentCount }, 'Chatbot: chỉ mục truy xuất đã nạp')
    clearChatAnswerCache()
  } catch (e) {
    logger.warn({ err: String(e) }, 'Chatbot: không nạp được chỉ mục lúc khởi động')
  }
  // Cảnh báo tên mô hình sai (không làm sập ứng dụng).
  void warnIfModelMissing(getLlmProvider())
})()

/** Dọn tin nhắn/hội thoại cũ hơn CHAT_RETENTION_DAYS (90 ngày mặc định). */
async function purgeOldChat(): Promise<void> {
  const cutoff = new Date(Date.now() - env.CHAT_RETENTION_DAYS * 24 * 3600_000)
  const sessions = await prisma.chatSession.deleteMany({ where: { updatedAt: { lt: cutoff } } })
  const feedback = await prisma.chatFeedback.deleteMany({ where: { createdAt: { lt: cutoff } } })
  logger.info({ sessions: sessions.count, feedback: feedback.count }, 'Chatbot: đã dọn dữ liệu quá hạn')
}
const retention = setInterval(() => void purgeOldChat().catch(() => {}), 24 * 3600_000)
void purgeOldChat().catch(() => {})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Đang tắt máy chủ…')
  clearInterval(cleanup)
  clearInterval(retention)
  if (sla) clearInterval(sla)
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
