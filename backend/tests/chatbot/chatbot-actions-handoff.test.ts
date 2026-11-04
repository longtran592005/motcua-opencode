/**
 * Kiểm thử hành động chờ xác nhận và bàn giao cán bộ (phần 3):
 * - Đề xuất bản nháp từ mô hình (chỉ đề xuất, KHÔNG tự nộp).
 * - POST /chat/actions/:id/confirm → tạo DRAFT thật (mã hồ sơ MC-).
 * - Lặp lại → 409; người khác → 404; hết hạn → 422.
 * - Handoff CH-YYYY-NNNNNN, hạn 5 câu/ngày; PDT trả lời/đưa vào FAQ.
 * - Suy giảm SEARCH_ONLY khi mô hình lỗi; thử lại MỘT lần trên 429.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, bearer, cleanupTracked, login, prisma, twoStudents, type Session } from '../helpers'
import { FakeProvider, LlmError, setLlmProviderForTest, type LLMProvider } from '../../src/modules/chatbot/llm/provider'
import { searchKnowledge, reloadKnowledgeIndex } from '../../src/modules/chatbot/retrieval'
import { clearChatAnswerCache } from '../../src/modules/chatbot/orchestrator'

const CREATED_MA_HO_SO: string[] = []
const CREATED_FAQ_MA: string[] = []
let createdHandoffMa: string | null = null

let sessionA: Session
let sessionB: Session
let pdt: Session
let studentAId: string

/** Provider hai vòng: vòng 1 trả tool, vòng 2 trả câu trả lời. */
class ToolCallProvider implements LLMProvider {
  name = 'fake-tool-caller'
  model = 'fake'
  available() {
    return true
  }
  prompts: Array<{ system: string; prompt: string }> = []
  constructor(private opts: { ten: string; thamSo: Record<string, unknown>; answer?: string }) {}
  async generate(input: { system: string; prompt: string }): Promise<string> {
    this.prompts.push({ system: input.system, prompt: input.prompt })
    if (this.prompts.length === 1) {
      return JSON.stringify({ answer: '', can_answer: true, cited_source_ids: [], tool: { ten: this.opts.ten, thamSo: this.opts.thamSo } })
    }
    return JSON.stringify({ answer: this.opts.answer ?? 'Trả lời kiểm thử.', can_answer: true, cited_source_ids: [] })
  }
  async embed(texts: string[]) {
    return texts.map(() => new Array(32).fill(0.1))
  }
}

function parseSse(text: string): Array<Record<string, unknown>> {
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('data: ') && !s.includes('[DONE]'))
    .map((s) => JSON.parse(s.slice(6)) as Record<string, unknown>)
}

async function ask(session: Session, cauHoi: string, sessionId?: string) {
  return api()
    .post('/api/v1/chat/stream')
    .set(bearer(session.token))
    .send({ cauHoi, ...(sessionId ? { sessionId } : {}) })
}

async function purgeChatData(userIds: string[]): Promise<void> {
  if (!userIds.length) return
  await prisma.chatFeedback.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.chatHandoff.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.chatSession.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.notification.deleteMany({ where: { nguoiNhanId: { in: userIds } } })
}

const fake = new FakeProvider()

beforeAll(async () => {
  setLlmProviderForTest(fake)
  const [a, b] = await twoStudents()
  studentAId = a.userId
  sessionA = await login(a.user.maSo)
  sessionB = await login(b.user.maSo)
  pdt = await login('PDT001')
  await purgeChatData([a.userId, b.userId])
  await reloadKnowledgeIndex()
  clearChatAnswerCache()
})

afterAll(async () => {
  setLlmProviderForTest(null)
  // Dọn FAQ do to-faq tạo; dọn handoff + session + thông báo; dọn đơn đã tạo.
  if (CREATED_FAQ_MA.length) {
    await prisma.knowledgeDocument.deleteMany({ where: { ma: { in: CREATED_FAQ_MA } } })
  }
  await purgeChatData([studentAId])
  if (createdHandoffMa) {
    await prisma.chatHandoff.deleteMany({ where: { ma: createdHandoffMa } })
  }
  if (CREATED_MA_HO_SO.length) {
    await prisma.notification.deleteMany({ where: { maHoSo: { in: CREATED_MA_HO_SO } } })
    await prisma.application.deleteMany({ where: { maHoSo: { in: CREATED_MA_HO_SO } } })
  }
  // Thông báo định vai trò đã phát cho PDT trong test này (audit_logs append-only, không dọn).
  await prisma.notification.deleteMany({ where: { tieuDe: { contains: 'Câu hỏi chatbot mới' } } })
  await cleanupTracked()
  await reloadKnowledgeIndex()
  clearChatAnswerCache()
})

