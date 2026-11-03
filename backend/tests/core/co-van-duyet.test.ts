/**
 * Tái hiện báo cáo người dùng: "Cố vấn không duyệt được và không có thông báo,
 * Phòng Đào tạo lại duyệt được".
 *
 * Các ca dưới đây chốt hành vi THAM QUYỀN của từng vai trò:
 *  - Cố vấn đúng của sinh viên: duyệt được bước của mình và nhận thông báo.
 *  - Cố vấn khác lớp: bị chặn (FORBIDDEN_SCOPE).
 *  - Phòng Đào tạo: chỉ duyệt được bước đúng vai trò PHONG_DAO_TAO;
 *    không được nhảy cóc bước Cố vấn / Trưởng khoa.
 *  - Admin: cho phép duyệt thay mọi bước (hành vi chủ đích, có audit log).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  api,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
} from '../helpers'

describe('Tham quyền duyệt từng vai trò (tái hiện lỗi báo cáo)', () => {
  let studentSession: Awaited<ReturnType<typeof login>> | undefined
  let studentUserId: string | undefined
  let maHoSo: string | undefined

  beforeEach(() => {
    studentSession = undefined
    studentUserId = undefined
    maHoSo = undefined
  })

  afterEach(async () => {
    await cleanupTracked()
    if (maHoSo) {
      await prisma.application.deleteMany({ where: { maHoSo } })
      maHoSo = undefined
    }
    await cleanupProvisioned()
  })

  /** Sinh viên đầu tiên trong seed + luồng 3 cấp ONE_CLICK (CV -> TK -> PĐT). */
  async function laMauSinhVienVaLuong() {
    const [student] = await twoStudents()
    studentSession = await login(student.user.maSo)
    studentUserId = student.user.id
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' as const },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' as const },
      { role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK' as const },
    ])
    const draft = await createDraft(studentSession, flow.requestType.id)
    maHoSo = draft.maHoSo
    return { student }
  }

  async function duyet(session: Awaited<ReturnType<typeof login>>, ma: string) {
    return api()
      .post(`/api/v1/approvals/${ma}/approve`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Kiểm thử tham quyền.' })
  }

  /**
   * Ca 1: SV nộp -> bước 1 gán ĐÚNG cố vấn của sinh viên, cố vấn đó (tối thiểu)
   * nhận thông báo "có hồ sơ mới".
   */
  it('Cố vấn đúng: bước 1 gán cho chính cố vấn phụ trách sinh viên + có thông báo', async () => {
    const { student } = await laMauSinhVienVaLuong()
    const sv = await prisma.student.findUniqueOrThrow({
      where: { userId: student.user.id },
      include: { class: { include: { coVan: true } } },
    })
    expect(sv.class.coVan).not.toBeNull()

    await submit(studentSession!, maHoSo!)

    const si = await prisma.stepInstance.findFirstOrThrow({
      where: { application: { maHoSo: maHoSo! }, stepOrder: 1 },
    })
    expect(si.role).toBe('CO_VAN')
    expect(si.assigneeId).toBe(sv.class.coVan!.id)

    const thongBao = await prisma.notification.findFirst({
      where: { nguoiNhanId: sv.class.coVan!.id, maHoSo: maHoSo! },
    })
    expect(thongBao, 'Cố vấn phụ trách phải nhận được thông báo').not.toBeNull()
  })

  /** Ca 2: cố vấn đúng duyệt -> thành công, đơn sang bước Trưởng khoa + TK nhận thông báo. */
  it('Cố vấn đúng duyệt thành công -> chuyển bước Trưởng khoa, Trưởng khoa nhận thông báo', async () => {
    const { student } = await laMauSinhVienVaLuong()
    const sv = await prisma.student.findUniqueOrThrow({
      where: { userId: student.user.id },
      include: { class: { include: { coVan: true, faculty: { include: { truongKhoa: true } } } } },
    })
    const truongKhoa = sv.class.faculty.truongKhoa
    expect(truongKhoa).not.toBeNull()
    await submit(studentSession!, maHoSo!)

    const coVanSession = await login(sv.class.coVan!.maSo)
    const res = await duyet(coVanSession, maHoSo!)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.currentStepOrder).toBe(2)

    const si2 = await prisma.stepInstance.findFirstOrThrow({
      where: { application: { maHoSo: maHoSo! }, stepOrder: 2 },
    })
    expect(si2.role).toBe('TRUONG_KHOA')
    expect(si2.assigneeId).toBe(truongKhoa!.id)

    const thongBao = await prisma.notification.findFirst({
      where: { nguoiNhanId: truongKhoa!.id, maHoSo: maHoSo! },
    })
    expect(thongBao, 'Trưởng khoa phải nhận được thông báo').not.toBeNull()
  })

  /** Ca 3: cố vấn KHÁC phụ trách sinh viên -> bị chặn FORBIDDEN_SCOPE. */
  it('Cố vấn khác lớp duyệt -> FORBIDDEN_SCOPE (403)', async () => {
    await laMauSinhVienVaLuong()
    await submit(studentSession!, maHoSo!)

    const sv = await prisma.student.findUniqueOrThrow({
      where: { userId: studentUserId! },
      include: { class: true },
    })
    const coVanKhac = await prisma.user.findFirstOrThrow({
      where: { role: 'CO_VAN', deletedAt: null, id: { not: sv.class.coVanId! } },
      orderBy: { maSo: 'asc' },
    })
    let khongPhaiCuaLopNay = await prisma.class.findFirstOrThrow({
      where: { coVanId: coVanKhac.id },
    })
    expect(khongPhaiCuaLopNay.id).not.toBe(sv.classId)

    const session = await login(coVanKhac.maSo)
    const res = await duyet(session, maHoSo!)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  /** Ca 4: Phòng Đào tạo NHẢY CÓC bước 1 (bước Cố văn) -> phải bị chặn. */
  it('Phòng Đào tạo duyệt bước Cố vấn (nhảy cóc) -> FORBIDDEN_SCOPE (403)', async () => {
    await laMauSinhVienVaLuong()
    await submit(studentSession!, maHoSo!)

    const pdt = await prisma.user.findFirstOrThrow({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null, trangThai: 'ACTIVE' },
      orderBy: { maSo: 'asc' },
    })
    const session = await login(pdt.maSo)
    const res = await duyet(session, maHoSo!)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')

    // Hồ sơ phải còn nguyên ở bước 1.
    const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: maHoSo! } })
    expect(app.trangThai).toBe('SUBMITTED')
    expect(app.currentStepOrder).toBe(1)
  })

  /** Ca 5: Phòng Đào tạo duyệt bước 2 (bước Trưởng khoa) -> bị chặn. */
  it('Phòng Đào tạo duyệt bước Trưởng khoa -> FORBIDDEN_SCOPE (403)', async () => {
    const { student } = await laMauSinhVienVaLuong()
    const sv = await prisma.student.findUniqueOrThrow({
      where: { userId: student.user.id },
      include: { class: { include: { coVan: true } } },
    })
    await submit(studentSession!, maHoSo!)

    const coVanSession = await login(sv.class.coVan!.maSo)
    const approveRes = await duyet(coVanSession, maHoSo!)
    expect(approveRes.status).toBe(200)

    const pdt = await prisma.user.findFirstOrThrow({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null, trangThai: 'ACTIVE' },
      orderBy: { maSo: 'asc' },
    })
    const res = await duyet(await login(pdt.maSo), maHoSo!)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  /**
   * Ca 7 (ghi nhận hiện trạng): người dùng CÙNG vai trò nhưng KHÔNG phải assignee
   * (PDT002 thay PDT001 — chính sách "hộp thư chung theo vai trò") vẫn duyệt được
   * bước đúng vai trò PHONG_DAO_TAO của mình.
   */
  it('Phòng Đào tạo khác (không phải assignee) duyệt bước PĐT được', async () => {
    const { student } = await laMauSinhVienVaLuong()
    const sv = await prisma.student.findUniqueOrThrow({
      where: { userId: student.user.id },
      include: { class: { include: { coVan: true } } },
    })
    await submit(studentSession!, maHoSo!)

    // Lần lượt tới bước 3 (PHONG_DAO_TAO) bằng người phụ trách.
    await duyet(await login(sv.class.coVan!.maSo), maHoSo!)

    const truongKhoa = await prisma.user.findFirstOrThrow({
      where: { role: 'TRUONG_KHOA', deletedAt: null, trangThai: 'ACTIVE' },
      orderBy: { maSo: 'asc' },
    })
    await duyet(await login(truongKhoa.maSo), maHoSo!)

    const assignee = await prisma.stepInstance.findFirstOrThrow({
      where: { application: { maHoSo: maHoSo! }, stepOrder: 3 },
    })
    // Chọn người PĐT KHÔNG phải assignee của bước 3 để chứng minh quyền theo vai trò.
    const pdtKhac = await prisma.user.findFirstOrThrow({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null, trangThai: 'ACTIVE', id: { not: assignee.assigneeId! } },
      orderBy: { maSo: 'asc' },
    })

    const res = await duyet(await login(pdtKhac.maSo), maHoSo!)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })

  /**
   * Ca 6 (ghi nhận hiện trạng, không đổi hành vi): Admin được duyệt thay mọi bước
   * và luôn để lại dấu vết APPROVE_APPLICATION trong audit log.
   */
  it('Admin duyệt thay được (hành vi chủ đích) + audit log ghi nhận', async () => {
    await laMauSinhVienVaLuong()
    await submit(studentSession!, maHoSo!)

    const admin = await login('ADMIN')
    const res = await duyet(admin, maHoSo!)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.currentStepOrder).toBe(2)

    const audit = await prisma.auditLog.findFirst({
      where: { hanhDong: 'APPROVE_APPLICATION', doiTuongId: maHoSo! },
      orderBy: { luc: 'desc' },
    })
    expect(audit, 'Admin phê duyệt phải được ghi audit log').not.toBeNull()
    expect(audit?.nguoiThucHienId).toBe(admin.user.id)
  })
})
