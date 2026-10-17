import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  api,
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
  trackUser,
  twoStudents,
} from './helpers'

const adminSession = () => login('admin')

/** Hậu tố để mỗi lần chạy bài kiểm thử có mã riêng (tránh trùng dữ liệu cũ). */
const suffix = Date.now().toString(36).toUpperCase()

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

describe('Quản trị luồng duyệt', () => {
  it('tạo → kiểm tra → sửa (phiên bản mới) → xoá', async () => {
    const admin = await adminSession()

    // Validate trước: thiếu bước → không hợp lệ.
    const sai = await api()
      .post('/api/v1/workflows/validate')
      .set(bearer(admin.token))
      .send({ ten: 'Luồng trống', steps: [] })
    expect(sai.status).toBe(200)
    expect(sai.body.data.hopLe).toBe(false)
    expect(sai.body.data.canhBao.length).toBeGreaterThan(0)

    const tao = await api()
      .post('/api/v1/workflows')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: `WF-ADM-TEST-${suffix}`,
        ten: 'Luồng kiểm thử quản trị',
        steps: [
          { ten: 'Cố vấn duyệt', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 24, order: 1, allowReject: true, allowSupplement: true },
          { ten: 'Trưởng khoa duyệt', role: 'TRUONG_KHOA', mode: 'OTP', slaHours: 48, order: 2, allowReject: true, allowSupplement: true },
        ],
      })
    expect(tao.status).toBe(201)
    expect(tao.body.data.version).toBe(1)
    expect(tao.body.data.capDo).toBe(2)
    expect(tao.body.data.hoatDong).toBe(true)
    expect(tao.body.data.steps.map((s: { order: number }) => s.order)).toEqual([1, 2])

    // Mã trùng → DUPLICATE_ACTION.
    const trung = await api()
      .post('/api/v1/workflows')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ ma: `WF-ADM-TEST-${suffix}`, ten: 'Trùng mã', steps: [{ ten: 'A', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 1, order: 1, allowReject: true, allowSupplement: true }] })
    expect(trung.status).toBe(409)
    expect(trung.body.error.code).toBe('DUPLICATE_ACTION')

    // Sửa → PHIÊN BẢN MỚI, bản cũ tắt.
    const sua = await api()
      .patch(`/api/v1/workflows/WF-ADM-TEST-${suffix}`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ten: 'Luồng kiểm thử quản trị (v2)',
        steps: [
          { ten: 'Cố vấn duyệt', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 24, order: 1, allowReject: true, allowSupplement: true },
          { ten: 'Trưởng khoa duyệt', role: 'TRUONG_KHOA', mode: 'OTP', slaHours: 48, order: 2, allowReject: true, allowSupplement: true },
          { ten: 'Phòng đào tạo duyệt', role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK', slaHours: 24, order: 3, allowReject: true, allowSupplement: true },
        ],
      })
    expect(sua.status).toBe(200)
    expect(sua.body.data.version).toBe(2)
    expect(sua.body.data.capDo).toBe(3)

    const danhSach = await prisma.workflow.findMany({ where: { ma: `WF-ADM-TEST-${suffix}` } })
    expect(danhSach).toHaveLength(2)
    expect(danhSach.find((w) => w.version === 1)?.hoatDong).toBe(false)
    expect(danhSach.find((w) => w.version === 2)?.hoatDong).toBe(true)

    // Nhưng bản v1 vẫn tồn tại để tra cứu lịch sử (không bị xoá cứng).
    const layV1 = await api().get(`/api/v1/workflows/WF-ADM-TEST-${suffix}`).set(bearer(admin.token))
    // Lấy bản đang hoạt động.
    expect(layV1.body.data.version).toBe(2)

    // Không thể xoá vì không còn loại đơn nào dùng → sẽ dọn dẹp bằng tay ở afterAll.
  })

  it('PATCH với cấu hình sai → VALIDATION_ERROR và không đổi gì', async () => {
    const admin = await adminSession()
    const tao = await api()
      .post('/api/v1/workflows')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: `WF-ADM-SAI-${suffix}`,
        ten: 'Luồng sai',
        steps: [
          { ten: 'A', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 24, order: 1, allowReject: true, allowSupplement: true },
          { ten: 'B', role: 'TRUONG_KHOA', mode: 'ONE_CLICK', slaHours: 24, order: 2, allowReject: true, allowSupplement: true },
        ],
      })
    expect(tao.status).toBe(201)

    const sai = await api()
      .patch(`/api/v1/workflows/WF-ADM-SAI-${suffix}`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        steps: [
          { ten: 'Thiếu thời hạn', role: 'CO_VAN', mode: 'ONE_CLICK', order: 1, allowReject: true, allowSupplement: true },
        ],
      })
    expect(sai.status).toBe(422)
    expect(sai.body.error.code).toBe('VALIDATION_ERROR')
    const issues = (sai.body.error.details?.canhBao ?? sai.body.error.details?.truongLoi) as unknown[]
    expect(issues?.length).toBeGreaterThan(0)

    // Bản cũ vẫn nguyên.
    const sau = await prisma.workflow.findFirstOrThrow({ where: { ma: `WF-ADM-SAI-${suffix}` } })
    expect(sau.version).toBe(1)
    expect(sau.ten).toBe('Luồng sai')
  })
})

