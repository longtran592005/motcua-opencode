/**
 * Điều phối trả lời (3.2). Chuỗi: giới hạn tần suất → kiểm tra độ dài →
 * che PII → truy xuất lai → gọi công cụ (tối đa 3 vòng, tổng 20 giây) → gọi
 * mô hình (JSON {answer, can_answer, cited_source_ids, tool?}) → hậu xử lý
 * (chỉ chấp nhận nguồn thuộc tập truy xuất, loại URL lạ, hành động do SERVER
 * dựng) → lưu tin nhắn → phát SSE stream.
 *
 * Suy giảm (3.5): không khóa / 429 / lỗi mô hình → CHẾ ĐỘ CHỈ-TÌM-KIẾM
 * (SEARCH_ONLY), thử lại 1 lần khi 429, không trả lỗi trần trụi.
 */
import { prisma } from '../../lib/prisma'
import { env } from '../../config/env'
import { AppError } from '../../lib/errors'
import { maskPii } from './privacy'
import { searchKnowledge, type SearchResult } from './retrieval'
import { SYSTEM_PROMPT } from './prompts'
import { cacheKey } from './vietnamese'
import { getLlmProvider, LlmError, type LLMProvider } from './llm/provider'
import { makeAction, type ChatAction } from './actions'
import type { Prisma } from '@prisma/client'
import {
  get_application_status,
  get_my_applications,
  propose_draft,
  suggest_request_types,
} from './tools'

/* ---------------- Hạn mức (3.5) ---------------- */

export interface RateStatus {
  per10min: number
  perDay: number
  llmToday: number
  limit10min: number
  limitDay: number
  limitGlobal: number
}

export async function rateStatus(userId: string): Promise<RateStatus> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const [per10min, perDay, llmToday] = await Promise.all([
    prisma.chatMessage.count({ where: { session: { userId }, createdAt: { gte: tenMinAgo }, vaiTro: 'USER' } }),
    prisma.chatMessage.count({ where: { session: { userId }, createdAt: { gte: dayStart }, vaiTro: 'USER' } }),
    prisma.chatMessage.count({ where: { createdAt: { gte: dayStart }, cheDo: 'LLM', vaiTro: 'ASSISTANT' } }),
  ])
  return {
    per10min, perDay, llmToday,
    limit10min: env.CHAT_USER_PER_10MIN,
    limitDay: env.CHAT_USER_PER_DAY,
    limitGlobal: env.CHAT_GLOBAL_PER_DAY,
  }
}

export async function checkRateLimit(userId: string): Promise<RateStatus> {
  const s = await rateStatus(userId)
  if (s.per10min >= s.limit10min || s.perDay >= s.limitDay) {
    throw new AppError('RATE_LIMITED', 'Bạn hỏi nhiều quá, hãy chờ một lát rồi thử lại.', { retryAfter: 600 })
  }
  return s
}

/* ---------------- Bộ nhớ đệm câu trả lời ---------------- */

