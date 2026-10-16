import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  api,
  bearer,
  cleanupTracked,
  createDraft,
  idemKey,
  login,
  pickRequestTypeId,
  prisma,
  twoStudents,
  type Session,
} from './helpers'

let sessionA: Session
let sessionB: Session
let studentAId: string
let draft: { id: string; maHoSo: string }

beforeAll(async () => {
  const [a, b] = await twoStudents()
  studentAId = a.userId
  sessionA = await login(a.user.maSo)
  sessionB = await login(b.user.maSo)
  draft = await createDraft(sessionA, await pickRequestTypeId())
})

afterAll(async () => {
  await cleanupTracked()
})

describe('Chống IDOR — cùng tài nguyên, hai dạng định danh', () => {
  it('sinh viên A đọc được hồ sơ của mình bằng CẢ mã hồ sơ và UUID', async () => {
    const byCode = await api().get(`/api/v1/applications/${draft.maHoSo}`).set(bearer(sessionA.token))
    const byId = await api().get(`/api/v1/applications/${draft.id}`).set(bearer(sessionA.token))

    expect(byCode.status).toBe(200)
    expect(byId.status).toBe(200)
    expect(byCode.body.data.maHoSo).toBe(draft.maHoSo)
    expect(byId.body.data.maHoSo).toBe(draft.maHoSo)
  })

  it('sinh viên B bị chặn khi đọc theo MÃ HỒ SƠ', async () => {
    const res = await api().get(`/api/v1/applications/${draft.maHoSo}`).set(bearer(sessionB.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('sinh viên B bị chặn khi đọc theo UUID nội bộ', async () => {
    const res = await api().get(`/api/v1/applications/${draft.id}`).set(bearer(sessionB.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('sinh viên B bị chặn khi sửa, xoá và nộp hồ sơ của A', async () => {
    const payload = { requestTypeId: draft.id, duLieu: {}, tepDinhKem: [] }

    const put = await api()
      .put(`/api/v1/applications/${draft.maHoSo}`)
      .set(bearer(sessionB.token))
      .set('Idempotency-Key', idemKey())
      .send(payload)
    expect(put.status).toBe(403)
    expect(put.body.error.code).toBe('FORBIDDEN_SCOPE')

    const del = await api()
      .delete(`/api/v1/applications/${draft.maHoSo}`)
      .set(bearer(sessionB.token))
    expect(del.status).toBe(403)

    const submit = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/submit`)
      .set(bearer(sessionB.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(submit.status).toBe(403)

    const cancel = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
      .set(bearer(sessionB.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(cancel.status).toBe(403)
  })

  it('sinh viên B bị chặn khi phê duyệt hồ sơ của A', async () => {
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionB.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'thử vượt quyền' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('cố vấn của lớp khác bị chặn', async () => {
    const advisor = await prisma.user.findFirst({
      where: { role: 'CO_VAN', deletedAt: null },
    })
    const classOfA = await prisma.student.findUnique({ where: { userId: studentAId } })
    if (!advisor || advisor.id === classOfA?.classId) return

    const other = await prisma.user.findFirst({
      where: {
        role: 'CO_VAN',
        deletedAt: null,
        advisedClasses: { none: { id: classOfA?.classId ?? '' } },
      },
    })
    if (!other) return

    const session = await login(other.maSo)
    const res = await api().get(`/api/v1/applications/${draft.maHoSo}`).set(bearer(session.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('UUID hợp lệ nhưng không tồn tại → NOT_FOUND (không lộ thông tin)', async () => {
    const res = await api()
      .get('/api/v1/applications/00000000-0000-0000-0000-000000000123')
      .set(bearer(sessionA.token))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('văn bản của hồ sơ khác không truy cập được bằng mã hồ sơ', async () => {
    const res = await api()
      .get(`/api/v1/applications/${draft.maHoSo}/document`)
      .set(bearer(sessionB.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })
})

describe('Thao tác ghi theo mã nghiệp vụ hoặc UUID (B1b/B1c)', () => {
  it('sửa và xoá danh mục bằng mã nghiệp vụ, và bằng UUID', async () => {
    const admin = await login('admin')
    const ma = `k_kt_${Date.now()}`

    const created = await api()
      .post('/api/v1/catalog/khoa')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ ma, ten: 'Khoa Kiểm thử Tự động', vietTat: 'KTTĐ' })
    expect(created.status).toBe(201)
    const id = created.body.data.id as string

    // Sửa bằng MÃ NGHIỆP VỤ.
    const byMa = await api()
      .patch(`/api/v1/catalog/khoa/${ma}`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ ten: 'Khoa Kiểm thử (đã đổi tên)' })
    expect(byMa.status).toBe(200)
    expect(byMa.body.data.ten).toBe('Khoa Kiểm thử (đã đổi tên)')

    // Sửa cùng bản ghi bằng UUID nội bộ.
    const byId = await api()
      .patch(`/api/v1/catalog/khoa/${id}`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ vietTat: 'KTT' })
    expect(byId.status).toBe(200)
    expect(byId.body.data.vietTat).toBe('KTT')
    expect(byId.body.data.id).toBe(id)

    // Xoá bằng MÃ NGHIỆP VỤ.
    const del = await api()
      .delete(`/api/v1/catalog/khoa/${ma}`)
      .set(bearer(admin.token))
    expect(del.status).toBe(204)

    const list = await api().get('/api/v1/catalog/khoa').set(bearer(admin.token))
    expect((list.body.data as Array<{ ma: string }>).some((f) => f.ma === ma)).toBe(false)
  })
})
