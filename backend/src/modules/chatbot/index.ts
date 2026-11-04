/**
 * Router chatbot: hỏi đáp SSE, đánh giá, xác nhận bản nháp từ đề xuất,
 * chuyển cán bộ (handoff), quản trị kiến thức, thống kê.
 * Quyền (Q4): mọi endpoint cần đăng nhập; tra cứu đơn chỉ SINH_VIEN (trong
 * tools); quản trị kiến thức/inbox/thống kê cho ADMIN và PHONG_DAO_TAO.
 */
import { Router } from 'express'
import express from 'express'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Prisma } from '@prisma/client'
import { Prisma as PrismaDb } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { asyncHandler } from '../../middleware/errorHandler'
import { authenticate, requireRole } from '../../middleware/auth'
import { send, sendError } from '../../lib/envelope'
import { requestContext } from '../../lib/context'
import { recordAudit } from '../../lib/audit'
import { pushNotification, notifyRole } from '../../lib/notify'
import { orchestrate, clearChatAnswerCache, type ChatOutcome } from './orchestrator'
import { reloadKnowledgeIndex } from './retrieval'
import { findActionForUser, markActionUsed } from './actions'
import { ingestDocumentContent, extractTextFromFile, sha256, slugify } from './ingest'
import { getLlmProvider } from './llm/provider'
import { env } from '../../config/env'

export const chatbotRouter: Router = Router()

const STAFF: Parameters<typeof requireRole>[0][] = ['PHONG_DAO_TAO', 'ADMIN']

/* ------------------------------------------------------------------ *
 * Gợi ý câu hỏi nhanh
 * ------------------------------------------------------------------ */

const SUGGESTIONS = [
  'Em cần giấy xác nhận sinh viên thì làm thế nào?',
  'Đơn xin hoãn thi nộp ở đâu và khi nào nhận kết quả?',
  'Xin bảng điểm chứa chấp quá trình gửi cho em loại đơn nào?',
  'Tra cứu trạng thái đơn của em.',
  'Em muốn tạo bản nháp đơn xin nghỉ học.',
]

chatbotRouter.get(
  '/suggestions',
  authenticate,
  asyncHandler(async (_req, res) => {
    send(res, SUGGESTIONS)
  }),
)

/* ------------------------------------------------------------------ *
 * Hỏi đáp — POST /chat/stream (SSE, không bọc phong bì)
 * ------------------------------------------------------------------ */

function sseChunk(res: import('express').Response, obj: unknown): void {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

/** Chia câu trả lời thành các mảnh "token" nhỏ để stream (câu trả lời đã tính đủ). */
function trickle(answer: string): string[] {
  const words = answer.split(/\s+/)
  const chunks: string[] = []
  let cur: string[] = []
  for (const w of words) {
    cur.push(w)
    if (cur.join(' ').length >= 24) {
      chunks.push(cur.join(' '))
      cur = []
    }
  }
  if (cur.length) chunks.push(cur.join(' '))
  return chunks
}

const streamBody = z.object({
  cauHoi: z.string().trim().min(1).max(1000),
  sessionId: z.string().uuid().optional(),
})

chatbotRouter.post(
  '/stream',
  authenticate,
  express.json({ limit: '64kb' }),
  asyncHandler(async (req, res) => {
    const parsed = streamBody.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw AppError.validation('Câu hỏi tối đa 1000 ký tự và không để trống.')
    }
    let outcome: ChatOutcome
    try {
      outcome = await orchestrate({ user: req.user!, question: parsed.data.cauHoi, sessionId: parsed.data.sessionId })
    } catch (e) {
      // Lỗi trước khi stream: trả phong bì lỗi đúng chuẩn (429/422/...).
      const err = e as { code?: string; status?: number; details?: Record<string, unknown>; message?: string }
      const status = err.status ?? 500
      const code = err.code === 'VALIDATION_ERROR' ? 'VALIDATION_ERROR' : (err.code ?? 'UNKNOWN')
      sendError(res, status, code as Parameters<typeof sendError>[2], err.message ?? 'Lỗi hệ thống', err.details)
      return
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    })
    for (const piece of trickle(outcome.answer)) sseChunk(res, { loai: 'token', noiDung: piece })
    sseChunk(res, {
      loai: 'nguon',
      nguon: outcome.sources,
      ...(outcome.goiYForm ? { goiYForm: outcome.goiYForm } : {}),
      hanhDong: outcome.actions,
      cheDo: outcome.mode,
      sessionId: outcome.sessionId,
      userMessageId: outcome.userMessageId,
    })
    sseChunk(res, {
      loai: 'xong',
      traLoiDayDu: outcome.answer,
      messageId: outcome.messageId,
      sessionId: outcome.sessionId,
      cheDo: outcome.mode,
      timeMs: outcome.latencyMs,
    })
    res.write('data: [DONE]\n\n')
    res.end()
  }),
)

