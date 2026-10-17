/**
 * BỘ KIỂM THỬ LÕI 5: CHỮ KÝ SỐ VÀ TRA CỨU VĂN BẢN CÔNG KHAI
 *
 * Kiểm tra: Tính hợp lệ chữ ký, phát hiện sửa đổi hồ sơ sau ký, thu hồi văn bản,
 * che dữ liệu cá nhân (PII), rate limit 429, tra cứu theo số văn bản và đối chiếu mã băm.
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
  driveToCompletion,
  idemKey,
  login,
  prisma,
  submit,
  type Session,
} from '../helpers'
import { authLimiter, setRateLimitEnabled } from '../../src/middleware/rateLimit'

describe('5. Chữ ký số và Tra cứu Văn bản Công khai (Signatures & Verification)', () => {
  let sv: Session
  let studentUserId: string
  let admin: Session

  beforeAll(async () => {
    sv = await login('sv001')
    studentUserId = sv.user.id
    admin = await login('admin')
  })

  afterEach(async () => {
    setRateLimitEnabled(false)
    await cleanupTracked()
    await cleanupProvisioned()
  })

  async function issueSampleDocument() {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)
    const completedApp = await driveToCompletion(draft.maHoSo, studentUserId)

    const doc = await prisma.signedDocument.findFirstOrThrow({
      where: { applicationId: completedApp.id },
      include: { signatures: true },
    })
    return { app: completedApp, doc }
  }

  // 1. Chữ ký hợp lệ ngay sau khi ký; sửa dữ liệu sau ký làm chữ ký mất hiệu lực
  it('Chữ ký hợp lệ sau khi ký; sửa đổi dữ liệu hồ sơ làm phát hiện sai lệch (hopLeThucTe = false)', async () => {
    const { doc, app } = await issueSampleDocument()

    // Tra cứu khi văn bản nguyên vẹn
    const resTruoc = await api().get(`/api/v1/public/verify/token/${doc.tokenXacThuc}`)
    expect(resTruoc.status).toBe(200)
    expect(resTruoc.body.data.vanBan.chuKy[0].hopLeThucTe).toBe(true)

    // Cố tình sửa đổi dữ liệu hồ sơ sau khi đã cấp văn bản
    await prisma.application.update({
      where: { id: app.id },
      data: { duLieu: { lyDo: 'Dữ liệu đã bị can thiệp trái phép' } },
    })

    // Tra cứu lại: phát hiện chữ ký không còn khớp với nội dung thực tế
    const resSau = await api().get(`/api/v1/public/verify/token/${doc.tokenXacThuc}`)
    expect(resSau.status).toBe(200)
    expect(resSau.body.data.vanBan.chuKy[0].hopLeThucTe).toBe(false)
  })

  // 2. Thu hồi văn bản
  it('Thu hồi văn bản bởi Admin có lý do: Tra cứu công khai báo REVOKED', async () => {
    const { doc } = await issueSampleDocument()

    // Thu hồi văn bản (bắt buộc quyền ADMIN/PHONG_DAO_TAO và lý do)
    const revokeRes = await api()
      .post(`/api/v1/documents/${doc.id}/revoke`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Sinh viên thôi học theo quyết định số 123' })
    expect(revokeRes.status).toBe(200)
    expect(revokeRes.body.data.trangThai).toBe('REVOKED')

    // Tra cứu công khai hiển thị trạng thái REVOKED
    const verifyRes = await api().get(`/api/v1/public/verify/token/${doc.tokenXacThuc}`)
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.trangThai).toBe('REVOKED')
  })

  // 3. Token tra cứu sai không lộ thông tin
  it('Token tra cứu sai: Trả về 404 NOT_FOUND cùng khuôn phản hồi chuẩn, không lộ dữ liệu', async () => {
    const res = await api().get('/api/v1/public/verify/token/token_hoan_toan_khong_ton_tai_12345678')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBeDefined()
    expect(res.body.data).toBeUndefined()
  })

  // 4. API công khai che toàn bộ dữ liệu cá nhân (PII)
  it('Bảo vệ dữ liệu cá nhân (PII): Không lộ họ tên đầy đủ, email hoặc số điện thoại của sinh viên', async () => {
    const { doc } = await issueSampleDocument()

    const res = await api().get(`/api/v1/public/verify/token/${doc.tokenXacThuc}`)
    expect(res.status).toBe(200)

    const strResponse = JSON.stringify(res.body)

    // Lấy thông tin sinh viên thật từ CSDL
    const svUser = await prisma.user.findUniqueOrThrow({ where: { id: studentUserId } })
    const hoTenDayDu = svUser.hoTen // ví dụ: "Nguyễn Văn An"
    const emailDayDu = svUser.email // ví dụ: "sv001@tbu.edu.vn"

    // Họ tên đầy đủ KHÔNG được xuất hiện nguyên vẹn (phải bị che, ví dụ "N*** A")
    expect(strResponse).not.toContain(hoTenDayDu)
    // Email không được xuất hiện
    expect(strResponse).not.toContain(emailDayDu)

    // Xác nhận trường họ tên đã được che
    const maskedName = res.body.data.vanBan.sinhVien.hoTen as string
    expect(maskedName).toContain('*')
  })

  // 5. Rate limit công khai trả 429 kèm Retry-After
  it('Rate limit: Quá số lượng yêu cầu trả về 429 RATE_LIMITED kèm header Retry-After', async () => {
    setRateLimitEnabled(true)
    authLimiter.resetKey('127.0.0.1')

    // Gọi liên tiếp đến khi chạm ngưỡng
    const results: number[] = []
    for (let i = 0; i < 22; i++) {
      const res = await api().post('/api/v1/auth/login').send({
        dinhDanh: 'admin',
        matKhau: 'demo1234',
      })
      results.push(res.status)
    }

    expect(results).toContain(429)
    const chanRes = await api().post('/api/v1/auth/login').send({
      dinhDanh: 'admin',
      matKhau: 'demo1234',
    })
    expect(chanRes.status).toBe(429)
    expect(chanRes.body.error?.code).toBe('RATE_LIMITED')
    expect(chanRes.headers['retry-after']).toBeDefined()
  })

  // 6. Tra cứu công khai theo số văn bản
  it('Tra cứu công khai theo số văn bản thành công', async () => {
    const { doc } = await issueSampleDocument()

    const res = await api().get(`/api/v1/public/verify/so-van-ban/${encodeURIComponent(doc.soVanBan)}`)
    expect(res.status).toBe(200)
    expect(res.body.data.vanBan.soVanBan).toBe(doc.soVanBan)
    expect(res.body.data.trangThai).toBe('VALID')
  })

  // 7. Đối chiếu mã băm qua API công khai (compare)
  it('Đối chiếu mã băm qua API công khai: Khớp trả về true, sai trả về false', async () => {
    const { doc } = await issueSampleDocument()

    // Băm đúng
    const matchRes = await api()
      .post(`/api/v1/public/verify/token/${doc.tokenXacThuc}/compare`)
      .send({ maBamNguoiDung: doc.maBamSha256 })
    expect(matchRes.status).toBe(200)
    expect(matchRes.body.data.ketQuaDoiChieu.trungKhop).toBe(true)

    // Băm sai
    const mismatchRes = await api()
      .post(`/api/v1/public/verify/token/${doc.tokenXacThuc}/compare`)
      .send({ maBamNguoiDung: '0000000000000000000000000000000000000000000000000000000000000000' })
    expect(mismatchRes.status).toBe(200)
    expect(mismatchRes.body.data.ketQuaDoiChieu.trungKhop).toBe(false)
  })
})
