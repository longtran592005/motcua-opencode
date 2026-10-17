import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { AppError } from '../src/lib/errors'
import { getOtpChannel, setOtpChannelForTest, type NotificationChannel } from '../src/modules/otp/channel'
import {
  api,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  currentStepOf,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'

class UnconfiguredChannel implements NotificationChannel {
  readonly ten = 'EMAIL'
  async guiOtp(): Promise<never> {
    throw AppError.configuration(
      'Chưa cấu hình kênh gửi OTP thật (đang đặt OTP_CHANNEL=EMAIL). ' +
        'Hãy cấu hình nhà cung cấp email/SMS trước khi gửi mã.',
      { otpChannel: 'EMAIL' },
    )
  }
}

class ThrowingChannel implements NotificationChannel {
  readonly ten = 'SMS'
  async guiOtp(): Promise<never> {
    throw new Error('Nha cung cap SMS khong phan hoi.')
  }
}

/** Lay phiên OTP của một hồ sơ/bước để kiểm tra nó không lỏng ra ngoài. */
async function taoHoSoOtp() {
  const [student] = await twoStudents()
  const session = await login(student.user.maSo)
  const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'OTP' }])
  const draft = await createDraft(session, requestType.id)
  await submit(session, draft.maHoSo)
  return { session, draft }
}

/** Gửi OTP và trả về mã đã gửi (đọc từ kênh CAPTURE). */
async function guiVaLayOtp(maHoSo: string, approverToken: string) {
  const res = await api()
    .post('/api/v1/otp/send')
    .set('Authorization', `Bearer ${approverToken}`)
    .send({ maHoSo })
  expect(res.status).toBe(200)
  return res.body.data.challengeId as string
}

/** Tìm mã OTP thô từ bản ghi đã lưu (hash) — chỉ để chứng minh hash tồn tại. */
async function layOtpHash(challengeId: string) {
  const c = await prisma.otpChallenge.findUniqueOrThrow({
    where: { id: challengeId },
    select: { otpHash: true },
  })
  return c.otpHash
}

afterEach(() => {
  setOtpChannelForTest(null)
})

afterAll(async () => {
  setOtpChannelForTest(null)
  await cleanupTracked()
  await cleanupProvisioned()
})

