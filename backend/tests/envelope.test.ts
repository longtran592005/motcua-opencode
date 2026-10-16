import { afterAll, describe, expect, it } from 'vitest'
import {
  api,
  bearer,
  buildDraftBody,
  cleanupTracked,
  createDraft,
  fetchRequestType,
  idemKey,
  login,
  pickRequestTypeId,
  prisma,
  trackApplication,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
})

describe('Khuôn phản hồi thống nhất', () => {
  it('thành công trả { success: true, data, error: null }', async () => {
    const session = await login('20211234')
    const res = await api().get('/api/v1/auth/me').set(bearer(session.token))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.error).toBeNull()
    expect(res.body.data.maSo).toBe('20211234')
  })

  it('danh sách phân trang có meta { page, pageSize, total, totalPages }', async () => {
    const session = await login('20211234')
    const res = await api()
      .get('/api/v1/applications/mine?page=1&pageSize=5')
      .set(bearer(session.token))

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.meta.page).toBe(1)
    expect(res.body.meta.pageSize).toBe(5)
    expect(typeof res.body.meta.total).toBe('number')
    expect(typeof res.body.meta.totalPages).toBe('number')
  })

  it('lỗi cũng dùng đúng khuôn { success: false, data: null, error }', async () => {
    const res = await api().get('/api/v1/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.data).toBeNull()
    expect(res.body.error.code).toBe('UNAUTHORIZED')
    expect(typeof res.body.error.message).toBe('string')
  })
})

describe('Ánh xạ mã lỗi → HTTP (docs/QUYET_DINH.md)', () => {
  it('UNAUTHORIZED | 401', async () => {
    const res = await api().get('/api/v1/applications/mine').set(bearer('khong-hop-le'))
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('NOT_FOUND | 404 — đường dẫn không tồn tại', async () => {
    const session = await login('20211234')
    const res = await api().get('/api/v1/khong-ton-tai').set(bearer(session.token))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('NOT_FOUND | 404 — hồ sơ không tồn tại', async () => {
    const session = await login('20211234')
    const res = await api().get('/api/v1/applications/MC-2026-999999').set(bearer(session.token))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('VALIDATION_ERROR | 422 kèm details', async () => {
    const res = await api().post('/api/v1/auth/login').send({ dinhDanh: '', matKhau: '' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(res.body.error.details.truongLoi)).toBe(true)
  })

  it('VALIDATION_ERROR | 422 — thiếu Idempotency-Key ở thao tác ghi', async () => {
    const session = await login('20211234')
    const rt = await pickRequestTypeId()
    const body = buildDraftBody(await fetchRequestType(rt))
    const res = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .send(body)
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.truongThieu).toContain('idempotency-key')
  })

  it('VALIDATION_ERROR | 422 — mã nghiệp vụ không được có dạng UUID (B1a)', async () => {
    const admin = await login('admin')
    const res = await api()
      .post('/api/v1/catalog/khoa')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: '3f1a1d2e-4b5c-4d6e-8f90-1234567890ab',
        ten: 'Khoa kiểm thử',
        vietTat: 'KTT',
      })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('FORBIDDEN_SCOPE | 403', async () => {
    const session = await login('20211234')
    const res = await api()
      .get('/api/v1/audit-logs')
      .set(bearer(session.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('INVALID_TRANSITION | 409 — nộp lại hồ sơ đã nộp', async () => {
    const session = await login('20211234')
    const draft = await createDraft(session, await pickRequestTypeId())
    const first = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/submit`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(first.status).toBe(200)

    const second = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/submit`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('MISSING_ATTACHMENT | 422 — thiếu giấy tờ bắt buộc', async () => {
    const session = await login('20211234')
    const rtId = await pickRequestTypeId()
    const rt = await fetchRequestType(rtId)
    const requiredDocs = rt.giayTo.filter((g) => g.batBuoc)
    if (!requiredDocs.length) {
      // Loại đơn này không yêu cầu giấy tờ bắt buộc → bỏ qua ca kiểm thử.
      expect(requiredDocs.length).toBe(0)
      return
    }

    const createRes = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ ...buildDraftBody(rt), tepDinhKem: [] })
    expect(createRes.status).toBe(201)
    trackApplication(createRes.body.data.maHoSo)

    const res = await api()
      .post(`/api/v1/applications/${createRes.body.data.maHoSo}/submit`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('MISSING_ATTACHMENT')
    expect(res.body.error.details.giayToThieu.length).toBeGreaterThan(0)
  })

  it('DUPLICATE_ACTION | 409 — cùng khóa, khác nội dung', async () => {
    const session = await login('20211234')
    const rt = await fetchRequestType(await pickRequestTypeId())
    const body = buildDraftBody(rt)
    const key = idemKey()

    const first = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .set('Idempotency-Key', key)
      .send(body)
    expect(first.status).toBe(201)
    trackApplication(first.body.data.maHoSo)

    const second = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .set('Idempotency-Key', key)
      .send({ ...body, duLieu: { ...body.duLieu, truongKhac: 1 } })

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('DUPLICATE_ACTION')
  })

  it('gửi lại y hệt với cùng khóa trả lại nguyên kết quả cũ (không lỗi)', async () => {
    const session = await login('20211234')
    const rt = await fetchRequestType(await pickRequestTypeId())
    const body = buildDraftBody(rt)
    const key = idemKey()

    const first = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .set('Idempotency-Key', key)
      .send(body)
    expect(first.status).toBe(201)
    trackApplication(first.body.data.maHoSo)

    const replay = await api()
      .post('/api/v1/applications')
      .set(bearer(session.token))
      .set('Idempotency-Key', key)
      .send(body)

    expect(replay.status).toBe(201)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect(replay.body.data.maHoSo).toBe(first.body.data.maHoSo)
  })

  it('khóa idempotency được lưu và có hạn 24 giờ', async () => {
    const count = await prisma.idempotencyKey.count()
    expect(count).toBeGreaterThan(0)
    const row = await prisma.idempotencyKey.findFirst({ orderBy: { createdAt: 'desc' } })
    expect(row).not.toBeNull()
    const hours = (row!.expiresAt.getTime() - row!.createdAt.getTime()) / 3_600_000
    expect(hours).toBeCloseTo(24, 0)
  })
})
