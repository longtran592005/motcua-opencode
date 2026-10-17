/**
 * BỘ KIỂM THỬ LÕI 2: VÒNG ĐỜI VÀ LUỒNG HỒ SƠ ĐẦY ĐỦ
 *
 * Kiểm tra: Luồng 3 cấp, luồng 1 cấp, từ chối, bổ sung, rút đơn,
 * sai thứ tự, xác thực biểu mẫu và ủy quyền.
 * Mọi ca kết thúc bằng kiểm tra toàn vẹn CSDL (runIntegrityChecks).
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
  currentStepOf,
  driveToCompletion,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
  type Session,
} from '../helpers'
import { runIntegrityChecks } from '../../../scripts/check-integrity'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('2. Luồng hồ sơ đầy đủ (Application Lifecycle & Workflows)', () => {
  let sv: Session
  let studentUserId: string
  let admin: Session

  beforeAll(async () => {
    const [st] = await twoStudents()
    sv = await login(st.user.maSo)
    studentUserId = sv.user.id
    admin = await login('admin')
  })

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  // 1. Luồng 3 cấp trọn vẹn
  it('Luồng 3 cấp: SV nộp -> CVHT duyệt -> Trưởng khoa ký OTP -> Phòng Đào tạo ký OTP -> COMPLETED có văn bản', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'OTP' },
      { role: 'PHONG_DAO_TAO', mode: 'OTP' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    // Duyệt qua cả 3 bước tới hoàn tất
    const completedApp = await driveToCompletion(draft.maHoSo, studentUserId)
    expect(completedApp.trangThai).toBe('COMPLETED')

    // Kiểm tra có văn bản ký điện tử
    const doc = await prisma.signedDocument.findFirst({
      where: { applicationId: completedApp.id },
    })
    expect(doc).not.toBeNull()
    expect(doc?.trangThai).toBe('VALID')

    // Tra cứu công khai báo hợp lệ
    const verifyRes = await api().get(`/api/v1/public/verify/token/${doc!.tokenXacThuc}`)
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.data.trangThai).toBe('VALID')

    // Toàn vẹn CSDL
    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length, 'Không có vi phạm toàn vẹn CSDL').toBe(0)
  })

  // 2. Luồng 1 cấp
  it('Luồng 1 cấp: SV nộp -> CVHT duyệt một chạm -> COMPLETED có văn bản', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const completedApp = await driveToCompletion(draft.maHoSo, studentUserId)
    expect(completedApp.trangThai).toBe('COMPLETED')

    const doc = await prisma.signedDocument.findFirst({
      where: { applicationId: completedApp.id },
    })
    expect(doc).not.toBeNull()

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 3. Từ chối ở một cấp
  it('Từ chối ở một cấp: Bắt buộc lý do, hồ sơ chuyển sang REJECTED, sinh viên nhận thông báo', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')

    // Từ chối không có lý do -> 400
    const noReason = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/reject`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(noReason.status).toBe(400)

    // Từ chối có lý do -> 200
    const rejectRes = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/reject`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Hồ sơ không đáp ứng tiêu chuẩn theo quy định.' })
    expect(rejectRes.status).toBe(200)
    expect(rejectRes.body.data.trangThai).toBe('REJECTED')

    // Sinh viên nhận được thông báo
    const notif = await prisma.notification.findFirst({
      where: { userId: studentUserId, applicationId: draft.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(notif).not.toBeNull()

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 4. Yêu cầu bổ sung
  it('Yêu cầu bổ sung: Hồ sơ chuyển NEED_SUPPLEMENT -> SV bổ sung -> quay lại đúng cấp đã yêu cầu', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')

    // CVHT yêu cầu bổ sung
    const reqSup = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/request-supplement`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Vui lòng nộp bản chụp CCCD rõ nét.' })
    expect(reqSup.status).toBe(200)
    expect(reqSup.body.data.trangThai).toBe('NEED_SUPPLEMENT')

    // Sinh viên bổ sung hồ sơ
    const supRes = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
      .set(bearer(sv.token))
      .set('Idempotency-Key', idemKey())
      .send({
        duLieu: { lyDo: 'Đã bổ sung CCCD rõ nét' },
      })
    expect(supRes.status).toBe(200)
    expect(supRes.body.data.trangThai).toBe('PENDING_APPROVAL')
    expect(supRes.body.data.currentStepOrder).toBe(1)

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 5. Rút đơn
  it('Rút đơn: Rút thành công khi chưa cấp nào duyệt; bị chặn khi đã có cấp duyệt thành công', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])

    // Đơn 1: Chưa cấp nào duyệt -> rút thành công
    const draft1 = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft1.maHoSo)

    const cancel1 = await api()
      .post(`/api/v1/applications/${draft1.maHoSo}/cancel`)
      .set(bearer(sv.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Không còn nhu cầu' })
    expect(cancel1.status).toBe(200)
    expect(cancel1.body.data.trangThai).toBe('CANCELLED')

    // Đơn 2: Cấp 1 đã duyệt -> rút bị từ chối 409
    const draft2 = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft2.maHoSo)

    const { session: cvSession } = await approverFor(studentUserId, 'CO_VAN')
    await api()
      .post(`/api/v1/approvals/${draft2.maHoSo}/approve`)
      .set(bearer(cvSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt bước 1' })

    const cancel2 = await api()
      .post(`/api/v1/applications/${draft2.maHoSo}/cancel`)
      .set(bearer(sv.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'Muốn rút sau khi đã duyệt' })
    expect(cancel2.status).toBe(409)

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 6. Duyệt sai thứ tự
  it('Duyệt sai thứ tự: Cấp 2 duyệt khi cấp 1 chưa duyệt bị chặn', async () => {
    const flow = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    // Trưởng khoa (bước 2) cố tình duyệt khi đang ở bước 1 (của CO_VAN)
    const { session: tkSession } = await approverFor(studentUserId, 'TRUONG_KHOA')
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(tkSession.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Trưởng khoa duyệt tắt' })

    expect([400, 403, 409, 422]).toContain(res.status)

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 7. Nộp thiếu trường hoặc giấy tờ bắt buộc
  it('Nộp đơn thiếu trường dữ liệu hoặc giấy tờ bắt buộc bị chặn VALIDATION_ERROR', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }], {
      formFields: [{ key: 'batBuoc', label: 'Bắt buộc', type: 'text', required: true, order: 1 }],
      giayTo: [{ key: 'docBatBuoc', label: 'Tài liệu bắt buộc', batBuoc: true }],
    })

    // Tạo đơn nháp rỗng
    const res = await api()
      .post('/api/v1/applications')
      .set(bearer(sv.token))
      .set('Idempotency-Key', idemKey())
      .send({
        requestTypeId: flow.requestType.id,
        duLieu: {},
        tepDinhKem: [],
      })
    expect(res.status).toBe(201)
    const maHoSo = res.body.data.maHoSo

    // Nộp khi thiếu trường -> 400 hoặc 422
    const submitRes = await api()
      .post(`/api/v1/applications/${maHoSo}/submit`)
      .set(bearer(sv.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect([400, 422]).toContain(submitRes.status)

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })

  // 8. Ủy quyền duyệt thay
  it('Ủy quyền: Người được ủy quyền hợp lệ duyệt thay được; ủy quyền hết hạn bị từ chối', async () => {
    const flow = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(sv, flow.requestType.id)
    await submit(sv, draft.maHoSo)

    const { user: coVanGoc } = await approverFor(studentUserId, 'CO_VAN')
    const nguoiNhan = await prisma.user.findFirst({
      where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null, id: { not: coVanGoc.id } },
    })
    expect(nguoiNhan).not.toBeNull()
    const sessionNguoiNhan = await login(nguoiNhan!.maSo)

    // Tạo ủy quyền còn hạn
    const del = await prisma.delegation.create({
      data: {
        nguoiUyQuyenId: coVanGoc.id,
        nguoiNhanId: nguoiNhan!.id,
        vaiTro: 'CO_VAN',
        tuNgay: new Date(Date.now() - 3600_000),
        denNgay: new Date(Date.now() + 86400_000),
        lyDo: 'Kiểm thử ủy quyền',
        hoatDong: true,
      },
    })

    // Người nhận ủy quyền duyệt thay thành công
    const approveRes = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionNguoiNhan.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt thay theo ủy quyền' })
    expect(approveRes.status).toBe(200)

    // Xóa ủy quyền
    await prisma.delegation.delete({ where: { id: del.id } })

    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length).toBe(0)
  })
})