describe('Kenh gui OTP', () => {
  it('môi trường kiểm thử dùng kênh CAPTURE (không phải CONSOLE/EMAIL/SMS)', () => {
    expect(getOtpChannel().ten).toBe('CAPTURE')
  })

  it('mã OTP KHÔNG xuất hiện ở đâu cả ngoài kênh gửi', async () => {
    const { session, draft } = await taoHoSoOtp()
    const { app, step } = await currentStepOf(draft.maHoSo)
    const approver = await prisma.user.findFirstOrThrow({
      where: { role: step!.role, trangThai: 'ACTIVE', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const approverSession = await login(approver.maSo)

    const res = await api()
      .post('/api/v1/otp/send')
      .set('Authorization', `Bearer ${approverSession.token}`)
      .send({ maHoSo: draft.maHoSo })
    expect(res.status).toBe(200)
    const challengeId = res.body.data.challengeId as string

    // Mã OTP thô: đọc trực tiếp từ bộ nhớ kênh CAPTURE (chỗ duy nhất được phép có).
    const { takeCapturedOtp } = await import('../src/modules/otp/channel')
    const otpTho = takeCapturedOtp(challengeId) ?? ''
    expect(otpTho).toMatch(/^\d{6}$/)

    // 1) Không có mã OTP trong response.
    expect(res.body.data.challengeId).toBeDefined()
    expect(res.body.data).not.toHaveProperty('otp')
    expect(res.body.data).not.toHaveProperty('devOtp')
    expect(JSON.stringify(res.body)).not.toContain('otpHash')
    expect(JSON.stringify(res.body)).not.toContain(otpTho)

    // 2) Không có mã OTP trong thông báo đã lưu (so sánh với mã thô).
    const notifications = await prisma.notification.findMany({
      where: { applicationId: app.id },
      select: { tieuDe: true, noiDung: true },
    })
    for (const tb of notifications) {
      const vanBan = `${tb.tieuDe} ${tb.noiDung}`
      expect(vanBan).not.toContain(otpTho)
      expect(vanBan).not.toContain('OTP')
    }

    // 3) Không có mã OTP trong nhật ký kiểm toán.
    const auditLogs = await prisma.auditLog.findMany({
      where: { doiTuongId: draft.maHoSo },
      select: { hanhDong: true, giaTriTruoc: true, giaTriSau: true },
    })
    for (const log of auditLogs) {
      const vanBan = `${log.hanhDong} ${log.giaTriTruoc ?? ''} ${log.giaTriSau ?? ''}`
      expect(vanBan).not.toContain(otpTho)
      expect(vanBan).not.toContain('OTP')
    }

    // 4) Khoá được lưu (có hash) nhưng không có mã thô.
    expect(await layOtpHash(challengeId)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('kênh chưa cấu hình → gửi thất bại (503) và phiên OTP bị vô hiệu hoá', async () => {
    const { session, draft } = await taoHoSoOtp()
    const { app, step } = await currentStepOf(draft.maHoSo)
    const approver = await prisma.user.findFirstOrThrow({
      where: { role: step!.role, trangThai: 'ACTIVE', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const approverSession = await login(approver.maSo)

    setOtpChannelForTest(new UnconfiguredChannel())

    const res = await api()
      .post('/api/v1/otp/send')
      .set('Authorization', `Bearer ${approverSession.token}`)
      .send({ maHoSo: draft.maHoSo })
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('UNKNOWN')

    // Không còn phiên OTP nào còn hiệu lực.
    const conHieuLuc = await prisma.otpChallenge.count({
      where: { applicationId: app.id, daDung: false },
    })
    expect(conHieuLuc).toBe(0)
  })

  it('kênh lỗi → gửi thất bại và phiên OTP bị vô hiệu hoá', async () => {
    const { session, draft } = await taoHoSoOtp()
    const { app, step } = await currentStepOf(draft.maHoSo)
    const approver = await prisma.user.findFirstOrThrow({
      where: { role: step!.role, trangThai: 'ACTIVE', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const approverSession = await login(approver.maSo)

    setOtpChannelForTest(new ThrowingChannel())

    const res = await api()
      .post('/api/v1/otp/send')
      .set('Authorization', `Bearer ${approverSession.token}`)
      .send({ maHoSo: draft.maHoSo })
    expect(res.status).toBe(500)

    const conHieuLuc = await prisma.otpChallenge.count({
      where: { applicationId: app.id, daDung: false },
    })
    expect(conHieuLuc).toBe(0)
  })

  it('gửi lại phiên OTP mới (resend) — mã mới gửi qua kênh, không lộ', async () => {
    const { session, draft } = await taoHoSoOtp()
    const { step } = await currentStepOf(draft.maHoSo)
    const approver = await prisma.user.findFirstOrThrow({
      where: { role: step!.role, trangThai: 'ACTIVE', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const approverSession = await login(approver.maSo)

    const id1 = await guiVaLayOtp(draft.maHoSo, approverSession.token)
    const { takeCapturedOtp } = await import('../src/modules/otp/channel')
    const otp1 = takeCapturedOtp(id1) ?? ''

    // Đợi 30 giây cooldown — gia lập bằng cách cập nhật lastSentAt.
    await prisma.otpChallenge.update({
      where: { id: id1 },
      data: { lastSentAt: new Date(Date.now() - 31_000) },
    })

    const resend = await api()
      .post(`/api/v1/otp/${id1}/resend`)
      .set('Authorization', `Bearer ${approverSession.token}`)
    expect(resend.status).toBe(200)

    const otp2 = takeCapturedOtp(id1) ?? ''
    expect(otp2).toMatch(/^\d{6}$/)
    expect(otp2).not.toBe(otp1)

    // Cả hai mã đều không xuất hiện trong response.
    expect(JSON.stringify(resend.body)).not.toContain(otp1)
    expect(JSON.stringify(resend.body)).not.toContain(otp2)
  })
})

