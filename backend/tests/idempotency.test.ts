import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  api,
  approverFor,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  login,
  prisma,
  submit,
  trackApplication,
  twoStudents,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

const idemKey = () => randomUUID()

/** Tao mot ho so nhop da duyet de kiem thu idempotency (phai duyet bang tai khoan co quyen). */
async function taoHoSoNhop() {
  const [student] = await twoStudents()
  const session = await login(student.user.maSo)
  const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
  const draft = await createDraft(session, requestType.id)
  await submit(session, draft.maHoSo)
  const { session: approver } = await approverFor(student.userId, 'CO_VAN')
  return { session, approverSession: approver, draft }
}

describe('Idempotency-Key', () => {
  it('cung key + cung body -> tra lai ket qua cu (khong tac dung 2 lan)', async () => {
    const { approverSession, draft } = await taoHoSoNhop()
    const key = idemKey()
    const body = { ghiChu: 'Duyệt với khóa idempotency.' }

    const lan1 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(lan1.status).toBe(200)

    const lan2 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(lan2.status).toBe(200)
    expect(lan2.headers['idempotency-replayed']).toBe('true')
    expect(lan2.body.data.maHoSo).toBe(lan1.body.data.maHoSo)
    expect(lan2.body.data.trangThai).toBe(lan1.body.data.trangThai)

    // Ho so da hoan thanh sau lan dau tien; lan 2 khong tao them hieu ung.
    const approvals = await prisma.approval.count({
      where: { applicationId: draft.id, hanhDong: 'APPROVE' },
    })
    expect(approvals).toBe(1)
  })

  it('cung key + body khac -> DUPLICATE_ACTION', async () => {
    const { approverSession, draft } = await taoHoSoNhop()
    const key = idemKey()

    const lan1 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Ghi chú lần 1.' })
    expect(lan1.status).toBe(200)

    const lan2 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Ghi chú lần 2 — NỘI DUNG KHÁC.' })
    expect(lan2.status).toBe(409)
    expect(lan2.body.error.code).toBe('DUPLICATE_ACTION')
    expect(lan2.headers['idempotency-replayed']).toBeUndefined()

    // Lan 2 khong tac dung gi.
    const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
    expect(app.buocDaDuyet).toBe(1)
  })

  it('cung key + endpoint khac -> DUPLICATE_ACTION', async () => {
    const { session, draft } = await taoHoSoNhop()
    const key = idemKey()

    // Tao nhap voi key nay (endpoint POST /applications).
    const tao = await api()
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${session.token}`)
      .set('Idempotency-Key', key)
      .send({
        requestTypeId: (await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo }, select: { requestTypeId: true } })).requestTypeId,
        duLieu: { lyDo: 'Kiem thu idempotency.' },
        tepDinhKem: [],
      })
    expect(tao.status).toBe(201)
    trackApplication(tao.body.data.maHoSo)

    // Cung key nhung endpoint khac (POST /applications/{ma}/submit) -> conflict.
    const nop = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/submit`)
      .set('Authorization', `Bearer ${session.token}`)
      .set('Idempotency-Key', key)
      .send({})
    expect(nop.status).toBe(409)
    expect(nop.body.error.code).toBe('DUPLICATE_ACTION')
  })

  it('thieu key -> VALIDATION_ERROR', async () => {
    const { approverSession, draft } = await taoHoSoNhop()
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .send({ ghiChu: 'Không có key.' })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('key het han (quá 24h) -> cho phep gui lai', async () => {
    const { approverSession, draft } = await taoHoSoNhop()
    const key = idemKey()
    const body = { ghiChu: 'Duyệt.' }

    const lan1 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(lan1.status).toBe(200)

    // Gia lap key da het han.
    await prisma.idempotencyKey.updateMany({
      where: { key },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    // Lan gui lai duoc xu ly binh thuong (khong phai replay).
    const lan2 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set('Authorization', `Bearer ${approverSession.token}`)
      .set('Idempotency-Key', key)
      .send(body)
    // Ho so da hoan thanh -> INVALID_TRANSION, chung to khong con hoat dong.
    expect(lan2.status).toBe(409)
    expect(lan2.body.error.code).toBe('INVALID_TRANSITION')
    expect(lan2.headers['idempotency-replayed']).toBeUndefined()
  })

  it('key qua nguoi dung khac -> khong xung dot', async () => {
    // Tim hai CO_VAN KHAU NHAU (khac user) de kiem thu.
    const covan1 = await prisma.user.findFirstOrThrow({
      where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const covan2 = await prisma.user.findFirstOrThrow({
      where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null, id: { not: covan1.id } },
      orderBy: { maSo: 'asc' },
    })
    // Tim sinh vien thuoc lop ma moi CO_VAN huong dan.
    const sv1 = await prisma.student.findFirstOrThrow({
      where: { class: { coVanId: covan1.id } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    const sv2 = await prisma.student.findFirstOrThrow({
      where: { class: { coVanId: covan2.id } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    const key = idemKey()

    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const d1 = await createDraft(await login(sv1.user.maSo), requestType.id)
    const d2 = await createDraft(await login(sv2.user.maSo), requestType.id)
    await submit(await login(sv1.user.maSo), d1.maHoSo)
    await submit(await login(sv2.user.maSo), d2.maHoSo)

    const s1 = await login(covan1.maSo)
    const s2 = await login(covan2.maSo)

    const l1 = await api()
      .post(`/api/v1/approvals/${d1.maHoSo}/approve`)
      .set('Authorization', `Bearer ${s1.token}`)
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Cùng key.' })
    expect(l1.status).toBe(200)

    // Cung key nhung nguoi dung khac -> khong conflict.
    const l2 = await api()
      .post(`/api/v1/approvals/${d2.maHoSo}/approve`)
      .set('Authorization', `Bearer ${s2.token}`)
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Cùng key.' })
    expect(l2.status).toBe(200)
  })
})
