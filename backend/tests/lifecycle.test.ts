import { afterAll, describe, expect, it } from 'vitest'
import { takeCapturedOtp } from '../src/modules/otp/channel'
import {
  api,
  bearer,
  cleanupTracked,
  createDraft,
  currentStepOf,
  driveToCompletion,
  idemKey,
  login,
  pickRequestTypeId,
  prisma,
  submit,
  twoStudents,
  userForRole,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
})

async function hasOtpStep(): Promise<boolean> {
  const step = await prisma.workflowStep.findFirst({ where: { mode: 'OTP' } })
  return step !== null
}

/** Duyệt tuần tự cho tới khi gặp bước yêu cầu ký OTP. */
async function advanceToOtpStep(maHoSo: string, studentUserId: string) {
  for (let i = 0; i < 8; i += 1) {
    const { step } = await currentStepOf(maHoSo)
    if (!step) throw new Error('Hồ sơ không còn bước xử lý.')
    if (step.mode === 'OTP') return step
    const approver = await userForRole(studentUserId, step.role)
    if (!approver) throw new Error(`Không tìm được người dùng vai trò ${step.role}.`)
    const session = await login(approver.maSo)
    const res = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt để tới bước OTP.' })
    if (res.status !== 200) {
      throw new Error(`Duyệt bước ${step.stepOrder} thất bại: ${JSON.stringify(res.body)}`)
    }
  }
  throw new Error('Không gặp bước OTP nào.')
}

describe('Vòng đời hồ sơ đầu-cuối', () => {
  it('nộp → duyệt nhiều cấp (gồm cả OTP) → cấp văn bản → tra cứu công khai → thu hồi', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const requestTypeId = await pickRequestTypeId(true)

    const draft = await createDraft(session, requestTypeId)
    await submit(session, draft.maHoSo)
    await driveToCompletion(draft.maHoSo, student.userId)

    const detail = await api()
      .get(`/api/v1/applications/${draft.maHoSo}`)
      .set(bearer(session.token))
    expect(detail.status).toBe(200)
    expect(detail.body.data.trangThai).toBe('COMPLETED')
    expect(detail.body.data.vanBanId).toBeTruthy()
    expect(detail.body.data.tokenXacThuc).toBeTruthy()
    expect(detail.body.data.soVanBan).toBeTruthy()

    const tokens = [detail.body.data.tokenXacThuc as string, detail.body.data.soVanBan as string]

    // Nhật ký nghiệp vụ ghi đủ các mốc chính.
    const actions = (detail.body.data.lichSu as Array<{ hanhDong: string }>).map((a) => a.hanhDong)
    expect(actions).toContain('SUBMIT')
    expect(actions).toContain('APPROVE')
    expect(actions).toContain('ISSUE_DOCUMENT')

    // Tra cứu công khai bằng mã QR.
    const verify = await api().get(`/api/v1/public/verify/token/${tokens[0]}`)
    expect(verify.status).toBe(200)
    expect(verify.body.data.trangThai).toBe('VALID')
    expect(verify.body.data.vanBan.soVanBan).toBe(detail.body.data.soVanBan)

    // Văn bản đã ký: tải về được và ghi vết lượt tải.
    const download = await api()
      .post(`/api/v1/documents/${detail.body.data.vanBanId}/download-log`)
      .set(bearer(session.token))
    expect(download.status).toBe(200)
    expect(download.body.data.luotTai.length).toBeGreaterThan(0)

    // Thu hồi văn bản (Phòng Đào tạo) — gọi bằng số văn bản (định danh nghiệp vụ).
    const pdt = await login('pdt001')
    const revoke = await api()
      .post(`/api/v1/documents/${encodeURIComponent(detail.body.data.soVanBan as string)}/revoke`)
      .set(bearer(pdt.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Phát hiện sai sót thông tin, cần cấp lại.' })
    expect(revoke.status).toBe(200)
    expect(revoke.body.data.trangThai).toBe('REVOKED')

    const verifyAfter = await api().get(`/api/v1/public/verify/token/${tokens[0]}`)
    expect(verifyAfter.status).toBe(200)
    expect(verifyAfter.body.data.trangThai).toBe('REVOKED')

    // Văn bản đã thu hồi: không đối chiếu được → DOCUMENT_REVOKED (410).
    const compare = await api()
      .post(`/api/v1/public/verify/token/${tokens[0]}/compare`)
      .send({ maBamNguoiDung: 'a'.repeat(64) })
    expect(compare.status).toBe(410)
    expect(compare.body.error.code).toBe('DOCUMENT_REVOKED')

    // Không tải được văn bản đã thu hồi.
    const downloadAfter = await api()
      .post(`/api/v1/documents/${detail.body.data.vanBanId}/download-log`)
      .set(bearer(session.token))
    expect(downloadAfter.status).toBe(410)
    expect(downloadAfter.body.error.code).toBe('DOCUMENT_REVOKED')
  })

  it('rút hồ sơ khi chưa cấp nào duyệt', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const draft = await createDraft(session, await pickRequestTypeId())
    await submit(session, draft.maHoSo)

    const res = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Sinh viên đổi nguyện vọng.' })
    expect(res.status).toBe(200)
    expect(res.body.data.trangThai).toBe('CANCELLED')

    const second = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('INVALID_TRANSITION')
  })
})