/* ------------------------------------------------------------------ *
 * Đánh giá tin nhắn
 * ------------------------------------------------------------------ */

const feedbackBody = z.object({
  huuIch: z.boolean(),
  binhLuan: z.string().trim().max(1000).optional(),
})

chatbotRouter.post(
  '/messages/:id/feedback',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = feedbackBody.parse(req.body ?? {})
    // Chỉ tin nhắn của chính người dùng (chống IDOR).
    const msg = await prisma.chatMessage.findFirst({
      where: { id: req.params.id, session: { userId: req.user!.id } },
      select: { id: true },
    })
    if (!msg) throw AppError.notFound('Không tìm thấy tin nhắn.')
    await prisma.$transaction([
      prisma.chatFeedback.upsert({
        where: { messageId_userId: { messageId: msg.id, userId: req.user!.id } },
        create: {
          messageId: msg.id,
          userId: req.user!.id,
          rating: body.huuIch ? 'UP' : 'DOWN',
          comment: body.binhLuan ?? null,
        },
        update: { rating: body.huuIch ? 'UP' : 'DOWN', comment: body.binhLuan ?? null },
      }),
      prisma.chatMessage.update({ where: { id: msg.id }, data: { huuIch: body.huuIch } }),
    ])
    send(res, { daLuu: true }, 200)
  }),
)

/* ------------------------------------------------------------------ *
 * Lịch sử hội thoại (chỉ của chính người dùng)
 * ------------------------------------------------------------------ */

chatbotRouter.get(
  '/sessions/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: { id: true, tieuDe: true, createdAt: true, updatedAt: true },
    })
    send(res, sessions)
  }),
)

chatbotRouter.get(
  '/sessions/:id/messages',
  authenticate,
  asyncHandler(async (req, res) => {
    const own = await prisma.chatSession.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!own) throw AppError.notFound('Không tìm thấy phiên hội thoại.')
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: own.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })
    send(res, messages)
  }),
)

/* ------------------------------------------------------------------ *
 * Xác nhận hành động: tạo BẢN NHÁP đơn (KHÔNG nộp)
 * ------------------------------------------------------------------ */

async function handleConfirmDraft(req: import('express').Request, res: import('express').Response): Promise<void> {
  const userId = req.user!.id
  const actionId = String(req.params.actionId ?? '')
  const action = await findActionForUser(userId, actionId)
  if (!action) throw AppError.notFound('Không tìm thấy hành động.')
  if (action.daDung) throw new AppError('DUPLICATE_ACTION', 'Hành động này đã được thực hiện.')
  if (new Date(action.expiresAt).getTime() < Date.now()) throw AppError.validation('Hành động đã hết hạn (24 giờ).')
  if (action.kieu !== 'DRAFT_PROPOSAL' || !action.maLoiDon) {
    throw AppError.validation('Hành động không phải là đề xuất bản nháp.')
  }
  // Tạo bản nháp bằng hàm có sẵn của module applications (không viết lại logic nghiệp vụ).
  const { createDraft } = await import('../applications/service')
  // Action đề xuất mang MÃ loại đơn (VD "GD-BANG-DIEM"); createDraft cần id UUID.
  const rt = await prisma.requestType.findFirst({
    where: { ma: action.maLoiDon, deletedAt: null },
    select: { id: true, hoatDong: true },
  })
  if (!rt || !rt.hoatDong) {
    throw AppError.validation('Loại đơn trong đề xuất không còn nhận hồ sơ.')
  }
  const ctx = { ...requestContext(req), user: req.user! }
  const duLieu: Record<string, string> = {}
  for (const f of action.cacTruong ?? []) {
    if (f.giaTriGoiY) duLieu[f.ten] = String(f.giaTriGoiY)
  }
  const draft = await createDraft(ctx, { requestTypeId: rt.id, duLieu, tepDinhKem: [] })
  await markActionUsed(userId, actionId)
  await recordAudit({
    nguoiThucHien: { id: userId, hoTen: req.user!.hoTen, role: req.user!.role },
    hanhDong: 'CHATBOT_DRAFT_CONFIRM',
    doiTuong: 'application',
    doiTuongId: draft.maHoSo,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
  send(res, { maHoSo: draft.maHoSo, duongDan: `/ho-so/${draft.maHoSo}`, trangThai: 'DRAFT' }, 201)
}

chatbotRouter.post(
  '/actions/:actionId/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    await handleConfirmDraft(req, res)
  }),
)

