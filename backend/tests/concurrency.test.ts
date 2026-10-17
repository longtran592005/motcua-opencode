import { afterAll, describe, expect, it } from 'vitest'
import { takeCapturedOtp } from '../src/modules/otp/channel'
import { actorOf, transition } from '../src/modules/workflow/engine'
import {
  api,
  approverFor,
  approveCurrentStep,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  currentStepOf,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

describe('Đồng thời: hai người duyệt cùng một bước', () => {
  it('chạy song song thật → chỉ một người thắng, người kia bị từ chối', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.stepOrder).toBe(1)

    const { session: nguoiA } = await approverFor(student.userId, 'CO_VAN')
    const { session: nguoiB } = await approverFor(student.userId, 'CO_VAN')

    const guiDuyet = (token: string) =>
      api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'duyệt song song' })

    const [a, b] = await Promise.all([guiDuyet(nguoiA.token), guiDuyet(nguoiB.token)])
    const ketQua = [a, b]
    const thanhCong = ketQua.filter((r) => r.status === 200)
    const thatBai = ketQua.filter((r) => r.status !== 200)

    expect(thanhCong).toHaveLength(1)
    expect(thatBai).toHaveLength(1)

    // Người thua luôn nhận 403 (không còn quyền ở bước mới) hoặc 409 với mã
    // ALREADY_PROCESSED (bước họ đang xử lý đã bị người khác xử lý).
    const thua = thatBai[0]
    expect([403, 409]).toContain(thua.status)
    if (thua.status === 409) {
      expect(thua.body.error.code).toBe('ALREADY_PROCESSED')
    }

    // Không có chuyện duyệt hai lần: đúng MỘT bản ghi APPROVE ở bước 1.
    const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
    const soLanDuyet = await prisma.approval.count({
      where: { applicationId: app.id, buocOrder: 1, hanhDong: 'APPROVE' },
    })
    expect(soLanDuyet).toBe(1)
    expect(app.buocDaDuyet).toBe(1)
    expect(app.currentStepOrder).toBe(2)
    expect(app.trangThai).toBe('PENDING_APPROVAL')

    const soChuKy = await prisma.signature.count({ where: { applicationId: app.id } })
    expect(soChuKy).toBe(1)
  })

  it('bước đã bị xử lý trong lúc chờ khoá → ALREADY_PROCESSED (kiểm tra tất định)', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    const { user: covan } = await approverFor(student.userId, 'CO_VAN')

    // Người B đã "đọc thấy bước 1" (đây là điều service ghi lại trước giao dịch)…
    const buocNguoiBThay = step!.stepOrder
    // …rồi người A duyệt xong trước.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)

    const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
    // Người B vào giao dịch sau: bước 1 đã APPROVED dù hồ sơ đã sang bước 2.
    await expect(
      transition({
        action: 'APPROVE',
        appId: app.id,
        actor: actorOf(covan as never),
        expectedStepOrder: buocNguoiBThay,
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_PROCESSED' })

    // Và không có bản ghi duyệt nào thêm.
    const soLanDuyet = await prisma.approval.count({
      where: { applicationId: app.id, buocOrder: 1, hanhDong: 'APPROVE' },
    })
    expect(soLanDuyet).toBe(1)
  })
})

describe('Đồng thời: năm lượt nhập sai OTP song song', () => {
  it('đếm đúng 5 lượt và khoá 15 phút', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'OTP' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    const { session: approver } = await approverFor(student.userId, 'CO_VAN')

    const send = await api()
      .post('/api/v1/otp/send')
      .set(bearer(approver.token))
      .send({ maHoSo: draft.maHoSo })
    expect(send.status).toBe(200)
    const challengeId = send.body.data.challengeId as string
    const dung = takeCapturedOtp(challengeId)!
    // Chọn một mã CHẮC CHẮN sai.
    const sai = dung === '000000' ? '111111' : '000000'

    const lucBatDau = Date.now()
    const ketQua = await Promise.all(
      Array.from({ length: 5 }, () =>
        api()
          .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
          .set(bearer(approver.token))
          .set('Idempotency-Key', idemKey())
          .send({ challengeId, otp: sai }),
      ),
    )

    // Không lượt nào được duyệt; tất cả đều là lỗi OTP.
    for (const r of ketQua) {
      expect([400, 423]).toContain(r.status)
      expect(['OTP_INVALID', 'OTP_LOCKED']).toContain(r.body.error.code)
    }
    expect(ketQua.some((r) => r.status === 423)).toBe(true)

    const challenge = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } })
    expect(challenge.soLanThu).toBe(5)
    expect(challenge.soLanConLai).toBe(0)
    expect(challenge.daDung).toBe(false)
    expect(challenge.khoaDenLuc).not.toBeNull()

    // Khoá đúng 15 phút (cho phép sai lệch nhỏ của đồng hồ giữa các bước).
    const conLai = challenge.khoaDenLuc!.getTime() - lucBatDau
    expect(conLai).toBeGreaterThan(15 * 60_000 - 10_000)
    expect(conLai).toBeLessThanOrEqual(15 * 60_000 + 5_000)

    // Đến mã ĐÚNG cũng bị khoá.
    const dungSauKhiKhoa = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approver.token))
      .set('Idempotency-Key', idemKey())
      .send({ challengeId, otp: dung })
    expect(dungSauKhiKhoa.status).toBe(423)
    expect(dungSauKhiKhoa.body.error.code).toBe('OTP_LOCKED')

    // Bước vẫn nguyên trạng, chưa có chữ ký nào.
    const sau = await currentStepOf(draft.maHoSo)
    expect(sau.step!.trangThai).toBe('IN_PROGRESS')
    expect(sau.step!.stepOrder).toBe(step!.stepOrder)
    const soChuKy = await prisma.signature.count({ where: { applicationId: sau.app.id } })
    expect(soChuKy).toBe(0)
  })
})