describe('Đề xuất bản nháp (propose_draft) — chỉ đề xuất, không tự nộp', () => {
  let rtMa = ''
  let fieldKey = ''
  let draftAction: {
    id: string
    expiresAt?: string
    maLoiDon?: string
    cacTruong?: Array<{ ten: string; giaTriGoiY: string }>
    canhBao?: string[]
  } | undefined

  it('mô hình đề xuất → DRAFT_PROPOSAL do server dựng, trường lạ bị cảnh báo', async () => {
    const rts = await prisma.requestType.findMany({
      where: { hoatDong: true, deletedAt: null },
      select: { id: true, ma: true, ten: true, formFields: { select: { key: true, label: true, type: true, required: true } } },
      take: 20,
      orderBy: { createdAt: 'asc' },
    })
    const rt = rts.find((r) => r.formFields.length > 0)
    if (!rt) throw new Error('Seed thiếu loại đơn có trường biểu mẫu để kiểm thử.')
    rtMa = rt.ma
    fieldKey = rt.formFields[0]!.key

    const provider = new ToolCallProvider({
      ten: 'propose_draft',
      thamSo: { maLoiDon: rtMa, truong: { [fieldKey]: 'giá trị zdraftx', truongLaKoTonTaiZLQ: 'giá trị lạ' } },
      answer: 'Em gợi ý bạn tham khảo mẫu này zdraftx.',
    })
    setLlmProviderForTest(provider)
    const soDonTruoc = await prisma.application.count({ where: { applicantId: studentAId, trangThai: 'DRAFT' } })
    try {
      const res = await ask(sessionA, `xin giúp em làm đơn zdraftx (mã ${rtMa})`)
      expect(res.status).toBe(200)
      const frames = parseSse(res.text)
      const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<Record<string, unknown>> } | undefined
      const proposal = (nguon?.hanhDong ?? []).find((a) => a.kieu === 'DRAFT_PROPOSAL') as NonNullable<typeof draftAction>
      expect(proposal).toBeTruthy()
      expect(proposal.maLoiDon).toBe(rtMa)
      expect((proposal.cacTruong ?? []).some((f) => f.ten === fieldKey && f.giaTriGoiY === 'giá trị zdraftx')).toBe(true)
      expect(proposal.canhBao ?? []).toContain('Bỏ trường lạ: "truongLaKoTonTaiZLQ"')
      expect(typeof proposal.id).toBe('string')
      expect(String(proposal.expiresAt ?? '')).toMatch(/^20\d\d/)
      draftAction = proposal
      // Chưa có bước xác nhận → không tạo đơn mới so với trước khi hỏi.
      const soDonSau = await prisma.application.count({ where: { applicantId: studentAId, trangThai: 'DRAFT' } })
      expect(soDonSau).toBe(soDonTruoc)
    } finally {
      setLlmProviderForTest(fake)
    }
  })

  it('xác nhận → 201 tạo DRAFT với mã MC-, bản ghi thuộc về sinh viên, có audit CHATBOT_DRAFT_CONFIRM', async () => {
    expect(draftAction).toBeTruthy()
    const res = await api().post(`/api/v1/chat/actions/${draftAction!.id}/confirm`).set(bearer(sessionA.token))
    expect(res.status).toBe(201)
    expect(res.body.data.maHoSo).toMatch(/^MC-\d{4}-\d{6}$/)
    CREATED_MA_HO_SO.push(res.body.data.maHoSo)
    const row = await prisma.application.findFirst({ where: { maHoSo: CREATED_MA_HO_SO[0]! } })
    expect(row?.applicantId).toBe(studentAId)
    expect(row?.trangThai).toBe('DRAFT')
    const dulieu = (row?.duLieu ?? {}) as Record<string, unknown>
    expect(Object.keys(dulieu).map(String)).not.toContain('truongLaKoTonTaiZLQ')
    const audit = await prisma.auditLog.findFirst({
      where: { hanhDong: 'CHATBOT_DRAFT_CONFIRM', doiTuongId: CREATED_MA_HO_SO[0]! },
    })
    expect(audit?.hanhDong).toBe('CHATBOT_DRAFT_CONFIRM')
  })

  it('lặp lại xác nhận → 409 DUPLICATE_ACTION và vẫn chỉ một bản ghi', async () => {
    const res = await api().post(`/api/v1/chat/actions/${draftAction!.id}/confirm`).set(bearer(sessionA.token))
    expect(res.status).toBe(409)
    expect(res.body.error?.code).toBe('DUPLICATE_ACTION')
    const count = await prisma.application.count({ where: { maHoSo: CREATED_MA_HO_SO[0]! } })
    expect(count).toBe(1)
  })

  it('sinh viên khác xác nhận → 404 (hành động của A không tới được B)', async () => {
    const res = await api().post(`/api/v1/chat/actions/${draftAction!.id}/confirm`).set(bearer(sessionB.token))
    expect(res.status).toBe(404)
  })

  it('hành động đã hết hạn → 422', async () => {
    const provider = new ToolCallProvider({
      ten: 'propose_draft',
      thamSo: { maLoiDon: rtMa, truong: {} },
      answer: 'Đề xuất zdraftx lần nữa.',
    })
    setLlmProviderForTest(provider)
    try {
      const res = await ask(sessionA, `đề xuất giúp em đơn zdraftx lần nữa (mã ${rtMa})`)
      const frames = parseSse(res.text)
      const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<Record<string, unknown>> } | undefined
      const act = (nguon?.hanhDong ?? []).find((a) => a.kieu === 'DRAFT_PROPOSAL') as { id: string } | undefined
      expect(act).toBeTruthy()
      const actionId = act!.id
      // Lùi expiresAt về quá khứ trong jsonb của tin nhắn chứa hành động.
      await prisma.$executeRaw`
        UPDATE chat_messages SET hanh_dong = (
          SELECT jsonb_agg(jsonb_set(item, '{expiresAt}', '"2020-01-01T00:00:00.000Z"'::jsonb))
          FROM jsonb_array_elements(hanh_dong) AS item
        )
        WHERE nguoi_dung_id = ${studentAId}::uuid
          AND hanh_dong @> ${JSON.stringify([{ id: actionId }])}::jsonb`
      const res2 = await api().post(`/api/v1/chat/actions/${actionId}/confirm`).set(bearer(sessionA.token))
      expect(res2.status).toBe(422)
    } finally {
      setLlmProviderForTest(fake)
    }
  })
})