/* ------------------------------------------------------------------ *
 * Chuyển câu hỏi cho cán bộ (handoff)
 * ------------------------------------------------------------------ */

const handoffBody = z.object({
  sessionId: z.string().uuid().optional(),
  cauHoi: z.string().trim().max(2000).optional(),
})

async function handoffCountToday(userId: string): Promise<number> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  return prisma.chatHandoff.count({ where: { userId, createdAt: { gte: dayStart } } })
}

chatbotRouter.post(
  '/handoffs',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = handoffBody.parse(req.body ?? {})
    const count = await handoffCountToday(req.user!.id)
    if (count >= env.CHAT_HANDOFF_PER_DAY) {
      throw new AppError('RATE_LIMITED', 'Bạn đã gửi đủ 5 câu hỏi chuyển lên cán bộ hôm nay.', { retryAfter: 3600 })
    }
    let question = body.cauHoi ?? ''
    let context = ''
    if (body.sessionId) {
      const own = await prisma.chatSession.findFirst({ where: { id: body.sessionId, userId: req.user!.id } })
      if (own) {
        const msgs = await prisma.chatMessage.findMany({
          where: { sessionId: own.id },
          orderBy: { createdAt: 'desc' },
          take: 4,
        })
        context = msgs
          .reverse()
          .map((m) => `${m.vaiTro === 'USER' ? 'SV' : 'TL'}: ${m.noiDung.slice(0, 350)}`)
          .join('\n')
          .slice(0, 1500)
      }
    }
    if (!question) {
      // Không truyền câu hỏi: dùng tin nhắn USER gần nhất của phiên/người dùng.
      const last = await prisma.chatMessage.findFirst({
        where: { session: { userId: req.user!.id }, vaiTro: 'USER' },
        orderBy: { createdAt: 'desc' },
        select: { noiDung: true },
      })
      question = last?.noiDung ?? ''
    }
    if (!question.trim()) throw AppError.validation('Không có câu hỏi để chuyển lên cán bộ.')

    // Mã CH-YYYY-NNNNNN từ sequence — tạo trực tiếp với mã hợp lệ (CHECK ma_format).
    const rows = await prisma.$queryRaw<{ ma: string }[]>`SELECT next_ma_chat_handoff() AS ma`
    const ma = rows[0]?.ma ?? `CH-${new Date().getFullYear()}-999999`
    const handoff = await prisma.chatHandoff.create({
      data: {
        ma,
        userId: req.user!.id,
        sessionId: body.sessionId ?? null,
        question: question.slice(0, 2000),
        context,
      },
    })

    // Thông báo cho cán bộ PHONG_DAO_TAO (Q4).
    await notifyRole('PHONG_DAO_TAO', {
      tieuDe: `Câu hỏi chatbot mới ${ma}`,
      noiDung: `Sinh viên ${req.user!.hoTen} đã gửi câu hỏi chatbot cần hỗ trợ: ${question.slice(0, 120)}`,
      loai: 'WARNING',
      lienKet: '/quan-ly/cau-hoi-chatbot',
    })
    send(res, { ma: handoff.ma, trangThai: handoff.status }, 201)
  }),
)

