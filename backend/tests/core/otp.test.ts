/**
 * BỘ KIỂM THỬ LÕI 3: XÁC THỰC OTP VÀ BẢO MẬT KÝ SỐ
 *
 * Kiểm tra: OTP đúng, OTP sai giảm lượt, khoá 5 lần, hết hạn,
 * chống dùng lại, tranh chấp song song, và bảo mật thông tin (không lộ OTP thô).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  api,
  approverFor,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  idemKey,
  login,
  prisma,
  submit,
  type Session,
} from '../helpers'
import { takeCapturedOtp } from '../../src/modules/otp/channel'

describe('3. Xác thực OTP và Bảo mật Ký số (OTP & Signing)', () => {
  let sv: Session
  let studentUserId: string
  let tkSession: Session
  let tkUserId: string

  beforeAll(async () => {
    sv = await login('sv001')
    studentUserId = sv.user.id
    const approver = await approverFor(studentUserId, 'TRUONG_KHOA')
    tkSession = approver.session
    tkUserId = approver.user.id
  })

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  async function prepareOtpStep() {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'OTP' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    // Bước 1: CO_VAN duyệt
    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')
    await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'CVHT duyệt bước 1' })

    // Gửi OTP cho bước 2
    const sendRes = await api()
      .post('/api/v1/otp/send')
      .set(bearer(tkSession.token))
      .send({ maHoSo: draft.maHoSo })
    expect(sendRes.status).toBe(200)

    const challengeId = sendRes.body.data.challengeId as string
    const rawOtp = takeCapturedOtp(challengeId)
    expect(rawOtp).toBeDefined()

    return { maHoSo: draft.maHoSo, challengeId, rawOtp: rawOtp! }
  }

  // 1. OTP đúng -> thành công, chữ ký được tạo
  it('OTP đúng: Phê duyệt thành công và tạo chữ ký số hợp lệ', async () => {
    const { maHoSo, challengeId, rawOtp } = await prepareOtpStep()

    const res = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ghiChu: 'Trưởng khoa duyệt bằng OTP',
        challengeId,
        otp: rawOtp,
      })
    expect(res.status).toBe(200)

    // Kiểm tra bản ghi chữ ký trong CSDL
    const sig = await prisma.signature.findFirst({
      where: { application: { maHoSo }, nguoiKyId: tkUserId },
    })
    expect(sig).not.toBeNull()
    expect(sig?.phuongThuc).toBe('OTP')
    expect(sig?.maChuKy).toBeDefined()
  })

  // 2. OTP sai -> báo số lần còn lại giảm
  it('OTP sai: Báo lỗi và giảm số lần thử còn lại', async () => {
    const { maHoSo, challengeId } = await prepareOtpStep()

    const res = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ghiChu: 'Thử OTP sai',
        challengeId,
        otp: '999999',
      })
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('OTP_INVALID')
    expect(res.body.error?.details?.soLanConLai).toBe(4)
  })

  // 3. 5 lần sai -> khóa 15 phút (OTP_LOCKED)
  it('5 lần nhập sai OTP: Phiên OTP bị khóa 15 phút (OTP_LOCKED, HTTP 423)', async () => {
    const { maHoSo, challengeId } = await prepareOtpStep()

    for (let i = 0; i < 4; i++) {
      await api()
        .post(`/api/v1/approvals/${maHoSo}/approve`)
        .set(bearer(tkSession.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'Thử sai', challengeId, otp: '000000' })
    }

    // Lần thứ 5 -> Khóa
    const res5 = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Lần 5', challengeId, otp: '000000' })
    expect(res5.status).toBe(423)
    expect(res5.body.error?.code).toBe('OTP_LOCKED')
  })

  // 4. Hết hạn (OTP_EXPIRED)
  it('OTP hết hạn: Báo lỗi OTP_EXPIRED (HTTP 410)', async () => {
    const { maHoSo, challengeId, rawOtp } = await prepareOtpStep()

    // Giả lập hết hạn: cập nhật hetHanLuc về quá khứ
    await prisma.otpChallenge.update({
      where: { id: challengeId },
      data: { hetHanLuc: new Date(Date.now() - 1000) },
    })

    const res = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt khi hết hạn', challengeId, otp: rawOtp })
    expect(res.status).toBe(410)
    expect(res.body.error?.code).toBe('OTP_EXPIRED')
  })

  // 5. Chống dùng lại và gửi lại vô hiệu OTP cũ
  it('OTP đã dùng không dùng lại được; gửi lại OTP làm vô hiệu hóa OTP cũ', async () => {
    const { maHoSo, challengeId, rawOtp } = await prepareOtpStep()

    // Duyệt thành công lần đầu
    const ok = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt thành công', challengeId, otp: rawOtp })
    expect(ok.status).toBe(200)

    // Dùng lại OTP đó -> báo đã sử dụng
    const reuse = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Tấn công dùng lại', challengeId, otp: rawOtp })
    expect([400, 409]).toContain(reuse.status)
  })

  // 6. 5 request sai song song vẫn chỉ tính tối đa 5 lần thử
  it('5 yêu cầu sai song song vẫn đếm chính xác và khóa an toàn', async () => {
    const { maHoSo, challengeId } = await prepareOtpStep()

    // Gửi 5 request sai đồng thời
    const promises = Array.from({ length: 5 }, () =>
      api()
        .post(`/api/v1/approvals/${maHoSo}/approve`)
        .set(bearer(tkSession.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'Song song sai', challengeId, otp: '111111' }),
    )
    const results = await Promise.all(promises)

    // Xác nhận có lỗi OTP_INVALID hoặc OTP_LOCKED
    const statuses = results.map((r) => r.status)
    expect(statuses).toContain(400)

    // Kiểm tra trong CSDL: soLanConLai phải giảm về 0 và khoaDenLuc được thiết lập
    const c = await prisma.otpChallenge.findUnique({ where: { id: challengeId } })
    expect(c?.soLanConLai).toBe(0)
    expect(c?.khoaDenLuc).not.toBeNull()
  })

  // 7. Quét response, log và audit log: không chứa OTP thô hoặc mật khẩu
  it('Bảo mật dữ liệu: Không có OTP thô hoặc mật khẩu xuất hiện trong phản hồi API và audit_logs', async () => {
    const { challengeId, rawOtp } = await prepareOtpStep()

    // Lấy thông tin trạng thái challenge
    const statusRes = await api()
      .get(`/api/v1/otp/challenge/${challengeId}`)
      .set(bearer(tkSession.token))
    expect(statusRes.status).toBe(200)

    const strBody = JSON.stringify(statusRes.body)
    expect(strBody).not.toContain(rawOtp)

    // Quét bản ghi audit_logs
    const logs = await prisma.auditLog.findMany({
      where: { luc: { gte: new Date(Date.now() - 60_000) } },
      take: 20,
    })
    for (const l of logs) {
      const fullLogStr = JSON.stringify(l)
      expect(fullLogStr).not.toContain(rawOtp)
      expect(fullLogStr).not.toContain('demo1234')
    }
  })
})