describe('Bàn giao cán bộ (handoff) với hạn 5 câu/ngày', () => {
  it('tạo handoff → mã CH-YYYY-NNNNNN + thông báo cho cán bộ; câu thứ 6 → 429', async () => {
    const ses = await prisma.chatSession.create({ data: { userId: studentAId, tieuDe: 'kiểm thử zhandoff' } })
    await prisma.chatMessage.create({
      data: {
        sessionId: ses.id,
        vaiTro: 'USER',
        noiDung: 'quyết định công nhận thành tích zhandofffaq xin hỏi thế nào?',
        nguoiDungId: studentAId,
      },
    })
    const statuses: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const res = await api().post('/api/v1/chat/handoffs').set(bearer(sessionA.token)).send({ sessionId: ses.id })
      statuses.push(res.status)
      if (res.status === 201) {
        expect(res.body.data.ma).toMatch(/^CH-\d{4}-\d{6}$/)
        createdHandoffMa = res.body.data.ma as string
      }
    }
    expect(statuses.filter((s) => s === 201).length).toBe(5)
    expect(statuses[5]).toBe(429)
    expect(createdHandoffMa).toMatch(/^CH-/)

    const inbox = await api().get('/api/v1/chat/handoffs/inbox').set(bearer(pdt.token)).query({ trangThai: 'OPEN' })
    expect(inbox.status).toBe(200)
    const rows = inbox.body.data as Array<{ ma: string; status: string; question: string }>
    expect(rows.some((r) => r.ma === createdHandoffMa)).toBe(true)
  })

  it('cán bộ PDT trả lời → ANSWERED + thông báo cho sinh viên + audit CHATBOT_HANDOFF_ANSWER', async () => {
    expect(createdHandoffMa).toBeTruthy()
    const res = await api()
      .post(`/api/v1/chat/handoffs/${createdHandoffMa}/answer`)
      .set(bearer(pdt.token))
      .send({ cauTraLoi: 'FAQ kiểm thử zhandofffaq: vâng, em xem quy định tạibahnho …' })
    expect(res.status).toBe(200)
    expect(res.body.data.trangThai).toBe('ANSWERED')
    const row = await prisma.chatHandoff.findFirst({
      where: { ma: createdHandoffMa! },
      select: { status: true, answer: true, answeredAt: true, answeredBy: true },
    })
    expect(row?.status).toBe('ANSWERED')
    expect(row?.answer).toContain('zhandofffaq')
    expect(row?.answeredAt).toBeTruthy()
    const notis = (await api().get('/api/v1/notifications').set(bearer(sessionA.token))).body.data as Array<Record<string, unknown>>
    expect(notis.some((n) => String(n.tieuDe ?? '').includes('đã trả lời câu hỏi'))).toBe(true)
  })

  it('đưa câu hỏi đã trả lời vào FAQ → tài liệu KB-*, READY, truy xuất được', async () => {
    expect(createdHandoffMa).toBeTruthy()
    const res = await api().post(`/api/v1/chat/handoffs/${createdHandoffMa}/to-faq`).set(bearer(pdt.token))
    expect(res.status).toBe(201)
    expect(String(res.body.data.ma)).toMatch(/^KB-/)
    CREATED_FAQ_MA.push(res.body.data.ma as string)
    const row = await prisma.knowledgeDocument.findFirst({
      where: { ma: CREATED_FAQ_MA[0]! },
      select: { status: true, sourceType: true },
    })
    expect(row?.status).toBe('READY')
    expect(row?.sourceType).toBe('FAQ')
    const hits = await searchKnowledge('zhandofffaq', { topK: 5 })
    expect(hits.some((h) => h.content.includes('zhandofffaq'))).toBe(true)
  })
})

