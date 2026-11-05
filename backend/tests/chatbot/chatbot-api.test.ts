/**
 * Kiểm thử API trợ lý ảo (phần 1): SSE, quyền truy cập, chống IDOR,
 * che thông tin cá nhân, hạn mức hỏi đáp và bộ nhớ đệm.
 * Mọi trường hợp dùng FakeProvider — không gọi mạng thật.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  api,
  bearer,
  cleanupTracked,
  createDraft,
  login,
  pickRequestTypeId,
  prisma,
  twoStudents,
  type Session,
} from '../helpers'
import { FakeProvider, setLlmProviderForTest, type LLMProvider } from '../../src/modules/chatbot/llm/provider'

interface NguoiBanUser {
  maSo: string
  hoTen: string
  email: string
}

let sessionA: Session
let sessionB: Session
let sessionC: Session
let admin: Session
let covan: Session
let userA: NguoiBanUser
let draftOfA: { id: string; maHoSo: string }

const fake = new FakeProvider()

/** Gửi câu hỏi và nhận văn bản SSE thô. */
async function ask(session: Session, cauHoi: string, sessionId?: string) {
  return api()
    .post('/api/v1/chat/stream')
    .set(bearer(session.token))
    .send({ cauHoi, ...(sessionId ? { sessionId } : {}) })
}

/** Tách các frame `data: {...}` ra khỏi văn bản SSE. */
function parseSse(text: string): Array<Record<string, unknown>> {
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('data: ') && !s.includes('[DONE]'))
    .map((s) => JSON.parse(s.slice(6)) as Record<string, unknown>)
}

/** Dọn toàn bộ dữ liệu chat của một người dùng. */
async function purgeChat(userIds: string[]): Promise<void> {
  if (!userIds.length) return
  await prisma.chatFeedback.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.chatHandoff.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.chatSession.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.notification.deleteMany({ where: { nguoiNhanId: { in: userIds } } })
}

beforeAll(async () => {
  setLlmProviderForTest(fake)
  const [a, b] = await twoStudents()
  sessionA = await login(a.user.maSo)
  sessionB = await login(b.user.maSo)
  userA = a.user as unknown as NguoiBanUser
  const third = await prisma.student.findFirst({
    where: { userId: { notIn: [a.userId, b.userId] } },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!third) throw new Error('Thiếu sinh viên thứ ba để kiểm tra hạn mức.')
  sessionC = await login(third.user.maSo)
  admin = await login('admin')
  covan = await login('CV001')
  purgeChat([a.userId, b.userId, third.userId])
  // Hồ sơ của A dùng để kiểm tra chống IDOR ở công cụ tra cứu.
  draftOfA = await createDraft(sessionA, await pickRequestTypeId())
  // Chunk kiến thức riêng với từ khóa đặc trưng → bảo đảm điểm truy xuất
  // (điểm phủ từ khóa hữu ích [0,1] khi chỉ khớp BM25) ≥ CHAT_MIN_SCORE để
  // kiểm tra bộ nhớ đệm.
  const cacheDoc = await prisma.knowledgeDocument.create({
    data: {
      ma: 'KB-test-chatbot-cache',
      title: 'Quy định kiểm thử riêng — cache',
      sourceType: 'UPLOAD',
      contentHash: 'cache-test',
      status: 'READY',
      uploadedBy: (await login('admin')).user.id,
    },
  })
  await prisma.knowledgeChunk.create({
    data: {
      documentId: cacheDoc.id,
      chunkIndex: 0,
      content: 'Quy định kiểm thử zcacheq: học bổng kỹ thuật chỉ dành cho sinh viên kết thử.',
    },
  })
  const { reloadKnowledgeIndex } = await import('../../src/modules/chatbot/retrieval')
  await reloadKnowledgeIndex()
})

afterAll(async () => {
  setLlmProviderForTest(null)
  await purgeChat([sessionA?.user.id, sessionB?.user.id, sessionC?.user.id].filter(Boolean) as string[])
  await cleanupTracked()
  await prisma.knowledgeDocument.deleteMany({ where: { ma: 'KB-test-chatbot-cache' } })
  const { clearChatAnswerCache } = await import('../../src/modules/chatbot/orchestrator')
  clearChatAnswerCache()
})

describe('Luồng hỏi đáp SSE cơ bản', () => {
  it('sinh viên hỏi → SSE token/nguồn/xong + [DONE], session được tạo', async () => {
    const res = await ask(sessionA, 'Thủ tục xin cấp bảng điểm cần những giấy tờ gì?')
    expect(res.status).toBe(200)
    expect(String(res.headers['content-type'])).toContain('text/event-stream')
    const frames = parseSse(res.text)
    expect(frames.length).toBeGreaterThanOrEqual(3)
    expect(frames[0]!.loai).toBe('token')
    expect(frames.some((f) => f.loai === 'nguon' && Array.isArray(f.nguon))).toBe(true)
    const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string; sessionId?: string } | undefined
    expect(xong?.traLoiDayDu).toBeTruthy()
    expect(String(xong?.sessionId ?? '')).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.text).toContain('data: [DONE]')
  })
})