describe('Mã lỗi OTP', () => {
  it('OTP_INVALID (400) → OTP_LOCKED (423) → OTP_EXPIRED (410)', async () => {
    if (!(await hasOtpStep())) {
      expect(await hasOtpStep()).toBe(false)
      return
    }

    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const draft = await createDraft(session, await pickRequestTypeId(true))
    await submit(session, draft.maHoSo)
    const step = await advanceToOtpStep(draft.maHoSo, student.userId)

    const approver = await userForRole(student.userId, step.role)
    const approverSession = await login(approver!.maSo)

    const send = await api()
      .post('/api/v1/otp/send')
      .set(bearer(approverSession.token))
      .send({ maHoSo: draft.maHoSo })
    expect(send.status).toBe(200)
    // OTP KHÔNG bao giờ nằm trong response — chỉ đi qua kênh gửi (CAPTURE khi test).
    expect(send.body.data.devOtp).toBeUndefined()
    expect(send.body.data.otp).toBeUndefined()
    const challengeId = send.body.data.challengeId as string
    const sentOtp = takeCapturedOtp(challengeId)
    expect(sentOtp).toMatch(/^\d{6}$/)

    const wrong = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approverSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ challengeId, otp: '000000' })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.code).toBe('OTP_INVALID')
    expect(wrong.body.error.details.soLanConLai).toBeDefined()

    let locked = wrong
    for (let i = 0; i < 4; i += 1) {
      locked = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(approverSession.token))
        .set('Idempotency-Key', idemKey())
        .send({ challengeId, otp: '000001' })
    }
    expect(locked.status).toBe(423)
    expect(locked.body.error.code).toBe('OTP_LOCKED')

    // Gửi lại mã mới (phiên OTP mới) rồi đẩy hạn dùng về quá khứ.
    const resend = await api()
      .post('/api/v1/otp/send')
      .set(bearer(approverSession.token))
      .send({ maHoSo: draft.maHoSo })
    expect(resend.status).toBe(200)
    const freshId = resend.body.data.challengeId as string
    const freshOtp = takeCapturedOtp(freshId) as string

    await prisma.otpChallenge.update({
      where: { id: freshId },
      data: { hetHanLuc: new Date(Date.now() - 60_000) },
    })

    const expired = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approverSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ challengeId: freshId, otp: freshOtp })
    expect(expired.status).toBe(410)
    expect(expired.body.error.code).toBe('OTP_EXPIRED')

    // Với mã đúng và còn hạn thì phê duyệt thành công.
    const ok = await api()
      .post('/api/v1/otp/send')
      .set(bearer(approverSession.token))
      .send({ maHoSo: draft.maHoSo })
    const okId = ok.body.data.challengeId as string
    const approved = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approverSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ challengeId: okId, otp: takeCapturedOtp(okId) })
    expect(approved.status).toBe(200)
    expect(approved.body.data.lichSu.some((a: { phuongThuc?: string }) => a.phuongThuc === 'OTP')).toBe(
      true,
    )
  })

  it('gửi OTP cho bước không yêu cầu OTP → 422', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const draft = await createDraft(session, await pickRequestTypeId())
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    if (step?.mode === 'OTP') return

    const approver = await userForRole(student.userId, step!.role)
    const approverSession = await login(approver!.maSo)
    const res = await api()
      .post('/api/v1/otp/send')
      .set(bearer(approverSession.token))
      .send({ maHoSo: draft.maHoSo })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('Tranh chấp xử lý đồng thời', () => {
  it('bước đã bị người khác xử lý → ALREADY_PROCESSED (409)', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const draft = await createDraft(session, await pickRequestTypeId())
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step).not.toBeNull()

    // Mô phỏng: một người khác đã xử lý xong bước này.
    await prisma.stepInstance.update({
      where: { id: step!.id },
      data: { trangThai: 'APPROVED', completedAt: new Date() },
    })

    const approver = await userForRole(student.userId, step!.role)
    const approverSession = await login(approver!.maSo)
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approverSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'duyệt trùng' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_PROCESSED')
  })

  it('từ chối và yêu cầu bổ sung ghi đúng trạng thái', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)

    // Từ chối
    const rejected = await createDraft(session, await pickRequestTypeId())
    await submit(session, rejected.maHoSo)
    const r1 = await currentStepOf(rejected.maHoSo)
    const approver1 = await login((await userForRole(student.userId, r1.step!.role))!.maSo)
    const rejectRes = await api()
      .post(`/api/v1/approvals/${rejected.maHoSo}/reject`)
      .set(bearer(approver1.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Thông tin không khớp hồ sơ gốc.' })
    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.data.trangThai).toBe('REJECTED')
    expect(rejectRes.body.data.lyDoTuChoi).toBe('Thông tin không khớp hồ sơ gốc.')

    // Yêu cầu bổ sung rồi sinh viên bổ sung
    const supplement = await createDraft(session, await pickRequestTypeId())
    await submit(session, supplement.maHoSo)
    const s1 = await currentStepOf(supplement.maHoSo)
    const approver2 = await login((await userForRole(student.userId, s1.step!.role))!.maSo)
    const askRes = await api()
      .post(`/api/v1/approvals/${supplement.maHoSo}/request-supplement`)
      .set(bearer(approver2.token))
      .set('Idempotency-Key', idemKey())
      .send({ noiDung: 'Bổ sung bản sao công chứng.' })
    expect(askRes.status).toBe(200)
    expect(askRes.body.data.trangThai).toBe('NEED_SUPPLEMENT')

    const replyRes = await api()
      .post(`/api/v1/applications/${supplement.maHoSo}/supplement`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Đã bổ sung bản sao công chứng.' })
    expect(replyRes.status).toBe(200)
    expect(replyRes.body.data.trangThai).toBe('PENDING_APPROVAL')
  })
})