chatbotRouter.get(
  '/handoffs/mine',
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await prisma.chatHandoff.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    send(res, rows)
  }),
)

/* ------------------------------------------------------------------ *
 * Cán bộ: inbox / trả lời / đưa vào FAQ
 * ------------------------------------------------------------------ */

chatbotRouter.get(
  '/handoffs/inbox',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const trangThai = (req.query.trangThai as string | undefined) ?? 'OPEN'
    const rows = await prisma.chatHandoff.findMany({
      where: {
        ...(trangThai === 'ALL' ? {} : { status: trangThai as 'OPEN' | 'ANSWERED' | 'CLOSED' }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    send(res, rows)
  }),
)

const answerBody = z.object({ cauTraLoi: z.string().trim().min(1).max(5000) })

chatbotRouter.post(
  '/handoffs/:ma/answer',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const body = answerBody.parse(req.body ?? {})
    const row = await prisma.chatHandoff.findFirst({ where: { ma: req.params.ma } })
    if (!row) throw AppError.notFound('Không tìm thấy câu hỏi chuyển lên.')
    const updated = await prisma.chatHandoff.update({
      where: { id: row.id },
      data: { status: 'ANSWERED', answer: body.cauTraLoi, answeredBy: req.user!.id, answeredAt: new Date() },
    })
    await pushNotification({
      nguoiNhanId: row.userId,
      tieuDe: `Cán bộ đã trả lời câu hỏi ${row.ma}`,
      noiDung: body.cauTraLoi.slice(0, 300),
      loai: 'SUCCESS',
      lienKet: '/tro-giup',
    })
    await recordAudit({
      nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
      hanhDong: 'CHATBOT_HANDOFF_ANSWER',
      doiTuong: 'chat_handoff',
      doiTuongId: row.ma,
      giaTriSau: 'ANSWERED',
      diaChiIp: requestContext(req).ip,
      thietBi: requestContext(req).userAgent,
    })
    send(res, { ma: updated.ma, trangThai: updated.status }, 200)
  }),
)

chatbotRouter.post(
  '/handoffs/:ma/to-faq',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const row = await prisma.chatHandoff.findFirst({ where: { ma: req.params.ma } })
    if (!row) throw AppError.notFound('Không tìm thấy câu hỏi chuyển lên.')
    if (!row.answer) throw AppError.validation('Câu hỏi này chưa được trả lời.')
    const docCode = `KB-${slugify(row.question.slice(0, 30))}-${sha256(row.question).slice(0, 8)}`
    const doc = await prisma.knowledgeDocument.upsert({
      where: { ma: docCode },
      create: {
        ma: docCode,
        title: row.question.slice(0, 300),
        sourceType: 'FAQ',
        contentHash: sha256(row.question + row.answer),
        status: 'PROCESSING',
        uploadedBy: req.user!.id,
      },
      update: { contentHash: sha256(row.question + row.answer), status: 'PROCESSING', errorMessage: null, deletedAt: null },
    })
    const text = `CÂU HỎI THƯỜNG GẶP. Câu hỏi: ${row.question}. Trả lời: ${row.answer}`
    await ingestDocumentContent({
      documentId: doc.id,
      title: doc.title,
      text,
      embedder: getLlmProvider().available() ? getLlmProvider() : null,
    })
    await reloadKnowledgeIndex()
    clearChatAnswerCache()
    await recordAudit({
      nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
      hanhDong: 'CHATBOT_HANDOFF_TO_FAQ',
      doiTuong: 'knowledge_document',
      doiTuongId: docCode,
      giaTriSau: 'FAQ',
      diaChiIp: requestContext(req).ip,
      thietBi: requestContext(req).userAgent,
    })
    send(res, { ma: docCode }, 201)
  }),
)

/* ------------------------------------------------------------------ *
 * Quản trị kiến thức
 * ------------------------------------------------------------------ */

chatbotRouter.get(
  '/knowledge',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (_req, res) => {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, ma: true, title: true, sourceType: true, status: true, mime: true,
        version: true, contentHash: true, errorMessage: true, libraryDocumentId: true,
        createdAt: true, updatedAt: true,
        _count: { select: { chunks: true } },
      },
    })
    send(res, docs)
  }),
)

