/**
 * Kiểm thử truy xuất tri thức và quản trị tri thức của chatbot:
 * tìm theo từ khóa (BM25+RRF), bật/tắt/xóa tài liệu, tải lên tệp (kiểm tra
 * magic bytes), lập lại chỉ mục. Toàn bộ dùng FakeProvider.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, bearer, login, prisma, type Session } from '../helpers'
import { FakeProvider, setLlmProviderForTest } from '../../src/modules/chatbot/llm/provider'
import { reloadKnowledgeIndex, searchKnowledge } from '../../src/modules/chatbot/retrieval'
import { clearChatAnswerCache } from '../../src/modules/chatbot/orchestrator'

const MA_DOC = 'KB-test-chatbot-zqk'
const TOKEN = 'zqkhoanthi'

let admin: Session
let docId: string

const fake = new FakeProvider()

function parseSse(text: string): Array<Record<string, unknown>> {
  return text
    .split('\n\n')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('data: ') && !s.includes('[DONE]'))
    .map((s) => JSON.parse(s.slice(6)) as Record<string, unknown>)
}

beforeAll(async () => {
  setLlmProviderForTest(fake)
  admin = await login('admin')
  // Tạo tài liệu tri thức riêng với từ khóa đặc trưng (không đụng 311 chunk seed).
  const doc = await prisma.knowledgeDocument.create({
    data: {
      ma: MA_DOC,
      title: 'Quy định kiểm thử — hoàn thi zqkhoanthi',
      sourceType: 'UPLOAD',
      contentHash: 'test-hash',
      status: 'READY',
      uploadedBy: admin.user.id,
    },
  })
  docId = doc.id
  await prisma.knowledgeChunk.create({
    data: {
      documentId: doc.id,
      chunkIndex: 0,
      content: `Điều 5. Điều kiện hoàn thi (zqkhoanthi): sinh viên phải đạt trung bình tích lũy từ 2,0 và không có học phần nợ nào.`,
    },
  })
  await reloadKnowledgeIndex()
  clearChatAnswerCache()
})

afterAll(async () => {
  setLlmProviderForTest(null)
  await prisma.knowledgeDocument.deleteMany({ where: { ma: { startsWith: 'KB-test-chatbot' } } })
  await prisma.chatSession.deleteMany({ where: { userId: admin?.user.id } })
  await reloadKnowledgeIndex()
  clearChatAnswerCache()
})

describe('Truy xuất tri thức (BM25 + RRF, điểm trong [0,1])', () => {
  it('tìm đúng chunk theo từ khóa đặc trưng, điểm phủ từ khóa tuyệt đối > 0.5', async () => {
    const results = await searchKnowledge(`điều kiện ${TOKEN} thế nào?`, { topK: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0]!.content).toContain(TOKEN)
    // Thang điểm mới (Q3): phủ-từ-khóa-IDF tuyệt đối trong [0,1]. Chunk khớp cả
    // 3 từ hữu ích (trong đó từ hiếm TOKEN w≈1) → điểm phải rõ ràng trên 0.5.
    expect(results[0]!.score).toBeGreaterThan(0.5)
    expect(results[0]!.score).toBeLessThanOrEqual(1)
    expect(results[0]!.rank).toBe(1)
  })

  it('chat trả lời dựa trên nguồn: câu hỏi có nguồn → không gợi ý "chưa tìm thấy"', async () => {
    const res = await api()
      .post('/api/v1/chat/stream')
      .set(bearer(admin.token))
      .send({ cauHoi: `điều kiện ${TOKEN} gồm gì?` })
    expect(res.status).toBe(200)
    const frames = parseSse(res.text)
    const nguon = frames.find((f) => f.loai === 'nguon') as { nguon?: Array<Record<string, unknown>> } | undefined
    expect((nguon?.nguon ?? []).length).toBeGreaterThanOrEqual(1)
    const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string } | undefined
    expect(xong?.traLoiDayDu ?? '').not.toContain('chưa tìm thấy')
  })
})

describe('Bật/tắt + xóa tài liệu trong tranh truy xuất', () => {
  it('tắt hiệu lực → không còn truy xuất; trả lời "chưa tìm thấy" kèm nút gửi cán bộ', async () => {
    const patch = await api()
      .patch(`/api/v1/chat/knowledge/${MA_DOC}`)
      .set(bearer(admin.token))
      .send({ batHieuLuc: false })
    expect(patch.status).toBe(200)
    expect(patch.body.data.trangThai).toBe('DISABLED')

    const results = await searchKnowledge(`điều kiện ${TOKEN}?`, { topK: 5 })
    expect(results.some((r) => r.content.includes(TOKEN))).toBe(false)

    const res = await api()
      .post('/api/v1/chat/stream')
      .set(bearer(admin.token))
      .send({ cauHoi: `${TOKEN} là gì?` })
    const frames = parseSse(res.text)
    const xong = frames.find((f) => f.loai === 'xong') as { traLoiDayDu?: string } | undefined
    expect(xong?.traLoiDayDu ?? '').toContain('chưa tìm thấy')
    const nguon = frames.find((f) => f.loai === 'nguon') as { hanhDong?: Array<{ kieu: string }> } | undefined
    expect((nguon?.hanhDong ?? []).some((a) => a.kieu === 'OFFER_HANDOFF')).toBe(true)
  })

  it('bật lại → tìm thấy trở lại; xóa tài liệu → mất hẳn', async () => {
    const patch = await api()
      .patch(`/api/v1/chat/knowledge/${MA_DOC}`)
      .set(bearer(admin.token))
      .send({ batHieuLuc: true })
    expect(patch.body.data.trangThai).toBe('READY')
    let results = await searchKnowledge(`${TOKEN}`, { topK: 5 })
    expect(results.some((r) => r.content.includes(TOKEN))).toBe(true)

    const del = await api().delete(`/api/v1/chat/knowledge/${MA_DOC}`).set(bearer(admin.token))
    expect(del.status).toBe(200)
    results = await searchKnowledge(`${TOKEN}`, { topK: 5 })
    expect(results.some((r) => r.content.includes(TOKEN))).toBe(false)
  })
})

describe('Tải tài liệu tri thức (magic bytes + rà soát nội dung)', () => {
  it('mime pdf nhưng nội dung không phải PDF → từ chối 422, đồng thời không tạo tài liệu', async () => {
    const res = await api()
      .post('/api/v1/chat/knowledge')
      .set(bearer(admin.token))
      .send({
        kieu: 'FILE',
        ten: 'gia-lua.pdf',
        mime: 'pdf',
        noiDung: Buffer.from('day khong phai tep pdf').toString('base64'),
      })
    expect(res.status).toBe(422)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
    const still = await prisma.knowledgeDocument.findMany({ where: { ma: { contains: 'gia-lua' } } })
    expect(still.length).toBe(0)
  })

  it('tải tệp txt hợp lệ → READY, nội dung nằm trong chỉ mục; tìm thấy cho tới khi xóa', async () => {
    const noiDung = Buffer.from('Quy định kiểm thử zuploadkt: ngành giỏi được giảm học phí 20 phần trăm mỗi học kỳ.').toString('base64')
    const res = await api()
      .post('/api/v1/chat/knowledge')
      .set(bearer(admin.token))
      .send({ kieu: 'FILE', ten: 'quy-dinh-kiem-thu.txt', mime: 'txt', noiDung })
    expect(res.status).toBe(201)
    const ma = res.body.data.ma as string
    expect(ma).toMatch(/^KB-/)

    const listing = await api().get('/api/v1/chat/knowledge').set(bearer(admin.token))
    const row = (listing.body.data as Array<{ ma: string; status: string }>).find((d) => d.ma === ma)
    expect(row?.status).toBe('READY')

    let found = await searchKnowledge('zuploadkt', { topK: 10 })
    expect(found.some((r) => r.content.includes('zuploadkt'))).toBe(true)

    const del = await api().delete(`/api/v1/chat/knowledge/${ma}`).set(bearer(admin.token))
    expect(del.status).toBe(200)
    found = await searchKnowledge('zuploadkt', { topK: 10 })
    expect(found.some((r) => r.content.includes('zuploadkt'))).toBe(false)
  })

  it('lập lại chỉ mục qua API → documentCount > 0', async () => {
    const res = await api().post('/api/v1/chat/knowledge/reindex').set(bearer(admin.token))
    expect(res.status).toBe(200)
    expect(Number(res.body.data.documentCount)).toBeGreaterThan(0)
  })
})