describe('Chống IDOR — công cụ tra cứu chỉ dùng dữ liệu của chính người dùng', () => {
  it('B hỏi về mã hồ sơ của A → không có kết quả, không có nút mở đơn của A', async () => {
    const res = await ask(sessionB, `Tra cứu trạng thái hồ sơ ${draftOfA.maHoSo} của em là bao nhiêu?`)
    expect(res.status).toBe(200)
    // Công cụ phải trả lỗi "không tìm thấy trong danh sách đơn của bạn" (quyền từ token B).
    expect(fake.lastPrompt?.prompt).toContain('Không tìm thấy hồ sơ với mã này trong danh sách đơn của bạn')
    // Không bao giờ gửi kết quả tra cứu hồ sơ của A cho mô hình.
    expect(fake.lastPrompt?.prompt).not.toContain('"trangThai"')
    const frames = parseSse(res.text)
    const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<{ kieu: string; maHoSo?: string }> } | undefined
    const mo = (nguon?.hanhDong ?? []).filter((a) => a.kieu === 'OPEN_APPLICATION')
    expect(mo.map((a) => a.maHoSo)).not.toContain(draftOfA.maHoSo)
  })

  it('mô hình tự thêm userId lạ → bị zod loại bỏ, quyền vẫn lấy từ token', async () => {
    class UserIdInjector implements LLMProvider {
      name = 'fake-id-injector'
      model = 'fake'
      available() {
        return true
      }
      prompts: Array<{ system: string; prompt: string }> = []
      async generate(input: { system: string; prompt: string }): Promise<string> {
        this.prompts.push({ system: input.system, prompt: input.prompt })
        return JSON.stringify({
          answer: '',
          can_answer: true,
          cited_source_ids: [],
          tool: {
            ten: 'get_application_status',
            thamSo: { maHoSo: draftOfA.maHoSo, userId: '00000000-0000-0000-0000-000000009999' },
          },
        })
      }
      async embed(texts: string[]) {
        return texts.map(() => new Array(32).fill(0.1))
      }
    }
    const injector = new UserIdInjector()
    setLlmProviderForTest(injector)
    try {
      const res = await ask(sessionB, `Tra cứu trạng thái hồ sơ ${draftOfA.maHoSo} của em là bao nhiêu?`)
      expect(res.status).toBe(200)
      // Tool đã chạy với ngữ cảnh của B: драф của A không được tiết lộ.
      expect(injector.prompts.some((p) => p.prompt.includes('Không tìm thấy hồ sơ với mã này trong danh sách đơn của bạn'))).toBe(true)
      const frames = parseSse(res.text)
      const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<{ kieu: string; maHoSo?: string }> } | undefined
      expect((nguon?.hanhDong ?? []).some((a) => a.kieu === 'OPEN_APPLICATION' && a.maHoSo === draftOfA.maHoSo)).toBe(false)
    } finally {
      setLlmProviderForTest(fake)
    }
  })

  it('cố vấn (không phải sinh viên) hỏi tra cứu → công cụ từ chối, không có bản ghi đơn', async () => {
    const res = await ask(covan, 'Tra cứu trạng thái đơn của em')
    expect(res.status).toBe(200)
    expect(fake.lastPrompt?.prompt).toContain('Chức năng tra cứu đơn chỉ dành cho sinh viên.')
    const frames = parseSse(res.text)
    const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<{ kieu: string }> } | undefined
    expect((nguon?.hanhDong ?? []).some((a) => a.kieu === 'OPEN_APPLICATION')).toBe(false)
  })
})

describe('Phân quyền trang quản trị chatbot', () => {
  it('sinh viên và cố vấn bị chặn 403 — cán bộ Phòng Đào tạo và Admin được phép', async () => {
    const sv = await api().get('/api/v1/chat/knowledge').set(bearer(sessionA.token))
    expect(sv.status).toBe(403)
    const cv = await api().get('/api/v1/chat/knowledge').set(bearer(covan.token))
    expect(cv.status).toBe(403)
    const inboxSV = await api().get('/api/v1/chat/handoffs/inbox').set(bearer(sessionA.token))
    expect(inboxSV.status).toBe(403)
    const pdt = await api().get('/api/v1/chat/knowledge').set(bearer((await login('PDT001')).token))
    expect(pdt.status).toBe(200)
    const adm = await api().get('/api/v1/chat/knowledge').set(bearer(admin.token))
    expect(adm.status).toBe(200)
  })
})