const knowledgeBody = z.discriminatedUnion('kieu', [
  // FAQ gõ trực tiếp.
  z.object({
    kieu: z.literal('FAQ'),
    tieuDe: z.string().trim().min(1).max(300),
    noiDung: z.string().trim().min(1).max(8000),
  }),
  // Tệp pdf/docx/txt/md tối đa 10MB (base64).
  z.object({
    kieu: z.literal('FILE'),
    taiKhoan: z.string().optional(),
    ten: z.string().trim().min(1).max(300),
    mime: z.enum(['pdf', 'docx', 'doc', 'txt', 'md']),
    noiDung: z.string().max(14 * 1024 * 1024), // base64 ~ 10.5MB tệp
  }),
])

/** Kiểm tra magic bytes (mặc dù đuôi khai báo đúng). */
function magicCheck(buf: Buffer, mime: string): boolean {
  if (mime === 'pdf') return buf.slice(0, 5).toString('latin1') === '%PDF-'
  if (mime === 'docx') return buf.slice(0, 4).toString('hex') === '504b0304' // PK
  if (mime === 'doc') return buf.slice(0, 4).toString('hex') === 'd0cf11e0'
  // txt/md: không chứa NUL byte.
  return !buf.slice(0, 8000).includes(0)
}

chatbotRouter.post(
  '/knowledge',
  authenticate,
  requireRole(...STAFF),
  express.json({ limit: '16mb' }),
  asyncHandler(async (req, res) => {
    const body = knowledgeBody.parse(req.body ?? {})
    const provider = getLlmProvider()
    const embedder = provider.available() ? provider : null

    if (body.kieu === 'FAQ') {
      const docCode = `KB-${slugify(body.tieuDe)}-${sha256(body.noiDung).slice(0, 8)}`
      const doc = await prisma.knowledgeDocument.create({
        data: {
          ma: docCode,
          title: body.tieuDe,
          sourceType: 'FAQ',
          contentHash: sha256(body.noiDung),
          status: 'PROCESSING',
          uploadedBy: req.user!.id,
        },
      })
      await ingestDocumentContent({ documentId: doc.id, title: doc.title, text: `${body.tieuDe}\n${body.noiDung}`, embedder })
      await reloadKnowledgeIndex()
      clearChatAnswerCache()
      await recordAudit({
        nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
        hanhDong: 'CHATBOT_KNOWLEDGE_CREATE',
        doiTuong: 'knowledge_document',
        doiTuongId: docCode,
        giaTriSau: 'FAQ',
        diaChiIp: requestContext(req).ip,
        thietBi: requestContext(req).userAgent,
      })
      send(res, { ma: docCode }, 201)
      return
    }

    // Tệp tải lên.
    const buf = Buffer.from(body.noiDung, 'base64')
    if (buf.byteLength === 0) throw AppError.validation('Tệp rỗng hoặc giải mã base64 thất bại.')
    if (buf.byteLength > 10 * 1024 * 1024) throw AppError.validation('Tệp tối đa 10MB.')
    if (!magicCheck(buf, body.mime)) {
      throw AppError.validation('Tệp không đúng định dạng thật (kiểm tra magic bytes thất bại).')
    }
    const tmp = path.join(os.tmpdir(), `chatbot-${randomUUID()}.${body.mime}`)
    fs.writeFileSync(tmp, buf)
    try {
      const extracted = await extractTextFromFile(tmp, body.mime)
      const text = extracted?.text ?? ''
      const docCode = `KB-${slugify(body.ten)}-${sha256(buf.toString('latin1').slice(0, 8192)).slice(0, 8)}`
      const existed = await prisma.knowledgeDocument.findUnique({ where: { ma: docCode } })
      if (existed?.status === 'READY' && !existed.deletedAt && existed.contentHash === sha256(text)) {
        send(res, { ma: docCode, trung: true }, 200)
        return
      }
      const doc = await prisma.knowledgeDocument.upsert({
        where: { ma: docCode },
        create: {
          ma: docCode,
          title: body.ten,
          sourceType: 'UPLOAD',
          storageKey: tmp.slice(0), // tệp tạm đã xóa; chỉ ghi dấu
          mime: body.mime,
          contentHash: sha256(text),
          status: 'PROCESSING',
          uploadedBy: req.user!.id,
        },
        update: { title: body.ten, contentHash: sha256(text), status: 'PROCESSING', errorMessage: null, deletedAt: null },
      })
      if (text.trim().length < 40) {
        await prisma.knowledgeDocument.update({
          where: { id: doc.id },
          data: { status: 'FAILED', errorMessage: 'Không đọc được nội dung tệp (chỉ có thẻ tên)."'.replace('"', '') },
        })
        throw AppError.validation('Không đọc được nội dung tệp. Chỉ hỗ trợ pdf/docx/txt/md có văn bản.')
      }
      await ingestDocumentContent({ documentId: doc.id, title: doc.title, text, pages: extracted?.pages, embedder })
      await reloadKnowledgeIndex()
      clearChatAnswerCache()
      await recordAudit({
        nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
        hanhDong: 'CHATBOT_KNOWLEDGE_UPLOAD',
        doiTuong: 'knowledge_document',
        doiTuongId: docCode,
        giaTriSau: `UPLOAD ${body.mime}`,
        diaChiIp: requestContext(req).ip,
        thietBi: requestContext(req).userAgent,
      })
      send(res, { ma: docCode }, 201)
    } finally {
      fs.unlink(tmp, () => {})
    }
  }),
)