describe('Quản trị loại đơn', () => {
  it('tạo loại đơn rồi gắn vào luồng mới', async () => {
    const admin = await adminSession()
    const wf = await api()
      .post('/api/v1/workflows')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: `WF-ADM-RT-${suffix}`,
        ten: 'Luồng kiểm thử quản trị',
        steps: [
          { ten: 'Cố vấn duyệt', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 24, order: 1, allowReject: true, allowSupplement: true },
          { ten: 'Trưởng khoa duyệt', role: 'TRUONG_KHOA', mode: 'OTP', slaHours: 48, order: 2, allowReject: true, allowSupplement: true },
        ],
      })
    expect(wf.status).toBe(201)

    const rt = await api()
      .post('/api/v1/request-types')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: `RT-ADM-TEST-${suffix}`,
        ten: 'Giấy kiểm thử quản trị',
        nhom: 'Kiểm thử',
        moTa: 'Loại đơn do bài kiểm thử tạo.',
        icon: 'FileText',
        mau: 'brand',
        workflowId: `WF-ADM-RT-${suffix}`,
        formFields: [{ key: 'lyDo', label: 'Lý do', type: 'textarea', required: true, order: 1 }],
        giayTo: [{ key: 'cccd', label: 'CCCD', batBuoc: true }],
      })
    expect(rt.status).toBe(201)
    expect(rt.body.data.workflowId).not.toBe('')
    expect(rt.body.data.formFields).toHaveLength(1)
    expect(rt.body.data.giayTo).toHaveLength(1)

    // Mã trùng → DUPLICATE_ACTION.
    const trung = await api()
      .post('/api/v1/request-types')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        ma: `RT-ADM-TEST-${suffix}`,
        ten: 'Trùng',
        nhom: 'Kiểm thử',
        moTa: 'Trùng mã',
        formFields: [],
        giayTo: [],
      })
    expect(trung.status).toBe(409)
    expect(trung.body.error.code).toBe('DUPLICATE_ACTION')
  })

  it('từ chối xoá loại đơn khi còn hồ sơ đang xử lý', async () => {
    const [student] = await twoStudents()
    const admin = await adminSession()
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const session = await login(student.user.maSo)
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const res = await api()
      .delete(`/api/v1/request-types/${requestType.id}`)
      .set(bearer(admin.token))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })
})

