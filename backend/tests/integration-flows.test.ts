import { afterAll, describe, expect, it } from 'vitest'
import {
  api,
  approverFor,
  approveCurrentStep,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  currentStepOf,
  driveToCompletion,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

async function kiemTraHoanThanh(maHoSo: string, studentToken: string, soChuKy: number) {
  const { app } = await currentStepOf(maHoSo)
  expect(app.trangThai).toBe('COMPLETED')
  expect(app.buocDaDuyet).toBe(app.tongSoBuoc)
  expect(app.ngayHoanThanh).not.toBeNull()
  expect(app.hanXuLy).toBeNull()

  const doc = await api()
    .get(`/api/v1/applications/${maHoSo}/document`)
    .set('Authorization', `Bearer ${studentToken}`)
  expect(doc.status).toBe(200)
  expect(doc.body.data.soVanBan).toMatch(/^\d{6}\/\S+$/)
  expect(doc.body.data.chuKy).toHaveLength(soChuKy)
  // Mọi chữ ký đều kiểm chứng được trên nội dung hiện tại của hồ sơ.
  for (const c of doc.body.data.chuKy) {
    expect(c.hopLeThucTe).toBe(true)
    expect(c.provider).toBe('INTERNAL_HMAC')
  }
  expect(doc.body.data.chuKyConHieuLuc).toBe(true)
}

describe('Luồng duyệt nguyên vẹn (tích hợp)', () => {
  it('1 cấp, ONE_CLICK — duyệt nốt một bước là hoàn thành', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    await kiemTraHoanThanh(draft.maHoSo, session.token, 1)

    const { app } = await currentStepOf(draft.maHoSo)
    const nguoiDuocGiao = await prisma.stepInstance.findFirstOrThrow({
      where: { applicationId: app.id },
      select: { assigneeId: true },
    })
    expect(nguoiDuocGiao.assigneeId).not.toBeNull()
  })

  it('2 cấp, ONE_CLICK + OTP — mỗi cấp một chế độ duyệt', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'OTP' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    // Cấp 1: duyệt trực tiếp.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    let cur = await currentStepOf(draft.maHoSo)
    expect(cur.app.trangThai).toBe('PENDING_APPROVAL')
    expect(cur.step!.stepOrder).toBe(2)
    expect(cur.step!.mode).toBe('OTP')

    // Cấp 2: phải gửi OTP rồi mới duyệt được.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    await kiemTraHoanThanh(draft.maHoSo, session.token, 2)

    // Mã OTP của cấp 2 đã bị tiêu thụ.
    const chuaDung = await prisma.otpChallenge.findFirst({
      where: { applicationId: (await currentStepOf(draft.maHoSo)).app.id, daDung: true },
    })
    expect(chuaDung).not.toBeNull()
  })

  it('3 cấp, OTP + ONE_CLICK + ONE_CLICK — hộp thư cập nhật đúng từng cấp', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'OTP' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      { role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    // Cấp 1 (cố vấn của lớp) thấy hồ sơ trước tiên.
    const { user: covan, session: s1 } = await approverFor(student.userId, 'CO_VAN')
    const hopThu1 = await api()
      .get('/api/v1/approvals/pending')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${s1.token}`)
    expect(hopThu1.body.data.some((a: { maHoSo: string }) => a.maHoSo === draft.maHoSo)).toBe(true)

    // Trưởng khoa và phòng đào tạo CHƯA thấy — hồ sơ chưa tới cấp của họ.
    const { user: tk, session: s2 } = await approverFor(student.userId, 'TRUONG_KHOA')
    const hopThu2 = await api()
      .get('/api/v1/approvals/pending')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${s2.token}`)
    expect(hopThu2.body.data.some((a: { maHoSo: string }) => a.maHoSo === draft.maHoSo)).toBe(false)

    // Cấp 1 duyệt (qua OTP) → hồ sơ chuyển tới trưởng khoa.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    const hopThu2Sau = await api()
      .get('/api/v1/approvals/pending')
      .query({ page: 1, pageSize: 50 })
      .set('Authorization', `Bearer ${s2.token}`)
    expect(hopThu2Sau.body.data.some((a: { maHoSo: string }) => a.maHoSo === draft.maHoSo)).toBe(true)

    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    await kiemTraHoanThanh(draft.maHoSo, session.token, 3)
  })

  it('luồng duyệt sửa đổi KHÔNG ảnh hưởng hồ sơ đang chạy (đóng băng ảnh chụp)', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { maWf, requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)
    const lanDau = await currentStepOf(draft.maHoSo)
    expect(lanDau.app.tongSoBuoc).toBe(2)

    // Quản trị viên SỬA luồng: thêm bước 3 và đổi tên luồng.
    const admin = await login('admin')
    const patchWf = await api()
      .patch(`/api/v1/workflows/${maWf}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        ten: 'Luồng kiểm thử (đã sửa)',
        steps: [
          { ten: 'Cố vấn duyệt', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 24, order: 1, allowReject: true, allowSupplement: true },
          { ten: 'Trưởng khoa duyệt', role: 'TRUONG_KHOA', mode: 'ONE_CLICK', slaHours: 24, order: 2, allowReject: true, allowSupplement: true },
          { ten: 'Phòng đào tạo duyệt', role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK', slaHours: 24, order: 3, allowReject: true, allowSupplement: true },
        ],
      })
    expect(patchWf.status).toBe(200)

    // Hồ sơ đang chạy GIỮ NGUYÊN 2 cấp và ảnh chụp ban đầu.
    const sau = await currentStepOf(draft.maHoSo)
    expect(sau.app.tongSoBuoc).toBe(2)
    const snap = sau.app.workflowSnapshot as { steps: unknown[]; version: number }
    expect(snap.steps).toHaveLength(2)

    // Hồ sơ nộp SAU mới dùng luồng 3 cấp.
    const draft2 = await createDraft(session, requestType.id)
    await submit(session, draft2.maHoSo)
    const moi = await currentStepOf(draft2.maHoSo)
    expect(moi.app.tongSoBuoc).toBe(3)
  })

  it('driveToCompletion xử lý được luồng 1 cấp có OTP', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'OTP' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const app = await driveToCompletion(draft.maHoSo, student.userId)
    expect(app.trangThai).toBe('COMPLETED')

    // Mã OTP đã được tiêu thụ và không còn hiệu lực.
    const challenge = await prisma.otpChallenge.findFirst({
      where: { applicationId: app.id },
      select: { daDung: true },
    })
    expect(challenge?.daDung).toBe(true)
  })
})