chatbotRouter.patch(
  '/knowledge/:ma',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        batHieuLuc: z.boolean().optional(),
        tieuDe: z.string().trim().min(1).max(300).optional(),
      })
      .parse(req.body ?? {})
    const doc = await prisma.knowledgeDocument.findUnique({ where: { ma: req.params.ma } })
    if (!doc || doc.deletedAt) throw AppError.notFound('Không tìm thấy tài liệu kiến thức.')
    const updated = await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: {
        ...(body.batHieuLuc !== undefined ? { status: body.batHieuLuc ? 'READY' as const : 'DISABLED' as const } : {}),
        ...(body.tieuDe ? { title: body.tieuDe } : {}),
      },
    })
    await reloadKnowledgeIndex()
    clearChatAnswerCache()
    await recordAudit({
      nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
      hanhDong: 'CHATBOT_KNOWLEDGE_UPDATE',
      doiTuong: 'knowledge_document',
      doiTuongId: doc.ma,
      giaTriTruoc: doc.status,
      giaTriSau: updated.status,
      diaChiIp: requestContext(req).ip,
      thietBi: requestContext(req).userAgent,
    })
    send(res, { ma: updated.ma, trangThai: updated.status }, 200)
  }),
)

chatbotRouter.delete(
  '/knowledge/:ma',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const doc = await prisma.knowledgeDocument.findUnique({ where: { ma: req.params.ma } })
    if (!doc || doc.deletedAt) throw AppError.notFound('Không tìm thấy tài liệu kiến thức.')
    await prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } })
    await reloadKnowledgeIndex()
    clearChatAnswerCache()
    await recordAudit({
      nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
      hanhDong: 'CHATBOT_KNOWLEDGE_DELETE',
      doiTuong: 'knowledge_document',
      doiTuongId: doc.ma,
      diaChiIp: requestContext(req).ip,
      thietBi: requestContext(req).userAgent,
    })
    send(res, { daXoa: true }, 200)
  }),
)

chatbotRouter.post(
  '/knowledge/reindex',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (req, res) => {
    const provider = getLlmProvider()
    const embedder = provider.available() ? provider : null
    // Bù embedding cho các chunk chưa có (chỉ khi có khóa).
    let daBu = 0
    if (embedder) {
      const chunks = await prisma.knowledgeChunk.findMany({
        where: { document: { status: 'READY', deletedAt: null } },
        select: { id: true, content: true, embedding: true },
        take: 400,
      })
      const thieu = chunks.filter((c) => !Array.isArray(c.embedding) || c.embedding.length === 0)
      for (let i = 0; i < thieu.length; i += 16) {
        const slice = thieu.slice(i, i + 16)
        try {
          const vecs = await embedder.embed(slice.map((c) => c.content))
          if (vecs.length === slice.length) {
            await prisma.$transaction(
              slice.map((c, j) =>
                prisma.knowledgeChunk.update({ where: { id: c.id }, data: { embedding: vecs[j] } }),
              ),
            )
            daBu += slice.length
          }
        } catch {
          break
        }
      }
    }
    const r = await reloadKnowledgeIndex()
    clearChatAnswerCache()
    await recordAudit({
      nguoiThucHien: { id: req.user!.id, hoTen: req.user!.hoTen, role: req.user!.role },
      hanhDong: 'CHATBOT_REINDEX',
      doiTuong: 'knowledge_index',
      doiTuongId: 'chat',
      giaTriSau: JSON.stringify(r),
      diaChiIp: requestContext(req).ip,
      thietBi: requestContext(req).userAgent,
    })
    send(res, { chunkCount: r.chunkCount, documentCount: r.documentCount, embeddingBuSung: daBu }, 200)
  }),
)