describe('Che thông tin cá nhân trước khi gửi cho mô hình', () => {
  it('họ tên, mã số, email, số CCCD đều được thay bằng token [X]', async () => {
    await ask(
      sessionA,
      `${userA.hoTen} có mã số ${userA.maSo}, email ${userA.email}, CCCD 123456789012 — em xin hỏi lệ phí làm giấy xác nhận zpriv là bao nhiêu?`,
    )
    const prompt = fake.lastPrompt?.prompt ?? ''
    expect(prompt).not.toContain(userA.hoTen)
    expect(prompt).not.toContain(userA.maSo)
    expect(prompt).not.toContain(userA.email)
    expect(prompt).not.toContain('123456789012')
    expect(prompt).toContain('[HỌ TÊN]')
    expect(prompt).toContain('[MSSV]')
    expect(prompt).toContain('[EMAIL]')
    expect(prompt).toContain('[SỐ]')
  })
})

describe('Hạn mức hỏi đáp (429)', () => {
  it('đạt CHAT_USER_PER_10MIN → POST /chat/stream trả 429 RATE_LIMITED', async () => {
    const session = await prisma.chatSession.create({ data: { userId: sessionC.user.id as string } })
    const tenMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    await prisma.chatMessage.createMany({
      data: new Array(15).fill(0).map(() => ({
        sessionId: session.id,
        vaiTro: 'USER' as const,
        noiDung: 'câu hỏi điền đầy hạn mức',
        nguoiDungId: sessionC.user.id as string,
        createdAt: tenMinAgo,
      })),
    })
    const res = await ask(sessionC, 'câu hỏi vượt hạn mức?')
    expect(res.status).toBe(429)
    expect(res.body.error?.code).toBe('RATE_LIMITED')
    expect(res.body.success).toBe(false)
  })
})

describe('Bộ nhớ đệm câu trả lời (không chứa dữ liệu cá nhân)', () => {
  it('hỏi một câu đúng 2 lần → chỉ gọi mô hình 1 lần, lượt 2 ghi moHinh=cache', async () => {
    const cauHoi = 'quy định học bổng zcacheq áp dụng thế nào?'
    const beforeCalls = fake.prompts.length
    const r1 = await ask(sessionA, cauHoi)
    expect(r1.status).toBe(200)
    expect(fake.prompts.length).toBe(beforeCalls + 1)
    const r2 = await ask(sessionA, cauHoi)
    expect(r2.status).toBe(200)
    expect(fake.prompts.length).toBe(beforeCalls + 1) // lần 2 không gọi mô hình
    // Hai tin nhắn trợ lý gần nhất: lượt 2 mark 'cache', lượt 1 là moHinh thật.
    const recent = await prisma.chatMessage.findMany({
      where: { vaiTro: 'ASSISTANT', session: { userId: sessionA.user.id } },
      orderBy: { createdAt: 'desc' },
      take: 2,
    })
    expect(recent).toHaveLength(2)
    expect(recent[0]!.moHinh).toBe('cache')
    expect(recent[1]!.moHinh).toBe('fake-model')
  })
})

describe('Hậu xử lý chữ của mô hình (Q8)', () => {
  it('URL lạ bị cắt khỏi câu trả lời; nguồn chỉ đến từ truy xuất', async () => {
    class EvilLinkProvider implements LLMProvider {
      name = 'fake-evil-link'
      model = 'fake'
      available() {
        return true
      }
      async generate(): Promise<string> {
        return JSON.stringify({
          answer: 'Trả lời kiểm thử zevillink, tham khảo thêm tại https://evil.example.com/hack.',
          can_answer: true,
          cited_source_ids: ['tot-lam-id-lay-tu-khong-a'],
        })
      }
      async embed(texts: string[]) {
        return texts.map(() => new Array(32).fill(0.1))
      }
    }
    setLlmProviderForTest(new EvilLinkProvider())
    try {
      const res = await ask(sessionA, 'quy định về học lại và cải thiện điểm zevillink?')
      expect(res.status).toBe(200)
      const frames = parseSse(res.text)
      const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string } | undefined
      expect(xong?.traLoiDayDu ?? '').not.toContain('https://')
      expect(xong?.traLoiDayDu ?? '').not.toContain('evil.example.com')
      // Nguồn chỉ đến từ tập truy xuất — cấu trúc mảng server dựng.
      const nguonFrame = frames.find((f) => f.loai === 'nguon') as { nguon?: unknown[] } | undefined
      expect(Array.isArray(nguonFrame?.nguon)).toBe(true)
    } finally {
      setLlmProviderForTest(fake)
    }
  })
})
