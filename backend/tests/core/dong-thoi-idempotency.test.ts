/**
 * BỘ KIỂM THỬ LÕI 4: ĐỒNG THỜI VÀ TÍNH LŨY ĐẲNG (CONCURRENCY & IDEMPOTENCY)
 *
 * Kiểm tra: Tranh chấp duyệt song song (FOR UPDATE lock), 10 đơn song song,
 * idempotency replay, duplicate action và tính duy nhất của số văn bản.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  api,
  approverFor,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  currentStepOf,
  driveToCompletion,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
  type Session,
} from '../helpers'

describe('4. Đồng thời và Tính lũy đẳng (Concurrency & Idempotency)', () => {
  let sv: Session
  let studentUserId: string

  beforeAll(async () => {
    sv = await login('sv001')
    studentUserId = sv.user.id
  })

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  // 1. Hai người duyệt cùng một bước song song -> một thắng, một nhận ALREADY_PROCESSED
  it('Hai người duyệt cùng một bước song song: đúng 1 người thắng, người kia nhận ALREADY_PROCESSED', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { session: cvA } = await approverFor(studentUserId, 'CO_VAN')
    const { session: cvB } = await approverFor(studentUserId, 'CO_VAN')

    const guiDuyet = (token: string) =>
      api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'Duyệt song song' })

    const [resA, resB] = await Promise.all([guiDuyet(cvA.token), guiDuyet(cvB.token)])
    const ketQua = [resA, resB]
    const thanhCong = ketQua.filter((r) => r.status === 200)
    const thatBai = ketQua.filter((r) => r.status !== 200)

    expect(thanhCong).toHaveLength(1)
    expect(thatBai).toHaveLength(1)

    const resThua = thatBai[0]
    expect([403, 409]).toContain(resThua.status)
    if (resThua.status === 409) {
      expect(resThua.body.error?.code).toBe('ALREADY_PROCESSED')
    }

    // Đúng 1 bản ghi duyệt ở bước 1 trong CSDL
    const soLanDuyet = await prisma.approval.count({
      where: { application: { maHoSo: draft.maHoSo }, buocOrder: 1, hanhDong: 'APPROVE' },
    })
    expect(soLanDuyet).toBe(1)
  })

  // 2. 10 đơn khác nhau được duyệt song song -> không lỗi, không lẫn dữ liệu
  it('10 hồ sơ khác nhau được duyệt song song không bị lỗi và không lẫn dữ liệu', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')

    // Tạo và nộp 10 hồ sơ
    const drafts = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const d = await createDraft(sv, flow.requestType.id)
        await submit(sv, d.maHoSo)
        return d
      }),
    )

    // Duyệt 10 hồ sơ song song
    const approvePromises = drafts.map((d) =>
      api()
        .post(`/api/v1/approvals/${d.maHoSo}/approve`)
        .set(bearer(cvSession.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: `Duyệt song song đơn ${d.maHoSo}` }),
    )
    const results = await Promise.all(approvePromises)

    for (const res of results) {
      expect(res.status).toBe(200)
      expect(res.body.data.trangThai).toBe('COMPLETED')
    }

    // Xác nhận cả 10 hồ sơ đều có đúng 1 văn bản tương ứng
    const docCount = await prisma.signedDocument.count({
      where: { application: { maHoSo: { in: drafts.map((d) => d.maHoSo) } } },
    })
    expect(docCount).toBe(10)
  })

  // 3. Idempotency: cùng key + cùng nội dung -> trả kết quả cũ (idempotency-replayed)
  it('Idempotency: Cùng key và cùng nội dung trả kết quả cũ mà không thực hiện lần hai', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')
    const key = idemKey()
    const payload = { ghiChu: 'Duyệt với khóa lặp' }

    // Lần 1
    const lan1 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', key)
      .send(payload)
    expect(lan1.status).toBe(200)
    expect(lan1.headers['idempotency-replayed']).toBeUndefined()

    // Lần 2 (cùng key, cùng payload)
    const lan2 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', key)
      .send(payload)
    expect(lan2.status).toBe(200)
    expect(lan2.headers['idempotency-replayed']).toBe('true')
    expect(lan2.body.data.maHoSo).toBe(lan1.body.data.maHoSo)

    // Chỉ có đúng 1 bản ghi duyệt
    const approvals = await prisma.approval.count({
      where: { applicationId: draft.id, hanhDong: 'APPROVE' },
    })
    expect(approvals).toBe(1)
  })

  // 4. Idempotency: cùng key + khác nội dung -> DUPLICATE_ACTION (409)
  it('Idempotency: Cùng key nhưng khác nội dung body bị từ chối DUPLICATE_ACTION (409)', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')
    const key = idemKey()

    // Lần 1
    const lan1 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Ghi chú 1' })
    expect(lan1.status).toBe(200)

    // Lần 2 (cùng key, khác payload)
    const lan2 = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', key)
      .send({ ghiChu: 'Ghi chú 2 KHÁC BIỆT' })
    expect(lan2.status).toBe(409)
    expect(lan2.body.error?.code).toBe('DUPLICATE_ACTION')
  })

  // 5. Cấp văn bản đồng thời: số văn bản không trùng
  it('Cấp văn bản đồng thời: Các số văn bản sinh ra là duy nhất và không trùng lặp', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')

    const apps = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const d = await createDraft(sv, flow.requestType.id)
        await submit(sv, d.maHoSo)
        return d
      }),
    )

    // Duyệt đồng thời để sinh văn bản
    await Promise.all(
      apps.map((a) =>
        api()
          .post(`/api/v1/approvals/${a.maHoSo}/approve`)
          .set(bearer(cvSession.token))
          .set('Idempotency-Key', idemKey())
          .send({ ghiChu: 'Cấp văn bản đồng thời' }),
      ),
    )

    const docs = await prisma.signedDocument.findMany({
      where: { application: { maHoSo: { in: apps.map((a) => a.maHoSo) } } },
      select: { soVanBan: true },
    })

    const soList = docs.map((d) => d.soVanBan)
    expect(soList).toHaveLength(5)
    const uniqueSo = new Set(soList)
    expect(uniqueSo.size).toBe(5)
  })
})