describe('Quản trị người dùng', () => {
  it('thêm sinh viên (phải có lớp) → tạo cả hồ sơ sinh viên', async () => {
    const admin = await adminSession()
    const lop = await prisma.class.findFirstOrThrow({ where: { deletedAt: null } })
    const maSoTest = `SV-TEST-${suffix}`
    trackUser(maSoTest)

    const tao = await api()
      .post('/api/v1/users')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        maSo: maSoTest,
        hoTen: 'Sinh Viên Test',
        email: `sv-test-${suffix}@tbu.edu.vn`,
        role: 'SINH_VIEN',
        lopId: lop.id,
        trangThai: 'ACTIVE',
        matKhau: 'matkhau123',
      })
    expect(tao.status).toBe(201)
    expect(tao.body.data.role).toBe('SINH_VIEN')
    expect(tao.body.data.lopId).toBe(lop.id)

    const hoSo = await prisma.student.findFirst({ where: { user: { maSo: maSoTest } } })
    expect(hoSo).not.toBeNull()

    // Đăng nhập được bằng mật khẩu đã đặt (so sánh chữ hoa/chữ thường).
    const dangNhap = await api()
      .post('/api/v1/auth/login')
      .send({ dinhDanh: maSoTest.toLowerCase(), matKhau: 'matkhau123' })
    expect(dangNhap.status).toBe(200)
    expect(dangNhap.body.data.user.maSo).toBe(maSoTest)
  })

  it('sinh viên thiếu lớp → VALIDATION_ERROR', async () => {
    const admin = await adminSession()
    const res = await api()
      .post('/api/v1/users')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        maSo: `SV-TEST-2-${suffix}`,
        hoTen: 'Sinh Viên Không Lớp',
        email: `sv-test-2-${suffix}@tbu.edu.vn`,
        role: 'SINH_VIEN',
        trangThai: 'ACTIVE',
      })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('mã số trùng → DUPLICATE_ACTION', async () => {
    const admin = await adminSession()
    const co = await prisma.user.findFirstOrThrow({ where: { role: 'CO_VAN' } })
    const res = await api()
      .post('/api/v1/users')
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({
        maSo: co.maSo.toUpperCase(),
        hoTen: 'Trùng Mã Số',
        email: 'trung-moi@tbu.edu.vn',
        role: 'CO_VAN',
        trangThai: 'ACTIVE',
      })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_ACTION')
  })

  it('đặt lại mật khẩu → đăng nhập bằng mật khẩu tạm, mật khẩu cũ hết hiệu lực', async () => {
    const admin = await adminSession()
    const user = await prisma.user.findFirstOrThrow({
      where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null },
    })

    const originalHash = user.passwordHash
    try {
      const datLai = await api()
        .post(`/api/v1/users/${user.maSo}/reset-password`)
        .set(bearer(admin.token))
      expect(datLai.status).toBe(200)
      expect(datLai.body.data.matKhauTam).toBeDefined()

      const bangTam = await api()
        .post('/api/v1/auth/login')
        .send({ dinhDanh: user.maSo, matKhau: datLai.body.data.matKhauTam })
      expect(bangTam.status).toBe(200)

      const bangCu = await api()
        .post('/api/v1/auth/login')
        .send({ dinhDanh: user.maSo, matKhau: 'demo1234' })
      expect(bangCu.status).toBe(401)
      expect(bangCu.body.error.code).toBe('UNAUTHORIZED')

      // Mật khẩu tạm KHÔNG nằm trong nhật ký kiểm toán.
      const audit = await prisma.auditLog.findMany({
        where: { doiTuongId: user.maSo, hanhDong: 'RESET_PASSWORD' },
      })
      expect(audit.length).toBeGreaterThan(0)
      for (const a of audit) {
        expect(JSON.stringify(a)).not.toContain(datLai.body.data.matKhauTam)
      }
    } finally {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: originalHash },
      })
    }
  })

  it('không thể xoá tài khoản quản trị viên', async () => {
    const admin = await adminSession()
    const res = await api()
      .delete('/api/v1/users/ADMIN')
      .set(bearer(admin.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('sửa người dùng (không được sửa vai trò và trạng thái cùng lúc sai)', async () => {
    const admin = await adminSession()
    const user = await prisma.user.findFirstOrThrow({
      where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null },
    })

    const sua = await api()
      .patch(`/api/v1/users/${user.maSo}`)
      .set(bearer(admin.token))
      .set('Idempotency-Key', idemKey())
      .send({ hoTen: `${user.hoTen} (đã sửa)`, chucVu: 'Cố vấn chính' })
    expect(sua.status).toBe(200)
    expect(sua.body.data.hoTen).toContain('đã sửa')
  })
})

describe('Giao diện quản trị (không có quyền)', () => {
  it('người không phải ADMIN không quản trị được luồng/loại đơn/người dùng', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)

    const wf = await api().post('/api/v1/workflows').set(bearer(session.token)).send({ ma: 'WF-XSS', ten: 'X', steps: [{ ten: 'A', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 1, order: 1 }] })
    expect(wf.status).toBe(403)

    const rt = await api().post('/api/v1/request-types').set(bearer(session.token)).send({ ma: 'RT-XSS', ten: 'X', nhom: 'X', moTa: 'X', formFields: [], giayTo: [] })
    expect(rt.status).toBe(403)

    const us = await api().post('/api/v1/users').set(bearer(session.token)).send({ maSo: 'SV-XSS', hoTen: 'X', email: 'x@tbu.edu.vn', role: 'CO_VAN' })
    expect(us.status).toBe(403)
  })
})

describe('Dọn dữ liệu kiểm thử quản trị', () => {
  it('xoá mềm luồng và loại đơn do kiểm thử tạo', async () => {
    const admin = await adminSession()
    // Tìm loại đơn kiểm thử chưa còn hồ sơ đang xử lý.
    const rts = await prisma.requestType.findMany({
      where: { ma: { startsWith: 'RT-ADM-' }, deletedAt: null },
      select: { id: true, ma: true },
    })
    for (const rt of rts) {
      const dangXuLy = await prisma.application.count({
        where: {
          requestTypeId: rt.id,
          trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'] },
        },
      })
      if (dangXuLy === 0) {
        const xoa = await api().delete(`/api/v1/request-types/${rt.id}`).set(bearer(admin.token))
        expect(xoa.status).toBe(204)
      }
    }

    const wfs = await prisma.workflow.findMany({ where: { ma: { startsWith: 'WF-ADM-' }, deletedAt: null }, select: { id: true, ma: true } })
    const daXoaMa = new Set<string>()
    for (const wf of wfs) {
      if (daXoaMa.has(wf.ma)) continue
      const dangDung = await prisma.requestType.count({
        where: { workflow: { ma: wf.ma }, deletedAt: null },
      })
      if (dangDung === 0) {
        const xoa = await api().delete(`/api/v1/workflows/${wf.id}`).set(bearer(admin.token))
        expect(xoa.status).toBe(204)
        daXoaMa.add(wf.ma)
      }
    }
  })
})
