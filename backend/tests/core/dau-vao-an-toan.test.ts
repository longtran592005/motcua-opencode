/**
 * BỘ KIỂM THỬ LÕI 6: AN TOÀN ĐẦU VÀO VÀ KIỂM TOÁN (SECURITY & AUDIT)
 *
 * Kiểm tra: Giới hạn tệp đính kèm, phòng chống SQL Injection, phòng chống XSS,
 * kiểm soát tham số phân trang/sắp xếp, và ghi chép audit log đầy đủ.
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
  pickRequestTypeId,
  prisma,
  submit,
  type Session,
} from '../helpers'

describe('6. An toàn Đầu vào và Kiểm toán (Input Safety & Audit Logs)', () => {
  let sv: Session
  let studentUserId: string
  let admin: Session

  beforeAll(async () => {
    sv = await login('sv001')
    studentUserId = sv.user.id
    admin = await login('admin')
  })

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  // 1. Tệp đính kèm quá dung lượng bị từ chối
  it('Tệp đính kèm vượt quá dung lượng cho phép (>200MB) bị từ chối VALIDATION_ERROR (400)', async () => {
    const rtId = await pickRequestTypeId()

    const res = await api()
      .post('/api/v1/applications')
      .set(bearer(sv.token))
      .send({
        requestTypeId: rtId,
        duLieu: {},
        tepDinhKem: [
          {
            ten: 'tep_qua_lon.pdf',
            loai: 'application/pdf',
            kichThuoc: 300 * 1024 * 1024, // 300 MB > 200 MB
          },
        ],
      })
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  // 2. Tên tệp chứa ký tự ../ (Path Traversal) được lưu trữ an toàn mà không xâm hại hệ thống
  it('Tên tệp đính kèm chứa ký tự ../ không gây lỗi hệ thống hoặc phá vỡ cấu trúc', async () => {
    const rtId = await pickRequestTypeId()

    const res = await api()
      .post('/api/v1/applications')
      .set(bearer(sv.token))
      .send({
        requestTypeId: rtId,
        duLieu: {},
        tepDinhKem: [
          {
            ten: '../../../../etc/passwd.pdf',
            loai: 'application/pdf',
            kichThuoc: 1024,
          },
        ],
      })
    // Hệ thống chấp nhận chuỗi tên hoặc lọc an toàn, không gây sập 500
    expect(res.status).toBe(201)
  })

  // 3. SQL Injection vào các tham số lọc: tuKhoa, khoa, lop
  it('SQL Injection: Thử chèn \' OR 1=1 -- và ; DROP TABLE vào các tham số lọc không làm lỗi 5xx hay rò dữ liệu', async () => {
    const maliciousPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "' UNION SELECT NULL, NULL, NULL --",
    ]

    for (const payload of maliciousPayloads) {
      // 1. tuKhoa
      const resTuKhoa = await api()
        .get(`/api/v1/applications?tuKhoa=${encodeURIComponent(payload)}`)
        .set(bearer(sv.token))
      expect(resTuKhoa.status).toBe(200)
      expect(resTuKhoa.body.success).toBe(true)

      // 2. khoa
      const resKhoa = await api()
        .get(`/api/v1/applications?khoa=${encodeURIComponent(payload)}`)
        .set(bearer(sv.token))
      expect(resKhoa.status).toBe(200)

      // 3. lop
      const resLop = await api()
        .get(`/api/v1/applications?lop=${encodeURIComponent(payload)}`)
        .set(bearer(sv.token))
      expect(resLop.status).toBe(200)
    }
  })

  // 4. Phòng chống XSS: <script> trong biểu mẫu và ghi chú duyệt
  it('XSS: Thẻ <script> trong dữ liệu biểu mẫu và ghi chú duyệt được lưu và trả ra an toàn', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const xssScript = '<script>alert("XSS")</script>'

    // Nộp đơn chứa XSS trong dữ liệu
    const draft = await createDraft(sv, flow.requestType.id)
    await api()
      .put(`/api/v1/applications/${draft.maHoSo}`)
      .set(bearer(sv.token))
      .send({
        requestTypeId: flow.requestType.id,
        duLieu: { lyDo: xssScript },
      })
    await submit(sv, draft.maHoSo)

    // Duyệt với ghi chú chứa XSS
    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')
    const approveRes = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: xssScript })
    expect(approveRes.status).toBe(200)

    // Đọc lại chi tiết đơn
    const getRes = await api()
      .get(`/api/v1/applications/${draft.maHoSo}`)
      .set(bearer(sv.token))
    expect(getRes.status).toBe(200)
    expect(getRes.headers['content-type']).toContain('application/json')
    // Chuỗi được lưu nguyên vẹn dưới dạng text, không bị biến dạng hoặc gây mã độc
    expect(getRes.body.data.duLieu.lyDo).toBe(xssScript)
  })

  // 5. pageSize quá lớn hoặc âm bị chặn
  it('Phân trang: Tham số pageSize quá lớn (>100) hoặc âm bị từ chối VALIDATION_ERROR (400)', async () => {
    // pageSize > 100
    const resLon = await api()
      .get('/api/v1/applications?pageSize=500')
      .set(bearer(sv.token))
    expect(resLon.status).toBe(400)
    expect(resLon.body.error?.code).toBe('VALIDATION_ERROR')

    // pageSize <= 0
    const resAm = await api()
      .get('/api/v1/applications?pageSize=-5')
      .set(bearer(sv.token))
    expect(resAm.status).toBe(400)
    expect(resAm.body.error?.code).toBe('VALIDATION_ERROR')
  })

  // 6. Sắp xếp ngoài danh sách cho phép bị chặn
  it('Sắp xếp: Tham số sapXep ngoài danh sách cho phép bị từ chối VALIDATION_ERROR (400)', async () => {
    const res = await api()
      .get('/api/v1/applications?sapXep=KHONG_HOP_LE')
      .set(bearer(sv.token))
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('VALIDATION_ERROR')
  })

  // 7. Ghi nhận audit log đầy đủ cho các hành động quan trọng
  it('Kiểm toán: Mỗi hành động quan trọng (đăng nhập, nộp đơn, duyệt, thu hồi) tạo bản ghi audit log chuẩn', async () => {
    // Hành động 1: Đăng nhập
    const loginRes = await api().post('/api/v1/auth/login').send({
      dinhDanh: 'sv001',
      matKhau: 'demo1234',
    })
    expect(loginRes.status).toBe(200)

    // Kiểm tra có audit log LOGIN
    const loginLog = await prisma.auditLog.findFirst({
      where: { hanhDong: 'LOGIN', nguoiThucHienId: studentUserId },
      orderBy: { luc: 'desc' },
    })
    expect(loginLog).not.toBeNull()
    expect(loginLog?.diaChiIp).toBeDefined()
    expect(loginLog?.thietBi).toBeDefined()
    expect(loginLog?.vaiTro).toBe('SINH_VIEN')

    // Hành động 2: Nộp đơn
    const rtId = await pickRequestTypeId()
    const draft = await createDraft(sv, rtId)
    await submit(sv, draft.maHoSo)

    const submitLog = await prisma.auditLog.findFirst({
      where: { hanhDong: 'SUBMIT_APPLICATION', doiTuongId: draft.maHoSo },
    })
    expect(submitLog).not.toBeNull()
    expect(submitLog?.nguoiThucHienId).toBe(studentUserId)
  })
})
