/**
 * BỘ KIỂM THỬ LÕI 1: XÁC THỰC VÀ PHÂN QUYỀN
 *
 * Kiểm tra: Đăng nhập, làm mới token, xoay vòng, ma trận quyền 5 vai trò, và chống IDOR.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
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
} from '../helpers'

describe('1. Xác thực và Phân quyền (Authentication & Authorization)', () => {
  let svA: Session
  let svB: Session
  let cvA: Session
  let cvB: Session
  let tkA: Session
  let pdt: Session
  let admin: Session

  beforeAll(async () => {
    const [stA, stB] = await twoStudents()
    svA = await login(stA.user.maSo)
    svB = await login(stB.user.maSo)
    cvA = await login('CV001')
    cvB = await login('CV002')
    tkA = await login('TK001')
    pdt = await login('PDT001')
    admin = await login('admin')
  })

  afterEach(async () => {
    await cleanupTracked()
  })

  // 1. Đăng nhập đúng thông tin
  it('Đăng nhập đúng thông tin trả về 200 kèm access token và refresh token', async () => {
    const res = await api().post('/api/v1/auth/login').send({
      dinhDanh: svA.user.maSo,
      matKhau: 'demo1234',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.refreshToken).toBeDefined()
    expect(res.body.data.user.maSo).toBe(svA.user.maSo)
  })

  // 2. Đăng nhập sai mật khẩu
  it('Đăng nhập sai mật khẩu bị từ chối 401', async () => {
    const res = await api().post('/api/v1/auth/login').send({
      dinhDanh: svA.user.maSo,
      matKhau: 'sai_mat_khau_123',
    })
    expect(res.status).toBe(401)
  })

  // 3. Mã số không phân biệt hoa thường
  it('Mã số đăng nhập không phân biệt chữ hoa và chữ thường', async () => {
    const resHoa = await api().post('/api/v1/auth/login').send({
      dinhDanh: 'CV001',
      matKhau: 'demo1234',
    })
    const resThuong = await api().post('/api/v1/auth/login').send({
      dinhDanh: 'cv001',
      matKhau: 'demo1234',
    })
    expect(resHoa.status).toBe(200)
    expect(resThuong.status).toBe(200)
    expect(resHoa.body.data.user.id).toBe(resThuong.body.data.user.id)
  })

  // 4. Refresh token xoay vòng
  it('Refresh token xoay vòng: cấp access token mới và refresh token mới', async () => {
    const loginRes = await api().post('/api/v1/auth/login').send({
      dinhDanh: svA.user.maSo,
      matKhau: 'demo1234',
    })
    const oldRefresh = loginRes.body.data.refreshToken as string

    const refreshRes = await api().post('/api/v1/auth/refresh').send({
      refreshToken: oldRefresh,
    })
    expect(refreshRes.status).toBe(200)
    expect(refreshRes.body.data.token).toBeDefined()
    expect(refreshRes.body.data.refreshToken).toBeDefined()
    expect(refreshRes.body.data.refreshToken).not.toBe(oldRefresh)
  })

  // 5. Dùng lại refresh token cũ bị phát hiện và thu hồi toàn bộ phiên
  it('Dùng lại refresh token cũ bị phát hiện và thu hồi cả phiên người dùng', async () => {
    const loginRes = await api().post('/api/v1/auth/login').send({
      dinhDanh: svB.user.maSo,
      matKhau: 'demo1234',
    })
    const oldRefresh = loginRes.body.data.refreshToken as string

    // Lần 1: refresh thành công, token cũ bị đánh dấu đã dùng
    const res1 = await api().post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })
    expect(res1.status).toBe(200)
    const newRefresh = res1.body.data.refreshToken as string

    // Lần 2: kẻ tấn công dùng lại token cũ -> bị từ chối 401
    const resReuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh })
    expect(resReuse.status).toBe(401)

    // Toàn bộ phiên của người dùng bị thu hồi: token mới cũng bị vô hiệu
    const resAfterReuse = await api().post('/api/v1/auth/refresh').send({ refreshToken: newRefresh })
    expect(resAfterReuse.status).toBe(401)
  })

  // 6. Không có token hoặc token sai/hết hạn
  it('Không có token hoặc token bị sửa trả về lỗi 401 UNAUTHORIZED', async () => {
    const noToken = await api().get('/api/v1/applications')
    expect(noToken.status).toBe(401)

    const badToken = await api()
      .get('/api/v1/applications')
      .set(bearer('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'))
    expect(badToken.status).toBe(401)
  })

  // 7. Bảng phân quyền data-driven: Sai vai trò -> 403 FORBIDDEN
  const permissionChecks = [
    { role: 'SINH_VIEN', getSession: () => svA, method: 'get', path: '/api/v1/approvals' },
    { role: 'SINH_VIEN', getSession: () => svA, method: 'post', path: '/api/v1/request-types', body: {} },
    { role: 'SINH_VIEN', getSession: () => svA, method: 'get', path: '/api/v1/users' },
    { role: 'SINH_VIEN', getSession: () => svA, method: 'get', path: '/api/v1/audit-logs' },
    { role: 'CO_VAN', getSession: () => cvA, method: 'post', path: '/api/v1/request-types', body: {} },
    { role: 'CO_VAN', getSession: () => cvA, method: 'get', path: '/api/v1/audit-logs' },
    { role: 'TRUONG_KHOA', getSession: () => tkA, method: 'post', path: '/api/v1/users', body: {} },
    { role: 'PHONG_DAO_TAO', getSession: () => pdt, method: 'post', path: '/api/v1/workflows', body: {} },
  ] as const

  it.each(permissionChecks)(
    'Phân quyền: Vai trò $role truy cập trái phép $method $path bị chặn 403',
    async ({ getSession, method, path, body }) => {
      const s = getSession()
      const req = method === 'post' ? api().post(path).send(body ?? {}) : api().get(path)
      const res = await req.set(bearer(s.token))
      expect(res.status).toBe(403)
    },
  )

  // 8. IDOR: Sinh viên A không thể xem đơn của Sinh viên B (cả maHoSo và UUID)
  it('IDOR: Sinh viên A không thể đọc hồ sơ của Sinh viên B bằng mã hồ sơ hoặc UUID', async () => {
    const rtId = await pickRequestTypeId()
    const draftB = await createDraft(svB, rtId)

    // SV A thử đọc bằng mã hồ sơ của SV B
    const byMa = await api()
      .get(`/api/v1/applications/${draftB.maHoSo}`)
      .set(bearer(svA.token))
    expect([403, 404]).toContain(byMa.status)

    // SV A thử đọc bằng UUID của SV B
    const byUuid = await api()
      .get(`/api/v1/applications/${draftB.id}`)
      .set(bearer(svA.token))
    expect([403, 404]).toContain(byUuid.status)
  })

  // 9. IDOR: Sinh viên A không thể sửa hoặc rút đơn của Sinh viên B
  it('IDOR: Sinh viên A không thể chỉnh sửa hoặc rút hồ sơ của Sinh viên B', async () => {
    const rtId = await pickRequestTypeId()
    const draftB = await createDraft(svB, rtId)

    // SV A thử sửa
    const putRes = await api()
      .put(`/api/v1/applications/${draftB.maHoSo}`)
      .set(bearer(svA.token))
      .set('Idempotency-Key', idemKey())
      .send({ requestTypeId: rtId, duLieu: {}, tepDinhKem: [] })
    expect([403, 404]).toContain(putRes.status)

    // SV A thử rút đơn
    const cancelRes = await api()
      .post(`/api/v1/applications/${draftB.maHoSo}/cancel`)
      .set(bearer(svA.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Hacked cancel' })
    expect([403, 404]).toContain(cancelRes.status)
  })

  // 10. IDOR: Cố vấn học tập không thể xem đơn của sinh viên lớp khác
  it('IDOR: Cố vấn học tập không thể xem hồ sơ sinh viên không thuộc quyền quản lý', async () => {
    const rtId = await pickRequestTypeId()
    // Tạo đơn cho SV A (thuộc cố vấn cvA)
    const draftA = await createDraft(svA, rtId)

    // cvB (cố vấn lớp khác) cố tình xem đơn của SV A
    const res = await api()
      .get(`/api/v1/applications/${draftA.maHoSo}`)
      .set(bearer(cvB.token))
    expect([403, 404]).toContain(res.status)
  })
})