/* ------------------------------------------------------------------ *
 * Thống kê
 * ------------------------------------------------------------------ */

chatbotRouter.get(
  '/stats',
  authenticate,
  requireRole(...STAFF),
  asyncHandler(async (_req, res) => {
    const weekStart = new Date(Date.now() - 7 * 24 * 3600_000)
    const [hoiTrongTuan, coNguonTrongTuan, khongTimThayTrongTuan, handoffSo, handoffDaTraLoi, up, down] = await Promise.all([
      prisma.chatMessage.count({ where: { vaiTro: 'USER', createdAt: { gte: weekStart } } }),
      prisma.chatMessage.count({ where: { vaiTro: 'ASSISTANT', createdAt: { gte: weekStart }, nguon: { not: PrismaDb.AnyNull } } }),
      prisma.chatMessage.count({
        where: { vaiTro: 'ASSISTANT', createdAt: { gte: weekStart }, noiDung: { contains: 'chưa tìm thấy' } },
      }),
      prisma.chatHandoff.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.chatHandoff.count({ where: { createdAt: { gte: weekStart }, status: 'ANSWERED' } }),
      prisma.chatFeedback.count({ where: { rating: 'UP' } }),
      prisma.chatFeedback.count({ where: { rating: 'DOWN' } }),
    ])
    const hoiTheoNgay = await prisma.$queryRaw<{ ngay: Date; so: bigint }[]>`
      SELECT date_trunc('day', created_at)::date AS ngay, COUNT(*)::bigint AS so
      FROM chat_messages
      WHERE vai_tro = 'USER' AND created_at >= ${weekStart}
      GROUP BY 1 ORDER BY 1`
    const khongTimThayGanNhat = await prisma.chatMessage.findMany({
      where: { vaiTro: 'USER', createdAt: { gte: weekStart } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, noiDung: true, createdAt: true },
    })
    // 10 tài liệu được trích nhiều nhất (quét jsonb nguồn).
    let topDocs: Array<{ ten: string; soDuocTrich: number }> = []
    try {
      const rows = await prisma.$queryRaw<{ ten: string; so: bigint }[]>`
        SELECT elem->>'tenFile' AS ten, COUNT(*)::bigint AS so
        FROM chat_messages m, jsonb_array_elements(m.nguon) elem
        WHERE m.vai_tro = 'ASSISTANT' AND m.nguon IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`
      topDocs = rows.map((r) => ({ ten: r.ten, soDuocTrich: Number(r.so) }))
    } catch {
      topDocs = []
    }
    send(res, {
      hoiTrongTuan,
      tyLeCoNguon: hoiTrongTuan ? Number((coNguonTrongTuan / hoiTrongTuan).toFixed(3)) : 0,
      tyLeKhongTimThay: hoiTrongTuan ? Number((khongTimThayTrongTuan / hoiTrongTuan).toFixed(3)) : 0,
      handoffSo,
      handoffDaTraLoi,
      huuIch: up,
      khongHuuIch: down,
      hoiTheoNgay: hoiTheoNgay.map((d) => ({ ngay: d.ngay, so: Number(d.so) })),
      khongTimThayGanNhat: khongTimThayGanNhat.map((m) => ({ id: m.id, cauHoi: m.noiDung.slice(0, 200), lucHoi: m.createdAt })),
      topDocs,
    })
  }),
)