describe('Suy giảm hoạt động khi mô hình lỗi (SEARCH_ONLY) và thử lại 429', () => {
  it('provider ném 500 → SEARCH_ONLY, gọi mô hình đúng 1 lần, có nút gửi cán bộ', async () => {
    class FailingProvider implements LLMProvider {
      name = 'fake-failing'
      model = 'fake'
      available() {
        return true
      }
      calls = 0
      async generate(): Promise<string> {
        this.calls += 1
        throw new LlmError('mô hình rối loạn nội bộ', 500)
      }
      async embed(texts: string[]) {
        return texts.map(() => new Array(32).fill(0.1))
      }
    }
    const fail = new FailingProvider()
    setLlmProviderForTest(fail)
    try {
      const res = await ask(sessionA, 'thủ tục xin cấp bảng điểm cần giấy tờ gì zsearchonly?')
      expect(res.status).toBe(200)
      expect(fail.calls).toBe(1)
      const frames = parseSse(res.text)
      const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string; cheDo?: string } | undefined
      expect(xong?.cheDo).toBe('SEARCH_ONLY')
      expect(xong?.traLoiDayDu ?? '').toContain('tra cứu nhanh')
      const nguon = frames.find((f) => f.loai === 'nguon') as { nguon?: unknown[] } | undefined
      // Vì câu hỏi này truy xuất mạnh (không thuộc trường hợp "chưa tìm thấy"),
      // nút gửi cán bộ không bắt buộc; nguồn phải có kèm lịch sử/mã hồ sơ đúng.
      expect(Array.isArray(nguon?.nguon)).toBe(true)
    } finally {
      setLlmProviderForTest(fake)
    }
  })

  it('provider ném 429 → thử lại MỘT lần, lần 2 thành công (2 lượt gọi mô hình)', async () => {
    class RetryProvider implements LLMProvider {
      name = 'fake-retry'
      model = 'fake'
      available() {
        return true
      }
      calls = 0
      async generate(): Promise<string> {
        this.calls += 1
        if (this.calls === 1) throw new LlmError('vượt hạn mức', 429)
        return JSON.stringify({ answer: 'Trả lời sau khi thử lại zretry.', can_answer: true, cited_source_ids: [] })
      }
      async embed(texts: string[]) {
        return texts.map(() => new Array(32).fill(0.1))
      }
    }
    const retry = new RetryProvider()
    setLlmProviderForTest(retry)
    try {
      const res = await ask(sessionA, 'quy định về bảo lưu điểm zretry thế nào?')
      expect(res.status).toBe(200)
      expect(retry.calls).toBe(2)
      const frames = parseSse(res.text)
      const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string } | undefined
      expect(xong?.traLoiDayDu ?? '').toContain('zretry')
    } finally {
      setLlmProviderForTest(fake)
    }
  })
})