const answerCache = new Map<string, { answer: string; at: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function clearChatAnswerCache(): void {
  answerCache.clear()
}

/* ---------------- Kiểu kết quả ---------------- */

export interface ChatSourceOut { tenFile: string; trang: number; trichDoan: string }

export interface ChatOutcome {
  sessionId: string
  userMessageId: string
  messageId: string
  answer: string
  mode: 'LLM' | 'SEARCH_ONLY'
  sources: ChatSourceOut[]
  actions: ChatAction[]
  goiYForm?: { requestTypeId: string; ten: string }
  latencyMs: number
  cacheHit: boolean
}

function toSourceOut(r: SearchResult): ChatSourceOut {
  return {
    tenFile: r.docTitle,
    trang: r.page ?? 1,
    trichDoan: `${r.heading ? `${r.heading} — ` : ''}${r.content.slice(0, 160)}`,
  }
}

/** Loại URL lạ trong chữ của mô hình (Q8): chỉ giữ URL nội bộ. */
export function stripForeignUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseModelJson(text: string): {
  answer: string
  can_answer: boolean
  cited_source_ids: string[]
  tool?: { ten: string; thamSo?: unknown }
} {
  const m = /\{[\s\S]*\}/.exec(text)
  if (m) {
    try {
      const j = JSON.parse(m[0]) as Record<string, unknown>
      return {
        answer: typeof j.answer === 'string' ? j.answer : '',
        can_answer: j.can_answer !== false,
        cited_source_ids: Array.isArray(j.cited_source_ids)
          ? (j.cited_source_ids as unknown[]).filter((x): x is string => typeof x === 'string')
          : [],
        tool:
          j.tool && typeof j.tool === 'object' && typeof (j.tool as { ten?: unknown }).ten === 'string'
            ? (j.tool as { ten: string; thamSo?: unknown })
            : undefined,
      }
    } catch { /* rơi xuống văn bản thô */ }
  }
  return { answer: text, can_answer: true, cited_source_ids: [] }
}

/* ---------------- Prompt ---------------- */

function buildUserPrompt(opts: {
  questionMasked: string
  history: string[]
  sources: SearchResult[]
  toolResults: string[]
}): string {
  const parts: string[] = []
  parts.push(opts.history.length ? `LỊCH SỬ HỘI THOẠI (đã che thông tin cá nhân):\n${opts.history.join('\n')}\n` : '')
  if (opts.sources.length === 0) {
    parts.push('<<NGUỒN>>\nchưa có đoạn nào (NGUỒN-rỗng)\n<<KẾT THÚC NGUỒN>>')
  } else {
    const src = opts.sources
      .map((s, i) => `[${i + 1}] id=${s.chunkId} | ${s.docTitle}${s.page ? ` (trang ${s.page})` : ''}\n${s.content.slice(0, 900)}`)
      .join('\n---\n')
    parts.push(`<<NGUỒN>>\n${src}\n<<KẾT THÚC NGUỒN>>`)
  }
  parts.push(
    opts.toolResults.length
      ? `<<KẾT QUẢ CÔNG CỤ>>\n${opts.toolResults.join('\n')}\n<<KẾT THÚC KẾT QUẢ CÔNG CỤ>>`
      : '(không có kết quả công cụ)',
  )
  parts.push(
    [
      '<<CÂU HỎI>>',
      opts.questionMasked,
      '<<KẾT THÚC CÂU HỎI>>',
      'Trả lời DUY NHẤT một JSON: {"answer": string, "can_answer": boolean, "cited_source_ids": string[], "tool"?: {"ten": "get_my_applications"|"get_application_status"|"suggest_request_types"|"propose_draft", "thamSo": object}}.',
      '- Nếu cần dữ liệu đơn của sinh viên mà chưa có KẾT QUẢ CÔNG CỤ thì trả tool thay vì đoán.',
      '- Nếu NGUỒN không đủ: can_answer=false và answer nêu rõ chưa tìm thấy.',
    ].join('\n'),
  )
  return parts.join('\n\n')
}

/* ---------------- Lệnh gọi công cụ ---------------- */

export interface ToolOutcome {
  label: string
  payload: unknown
  actions: ChatAction[]
  goiYForm?: { requestTypeId: string; ten: string }
  deXuat?: { maLoiDon: string; tenLoaiDon: string; cacTruong: Array<{ ten: string; nhan: string; giaTriGoiY: string; batBuoc: boolean }> }
}

/** Chạy một công cụ theo tên; quyền người dùng lấy từ token, không từ mô hình. */
export async function runTool(ten: string, thamSo: unknown, user: Express.AuthUser): Promise<ToolOutcome | null> {
  const ctx = { user: { id: user.id, role: user.role, hoTen: user.hoTen, maSo: user.maSo } }
  switch (ten) {
    case 'get_my_applications': {
      const r = await get_my_applications(thamSo, ctx)
      return 'error' in r ? { label: ten, payload: r, actions: [] } : { label: ten, payload: r, actions: r.danhSach.slice(0, 3).map((h) => makeAction({ kieu: 'OPEN_APPLICATION', maHoSo: h.maHoSo, ten: h.tenLoaiDon })) }
    }
    case 'get_application_status': {
      const r = await get_application_status(thamSo, ctx)
      return 'error' in r ? { label: ten, payload: r, actions: [] } : { label: ten, payload: r, actions: [makeAction({ kieu: 'OPEN_APPLICATION', maHoSo: r.hoSo.maHoSo, ten: r.hoSo.tenLoaiDon })] }
    }
    case 'suggest_request_types': {
      const r = await suggest_request_types(thamSo)
      const g0 = r.goiY[0]
      return { label: ten, payload: r, goiYForm: g0 ? { requestTypeId: g0.maLoaiDon, ten: g0.ten } : undefined, actions: [] }
    }
    case 'propose_draft': {
      const r = await propose_draft(thamSo, ctx)
      if ('error' in r) return { label: ten, payload: r, actions: [] }
      const d = r.deXuat
      return {
        label: ten,
        payload: r,
        deXuat: { maLoiDon: d.maLoiDon, tenLoaiDon: d.tenLoaiDon, cacTruong: d.cacTruong },
        actions: [
          makeAction({
            kieu: 'DRAFT_PROPOSAL',
            maLoiDon: d.maLoiDon,
            tenLoaiDon: d.tenLoaiDon,
            cacTruong: d.cacTruong.map((f) => ({ ten: f.ten, nhan: f.nhan, giaTriGoiY: f.giaTriGoiY, batBuoc: f.batBuoc })),
          }),
        ],
      }
    }
    default:
      return null
  }
}

/** Nhận diện ý định gọi công cụ từ chính câu hỏi (ổn định, không phụ thuộc mô hình). */
export function detectIntentTools(question: string): Array<{ ten: string; thamSo?: unknown }> {
  const calls: Array<{ ten: string; thamSo?: unknown }> = []
  const ma = /\b(MC-\d{4}-\d{6})\b/.exec(question)
  if (ma) {
    calls.push({ ten: 'get_application_status', thamSo: { maHoSo: ma[1] } })
    return calls
  }
  if (/(trạng thái|tra cứu|đơn của (tôi|em|mình|tớ)|hồ sơ của (tôi|em|mình)|tiến độ)/i.test(question)) {
    calls.push({ ten: 'get_my_applications', thamSo: {} })
  }
  return calls
}

/* ---------------- Orchestrator chính ---------------- */

const OVERALL_TIMEOUT_MS = 20_000
const MAX_ROUNDS = 3

export interface OrchestratorDeps {
  user: Express.AuthUser
  question: string
  sessionId?: string
}

export async function orchestrate(deps: OrchestratorDeps): Promise<ChatOutcome> {
  const { user } = deps
  const t0 = Date.now()
  const question = deps.question.trim()
  if (!question) throw AppError.validation('Câu hỏi không được để trống.')
  if (question.length > 1000) throw AppError.validation('Câu hỏi tối đa 1000 ký tự.')

  await checkRateLimit(user.id)

  // 1) Tạo/tái sử dụng phiên: thuộc về người dùng; không hợp lệ → phiên mới.
  let sessionId = deps.sessionId ?? ''
  if (sessionId) {
    const own = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id }, select: { id: true } })
    if (!own) sessionId = ''
  }
  if (!sessionId) {
    const last = await prisma.chatSession.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, updatedAt: true },
    })
    // Dùng lại phiên gần nhất trong 6 giờ; ngược lại "cuộc trò chuyện mới".
    if (last && Date.now() - last.updatedAt.getTime() < 6 * 3600_000) sessionId = last.id
  }
  const session = sessionId
    ? await prisma.chatSession.update({ where: { id: sessionId }, data: {} })
    : await prisma.chatSession.create({ data: { userId: user.id, tieuDe: question.slice(0, 80) } })

  // 2) Lịch sử 6 tin gần nhất của phiên (đã che PII).
  const recent = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { vaiTro: true, noiDung: true },
  })
  const profile = { hoTen: user.hoTen, maSo: user.maSo, email: user.email, soDienThoai: null as string | null }
  const history = recent
    .reverse()
    .map((m) => `${m.vaiTro === 'USER' ? 'Sinh viên' : 'Trợ lý'}: ${maskPii(m.noiDung.slice(0, 300), profile)}`)

  // 3) Lưu tin nhắn người dùng.
  const userMessage = await prisma.chatMessage.create({
    data: { sessionId: session.id, vaiTro: 'USER', noiDung: question, nguoiDungId: user.id },
  })

  // 4) Truy xuất lai (embedding truy vấn nếu có khóa).
  const provider = getLlmProvider()
  let queryEmbedding: number[] | null = null
  if (provider.available()) {
    try {
      const vec = await provider.embed([question.slice(0, 400)])
      queryEmbedding = vec[0] ?? null
    } catch { /* suy giảm: không có vector, BM25 vẫn chạy */ }
  }
  const retrieved = await searchKnowledge(question, { topK: 5, minScore: 0, queryEmbedding })
  const topScore = retrieved[0]?.score ?? 0
  const enoughEvidence = topScore >= env.CHAT_MIN_SCORE

  // 5) Công cụ từ ý định + từ mô hình (tối đa 3 vòng, tổng 20 giây).
  const toolResults: string[] = []
  const actions: ChatAction[] = []
  let goiYForm: { requestTypeId: string; ten: string } | undefined
  let draftProposal: ToolOutcome['deXuat'] | undefined
  const ran = new Set<string>()
  for (const call of detectIntentTools(question)) {
    if (ran.has(call.ten)) continue
    const out = await runTool(call.ten, call.thamSo, user)
    if (out) {
      toolResults.push(`${call.ten}: ${JSON.stringify(out.payload).slice(0, 1200)}`)
      actions.push(...out.actions)
      if (out.goiYForm) goiYForm = out.goiYForm
      if (out.deXuat) draftProposal = out.deXuat
    }
    ran.add(call.ten)
  }

  // 6) Bộ nhớ đệm (chỉ khi không gọi công cụ tra cứu cá nhân và câu không PII).
  const cKey = cacheKey(question)
  const cacheable = cKey.length >= 6 && !/[0-9]{6,}/.test(question) && toolResults.length === 0
  const cached = cacheable ? answerCache.get(cKey) : undefined
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const answer = cached.answer
    const msg = await prisma.chatMessage.create({
      data: {
        sessionId: session.id, vaiTro: 'ASSISTANT', noiDung: answer,
        nguon: retrieved.slice(0, 3).map(toSourceOut) as unknown as Prisma.InputJsonValue,
        cheDo: 'LLM', moHinh: 'cache', thoiGianMs: Date.now() - t0, nguoiDungId: user.id,
        ...(goiYForm ? { goiYForm } : {}),
      },
    })
    return {
      sessionId: session.id, userMessageId: userMessage.id, messageId: msg.id,
      answer, mode: 'LLM',
      sources: retrieved.slice(0, 3).map(toSourceOut),
      actions: [makeAction({ kieu: 'OFFER_HANDOFF' })],
      goiYForm, latencyMs: Date.now() - t0, cacheHit: true,
    }
  }

  // 7) Gọi mô hình (LLM) hoặc suy giảm SEARCH_ONLY.
  const sourcesMasked = retrieved.map((s) => ({ ...s, content: maskPii(s.content, profile) }))
  let answer = ''
  let mode: 'LLM' | 'SEARCH_ONLY' = 'LLM'
  let modelRounds = 0
  let llmError: LlmError | null = null

  if (!provider.available()) {
    mode = 'SEARCH_ONLY'
  } else {
    const deadline = Date.now() + OVERALL_TIMEOUT_MS
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        if (Date.now() > deadline) throw new LlmError('Hết thời gian gọi mô hình (20s)', 504)
        const prompt = buildUserPrompt({
          questionMasked: maskPii(question, profile),
          history,
          sources: sourcesMasked,
          toolResults,
        })
        const rest = deadline - Date.now()
        const raw = await Promise.race([
          provider.generate({ system: SYSTEM_PROMPT, prompt, maxOutputTokens: 1024, jsonMode: true }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new LlmError('Hết thời gian gọi mô hình (20s)', 504)), rest)),
        ])
        modelRounds += 1
        const parsed = parseModelJson(raw)
        if (parsed.tool && !ran.has(parsed.tool.ten)) {
          const out = await runTool(parsed.tool.ten, parsed.tool.thamSo, user)
          if (out) {
            toolResults.push(`${parsed.tool.ten}: ${JSON.stringify(out.payload).slice(0, 1200)}`)
            actions.push(...out.actions)
            if (out.goiYForm) goiYForm = out.goiYForm
            if (out.deXuat) draftProposal = out.deXuat
          }
          ran.add(parsed.tool.ten)
          continue
        }
        // Hậu xử lý: loại URL lạ, lọc nguồn không thuộc tập truy xuất.
        const text = stripForeignUrls(parsed.answer)
        if (!parsed.can_answer || (!enoughEvidence && toolResults.length === 0 && !draftProposal)) {
          // Chống bịa (Q3): thiếu căn cứ truy xuất hoặc mô hình tự nhận không đủ
          // → câu trả lời chuẩn "chưa tìm thấy", KHÔNG dùng chữ mô hình.
          mode = 'LLM'
          answer = 'Tôi chưa tìm thấy thông tin này trong tài liệu của trường.'
          break
        }
        answer = text
        break
      }
      if (modelRounds === 0) throw new LlmError('Mô hình không trả lời', 502)
    } catch (e) {
      llmError = e instanceof LlmError ? e : new LlmError((e as Error).message, 500)
      if (llmError.status === 429) {
        // Thử lại MỘT lần với độ trễ ngắn.
        await new Promise((r) => setTimeout(r, 800))
        try {
          const prompt = buildUserPrompt({ questionMasked: maskPii(question, profile), history, sources: sourcesMasked, toolResults })
          const raw = await provider.generate({ system: SYSTEM_PROMPT, prompt, maxOutputTokens: 1024, jsonMode: true })
          const parsed = parseModelJson(raw)
          answer = stripForeignUrls(parsed.answer)
          if (!parsed.can_answer) answer = `${parsed.answer}`
          llmError = null
        } catch (e2) {
          llmError = e2 instanceof LlmError ? e2 : new LlmError((e2 as Error).message, 500)
        }
      }
      if (llmError) mode = 'SEARCH_ONLY'
    }
  }

  if (mode === 'SEARCH_ONLY') {
    // Chế độ chỉ-tìm-kiếm: tối đa 3 biểu mẫu/đoạn phù hợp, không gọi mô hình.
    answer = [
      'Trợ lý đang ở chế độ tra cứu nhanh (không gọi được trợ lý AI lúc này).',
      'Dưới đây là các tài liệu/biểu mẫu phù hợp nhất với câu hỏi của bạn:',
      ...retrieved.slice(0, 3).map((s, i) => `${i + 1}. ${s.docTitle}`),
      'Hãy bấm nút bên dưới nếu cần cán bộ hỗ trợ thêm.',
    ].join('\n')
  } else if (!answer.trim()) {
    answer = 'Tôi chưa tìm thấy thông tin này trong tài liệu của trường.'
  }
  const notFound = /chưa tìm thấy thông tin này trong tài liệu/i.test(answer) || (!enoughEvidence && mode === 'SEARCH_ONLY')
  if (notFound) actions.push(makeAction({ kieu: 'OFFER_HANDOFF' }))

  // 8) Hành động do server dựng từ dữ liệu thật (Q8).
  const libDocs = new Map(retrieved.map((r) => [r.chunkId, r]))
  const libraryIds = [...new Set(retrieved.map((r) => r.libraryDocumentId).filter((x): x is string => Boolean(x)))]
  if (libraryIds.length) {
    const libs = await prisma.libraryDocument.findMany({ where: { id: { in: libraryIds } }, select: { id: true, ten: true, url: true } })
    const libById = new Map(libs.map((l) => [l.id, l]))
    const seen = new Set<string>()
    for (const r of retrieved) {
      if (!r.libraryDocumentId) continue
      const lib = libById.get(r.libraryDocumentId)
      if (!lib || seen.has(lib.ten)) continue
      seen.add(lib.ten)
      actions.push(
        lib.url.includes('/tai-lieu/')
          ? makeAction({ kieu: 'DOWNLOAD_FORM', ten: lib.ten, duongDan: lib.url })
          : makeAction({ kieu: 'OPEN_FORM', ten: lib.ten, duongDan: lib.url }),
      )
      if (seen.size >= 3) break
    }
  }

  // 9) Lưu tin nhắn trợ lý.
  const latencyMs = Date.now() - t0
  const assistantMessage = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      vaiTro: 'ASSISTANT',
      noiDung: answer,
      nguon: retrieved.slice(0, 4).map(toSourceOut) as unknown as Prisma.InputJsonValue,
      ...(goiYForm ? { goiYForm } : {}),
      hanhDong: actions as unknown as Prisma.InputJsonValue,
      cheDo: mode,
      moHinh: mode === 'LLM' ? provider.model : null,
      thoiGianMs: latencyMs,
      nguoiDungId: user.id,
    },
  })

  if (cacheable && mode === 'LLM' && !notFound) answerCache.set(cKey, { answer, at: Date.now() })

  return {
    sessionId: session.id,
    userMessageId: userMessage.id,
    messageId: assistantMessage.id,
    answer,
    mode,
    sources: retrieved.slice(0, 4).map(toSourceOut),
    actions,
    goiYForm,
    latencyMs,
    cacheHit: false,
  }
}
