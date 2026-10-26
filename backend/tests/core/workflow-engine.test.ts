/**
 * BỘ KIỂM THỬ LÕI WORKFLOW ENGINE (Bước 1 — Phần C).
 *
 * Bao phủ: ma trận chuyển trạng thái qua API, khoá dòng khi hai người duyệt
 * song song, rollback khi lỗi giữa chừng, ảnh chụp luồng (snapshot), bổ sung
 * quay về đúng cấp, luồng 1/2/3 cấp tới COMPLETED (0 vi phạm toàn vẹn),
 * chữ ký số, kênh OTP, giới hạn tần suất, và khoá ký HMAC theo môi trường (Q2).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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
  driveToCompletion,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
  type Session,
} from '../helpers'
import { runIntegrityChecks } from '../../../scripts/check-integrity'
import { takeCapturedOtp, getOtpChannel, sendOtp, type OtpMessage } from '../../src/modules/otp/channel'
import { authLimiter, setRateLimitEnabled } from '../../src/middleware/rateLimit'
import { DEV_HMAC_SECRET, env, signatureSecretProblem } from '../../src/config/env'
import { issueDocument } from '../../src/modules/documents/issuer'

// Cho phép mô phỏng lỗi sau khi engine đã ghi `approval` (kiểm tra rollback).
vi.mock('../../src/modules/documents/issuer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/modules/documents/issuer')>()
  return { ...actual, issueDocument: vi.fn(actual.issueDocument) }
})

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

async function assertIntegrity(message: string): Promise<void> {
  const violations = await runIntegrityChecks(DATABASE_URL)
  expect(violations, message).toEqual([])
}

describe('Lõi workflow engine (Bước 1)', () => {
  let sv: Session
  let studentUserId: string

  beforeAll(async () => {
    const [st] = await twoStudents()
    sv = await login(st.user.maSo)
    studentUserId = sv.user.id
  })

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  afterAll(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
  })

  /* ------------------------------------------------------------------ *
   * 1. Ma trận chuyển trạng thái — các chuyển hợp lệ
   * ------------------------------------------------------------------ */

  describe('Chuyển trạng thái hợp lệ', () => {
    it('SUBMIT → APPROVE → APPROVE → COMPLETED (luồng 2 cấp)', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      ])
      const draft = await createDraft(sv, requestType.id)
      const submitted = await submit(sv, draft.maHoSo)
      expect(submitted.trangThai).toBe('SUBMITTED')

      const b1 = await approveCurrentStep(draft.maHoSo, studentUserId)
      expect(b1.status).toBe(200)
      expect(b1.body.data.trangThai).toBe('PENDING_APPROVAL')

      const b2 = await approveCurrentStep(draft.maHoSo, studentUserId)
      expect(b2.status).toBe(200)
      expect(b2.body.data.trangThai).toBe('COMPLETED')
    })

    it('REJECT → REJECTED', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')
      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/reject`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'Thiếu minh chứng theo quy định.' })
      expect(res.status).toBe(200)
      expect(res.body.data.trangThai).toBe('REJECTED')
    })

    it('REQUEST_SUPPLEMENT → NEED_SUPPLEMENT → SUPPLEMENT → PENDING_APPROVAL', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')
      const yeuCau = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/request-supplement`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ noiDung: 'Vui lòng bổ sung bản sao công chứng.' })
      expect(yeuCau.status).toBe(200)
      expect(yeuCau.body.data.trangThai).toBe('NEED_SUPPLEMENT')

      const boSung = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ duLieu: { ghiChu: 'Đã bổ sung bản sao công chứng.' } })
      expect(boSung.status).toBe(200)
      expect(boSung.body.data.trangThai).toBe('PENDING_APPROVAL')
    })

    it('CANCEL → CANCELLED (khi chưa cấp nào duyệt)', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const res = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'Không còn nhu cầu.' })
      expect(res.status).toBe(200)
      expect(res.body.data.trangThai).toBe('CANCELLED')
    })
  })

  /* ------------------------------------------------------------------ *
   * 2. Ma trận chuyển trạng thái — các chuyển KHÔNG hợp lệ
   * ------------------------------------------------------------------ */

  describe('Chuyển trạng thái không hợp lệ → INVALID_TRANSITION', () => {
    it('nộp lại hồ sơ đã nộp', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const res = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/submit`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({})
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('phê duyệt khi hồ sơ còn là bản nháp', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'duyệt nháp' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('từ chối khi hồ sơ còn là bản nháp', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/reject`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'từ chối nháp' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('yêu cầu bổ sung khi hồ sơ còn là bản nháp', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/request-supplement`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ noiDung: 'bổ sung khi chưa nộp' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('bổ sung khi hồ sơ không ở trạng thái Cần bổ sung', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const res = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ duLieu: { ghiChu: 'bổ sung không được yêu cầu' } })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('rút hồ sơ khi còn là bản nháp', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)

      const res = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'rút nháp' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('rút hồ sơ sau khi đã có một cấp duyệt', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      expect((await approveCurrentStep(draft.maHoSo, studentUserId)).status).toBe(200)

      const res = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'rút dù đã duyệt' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })

    it('phê duyệt sau khi hồ sơ đã bị từ chối', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const rejected = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/reject`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ lyDo: 'Không hợp lệ.' })
      expect(rejected.status).toBe(200)

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'duyệt sau khi đã từ chối' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('INVALID_TRANSITION')
    })
  })

  /* ------------------------------------------------------------------ *
   * 3. Khoá dòng: hai người duyệt song song
   * ------------------------------------------------------------------ */

  describe('Khoá dòng khi duyệt song song', () => {
    it('hai người cùng vai trò duyệt song song: một thành công, người kia bị chặn', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const { session: a } = await approverFor(studentUserId, 'CO_VAN')
      const { session: b } = await approverFor(studentUserId, 'CO_VAN')

      const gui = (token: string) =>
        api()
          .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
          .set(bearer(token))
          .set('Idempotency-Key', idemKey())
          .send({ ghiChu: 'duyệt song song' })

      const [ra, rb] = await Promise.all([gui(a.token), gui(b.token)])
      const ketQua = [ra, rb]
      expect(ketQua.filter((r) => r.status === 200)).toHaveLength(1)
      const thua = ketQua.find((r) => r.status !== 200)!
      expect([403, 409]).toContain(thua.status)
      if (thua.status === 409) expect(thua.body.error.code).toBe('ALREADY_PROCESSED')

      // Chỉ có ĐÚNG một bản ghi APPROVE ở bước 1.
      const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
      const soLanDuyet = await prisma.approval.count({
        where: { applicationId: app.id, buocOrder: 1, hanhDong: 'APPROVE' },
      })
      expect(soLanDuyet).toBe(1)
      expect(app.currentStepOrder).toBe(2)
    })

    it('người đến sau khi bước đã bị xử lý → ALREADY_PROCESSED (tất định)', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      const { step } = await currentStepOf(draft.maHoSo)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')
      // Người B đọc thấy bước 1 rồi người A duyệt xong trước (hồ sơ đã sang bước 2).
      expect((await approveCurrentStep(draft.maHoSo, studentUserId)).status).toBe(200)

      const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
      expect(app.currentStepOrder).toBe(2)
      // Người B gửi lại yêu cầu duyệt cho BƯỚC 1 đã bị xử lý → ALREADY_PROCESSED.
      await prisma.application.update({
        where: { id: app.id },
        data: { currentStepOrder: step!.stepOrder },
      })
      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'duyệt lại bước đã xử lý' })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('ALREADY_PROCESSED')
    })
  })

  /* ------------------------------------------------------------------ *
   * 4. Rollback khi lỗi giữa chừng
   * ------------------------------------------------------------------ */

  describe('Rollback khi lỗi giữa chừng', () => {
    it('lỗi sau khi đã ghi approval → giao dịch hoàn nguyên toàn bộ', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      vi.mocked(issueDocument).mockRejectedValueOnce(new Error('Lỗi giả lập khi cấp văn bản'))

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ ghiChu: 'duyệt gây lỗi giữa chừng' })
      expect(res.status).toBe(500)

      // Không có thay đổi nào được giữ lại.
      const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
      expect(app.trangThai).toBe('SUBMITTED')
      expect(app.currentStepOrder).toBe(1)
      const step = await prisma.stepInstance.findFirstOrThrow({
        where: { applicationId: app.id, stepOrder: 1 },
      })
      expect(step.trangThai).toBe('IN_PROGRESS')
      expect(await prisma.signature.count({ where: { applicationId: app.id } })).toBe(0)
      expect(
        await prisma.approval.count({
          where: { applicationId: app.id, buocOrder: 1, hanhDong: 'APPROVE' },
        }),
      ).toBe(0)
      expect(await prisma.signedDocument.count({ where: { applicationId: app.id } })).toBe(0)
    })

    it('OTP sai ở bước ký → rollback bước đang xử lý', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'OTP' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const send = await api()
        .post('/api/v1/otp/send')
        .set(bearer(cv.token))
        .send({ maHoSo: draft.maHoSo })
      expect(send.status).toBe(200)
      const challengeId = send.body.data.challengeId as string
      const dung = takeCapturedOtp(challengeId)!
      const sai = dung === '000000' ? '111111' : '000000'

      const res = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
        .set(bearer(cv.token))
        .set('Idempotency-Key', idemKey())
        .send({ challengeId, otp: sai })
      expect(res.status).toBe(400)

      const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
      expect(app.trangThai).toBe('SUBMITTED')
      const step = await prisma.stepInstance.findFirstOrThrow({
        where: { applicationId: app.id, stepOrder: 1 },
      })
      expect(step.trangThai).toBe('IN_PROGRESS')
      expect(await prisma.signature.count({ where: { applicationId: app.id } })).toBe(0)
    })
  })

  /* ------------------------------------------------------------------ *
   * 5. Ảnh chụp luồng (snapshot)
   * ------------------------------------------------------------------ */

  describe('Ảnh chụp luồng duyệt', () => {
    it('đổi workflow sau khi nộp không ảnh hưởng đơn đang chạy; đơn mới theo luồng mới', async () => {
      const { workflow, requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      ])
      const draftCu = await createDraft(sv, requestType.id)
      await submit(sv, draftCu.maHoSo)

      // Sửa luồng: thêm một cấp → phiên bản 2.
      const admin = await login('admin')
      const patch = await api()
        .patch(`/api/v1/workflows/${workflow.id}`)
        .set(bearer(admin.token))
        .set('Idempotency-Key', idemKey())
        .send({
          steps: [
            { ten: 'Bước 1', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 48, allowReject: true, allowSupplement: true },
            { ten: 'Bước 2', role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK', slaHours: 48, allowReject: true, allowSupplement: true },
            { ten: 'Bước 3', role: 'TRUONG_KHOA', mode: 'ONE_CLICK', slaHours: 48, allowReject: true, allowSupplement: true },
          ],
        })
      expect(patch.status).toBe(200)

      // Đơn đã nộp giữ NGUYÊN ảnh chụp phiên bản 1 (2 bước).
      const appCu = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draftCu.maHoSo } })
      const snapCu = appCu.workflowSnapshot as { version: number; steps: Array<{ role: string }> }
      expect(snapCu.version).toBe(1)
      expect(snapCu.steps.map((s) => s.role)).toEqual(['CO_VAN', 'TRUONG_KHOA'])

      // Đơn nộp SAU dùng phiên bản mới (3 bước).
      const draftMoi = await createDraft(sv, requestType.id)
      await submit(sv, draftMoi.maHoSo)
      const appMoi = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draftMoi.maHoSo } })
      const snapMoi = appMoi.workflowSnapshot as { version: number; steps: Array<{ role: string }> }
      expect(snapMoi.version).toBe(2)
      expect(snapMoi.steps.map((s) => s.role)).toEqual(['CO_VAN', 'PHONG_DAO_TAO', 'TRUONG_KHOA'])
    })

    it('đơn cũ (đã nộp trước khi có snapshot) vẫn chạy bình thường', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)

      // Mô phỏng hồ sơ cũ: xoá ảnh chụp đi (fallback về luồng sống).
      await prisma.application.update({
        where: { maHoSo: draft.maHoSo },
        data: { workflowSnapshot: undefined },
      })

      const res = await approveCurrentStep(draft.maHoSo, studentUserId)
      expect(res.status).toBe(200)
      expect(res.body.data.trangThai).toBe('COMPLETED')
    })
  })

  /* ------------------------------------------------------------------ *
   * 6. Bổ sung quay về ĐÚNG cấp đã yêu cầu
   * ------------------------------------------------------------------ */

  describe('Bổ sung quay về đúng cấp', () => {
    it('yêu cầu bổ sung ở bước 2 → quay về bước 2, không chạy lại bước 1', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
        { role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      expect((await approveCurrentStep(draft.maHoSo, studentUserId)).status).toBe(200)

      const { session: tk } = await approverFor(studentUserId, 'TRUONG_KHOA')
      const yeuCau = await api()
        .post(`/api/v1/approvals/${draft.maHoSo}/request-supplement`)
        .set(bearer(tk.token))
        .set('Idempotency-Key', idemKey())
        .send({ noiDung: 'Bổ sung bảng điểm.' })
      expect(yeuCau.status).toBe(200)

      const giuaChung = await currentStepOf(draft.maHoSo)
      expect(giuaChung.app.yeuCauBoSung).toMatchObject({ quayVeBuocOrder: 2 })

      const boSung = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
        .set(bearer(sv.token))
        .set('Idempotency-Key', idemKey())
        .send({ duLieu: { ghiChu: 'Đã bổ sung.' } })
      expect(boSung.status).toBe(200)

      const sau = await currentStepOf(draft.maHoSo)
      expect(sau.app.currentStepOrder).toBe(2)
      expect(sau.app.buocDaDuyet).toBe(1)
      expect(sau.step!.trangThai).toBe('IN_PROGRESS')
      // Bước 1 vẫn giữ nguyên APPROVED, không bị chạy lại.
      const b1 = sau.app.stepInstances.find((s) => s.stepOrder === 1)
      expect(b1?.trangThai).toBe('APPROVED')
    })
  })

  /* ------------------------------------------------------------------ *
   * 7. Luồng 1/2/3 cấp tới COMPLETED + toàn vẹn dữ liệu
   * ------------------------------------------------------------------ */

  describe('Luồng 1/2/3 cấp tới COMPLETED, 0 vi phạm toàn vẹn', () => {
    it('luồng 1 cấp (một chạm)', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const done = await driveToCompletion(draft.maHoSo, studentUserId)
      expect(done.trangThai).toBe('COMPLETED')
      await assertIntegrity('luồng 1 cấp không có vi phạm toàn vẹn')
    })

    it('luồng 2 cấp (một chạm + OTP)', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'OTP' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const done = await driveToCompletion(draft.maHoSo, studentUserId)
      expect(done.trangThai).toBe('COMPLETED')
      await assertIntegrity('luồng 2 cấp không có vi phạm toàn vẹn')
    })

    it('luồng 3 cấp (một chạm + OTP + OTP)', async () => {
      const { requestType } = await createFlow([
        { role: 'CO_VAN', mode: 'ONE_CLICK' },
        { role: 'TRUONG_KHOA', mode: 'OTP' },
        { role: 'PHONG_DAO_TAO', mode: 'OTP' },
      ])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const done = await driveToCompletion(draft.maHoSo, studentUserId)
      expect(done.trangThai).toBe('COMPLETED')
      await assertIntegrity('luồng 3 cấp không có vi phạm toàn vẹn')
    })
  })

  /* ------------------------------------------------------------------ *
   * 8. Chữ ký số
   * ------------------------------------------------------------------ */

  describe('Chữ ký số', () => {
    it('chữ ký hợp lệ sau khi ký; sửa nội dung rồi xác thực lại → thất bại', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      await driveToCompletion(draft.maHoSo, studentUserId)

      const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
      const doc = await prisma.signedDocument.findFirstOrThrow({ where: { applicationId: app.id } })

      const truoc = await api().get(`/api/v1/documents/${doc.id}`).set(bearer(sv.token))
      expect(truoc.status).toBe(200)
      const chuKyTruoc = truoc.body.data.chuKy as Array<{ hopLeThucTe: boolean | null }>
      expect(chuKyTruoc.length).toBeGreaterThan(0)
      expect(chuKyTruoc.every((c) => c.hopLeThucTe === true)).toBe(true)
      expect(truoc.body.data.chuKyConHieuLuc).toBe(true)

      // Sửa nội dung hồ sơ sau khi đã ký.
      await prisma.application.update({
        where: { id: app.id },
        data: { duLieu: { ...(app.duLieu as Record<string, unknown>), ghiChu: 'NỘI DUNG BỊ SỬA SAU KHI KÝ' } },
      })

      const sau = await api().get(`/api/v1/documents/${doc.id}`).set(bearer(sv.token))
      const chuKySau = sau.body.data.chuKy as Array<{ hopLeThucTe: boolean | null }>
      expect(chuKySau.some((c) => c.hopLeThucTe === false)).toBe(true)
      expect(sau.body.data.chuKyConHieuLuc).toBe(false)
    })
  })

  /* ------------------------------------------------------------------ *
   * 9. Kênh OTP
   * ------------------------------------------------------------------ */

  describe('Kênh gửi OTP', () => {
    it('mã OTP không lộ trong phản hồi API hay nhật ký kiểm toán', async () => {
      const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'OTP' }])
      const draft = await createDraft(sv, requestType.id)
      await submit(sv, draft.maHoSo)
      const { session: cv } = await approverFor(studentUserId, 'CO_VAN')

      const send = await api()
        .post('/api/v1/otp/send')
        .set(bearer(cv.token))
        .send({ maHoSo: draft.maHoSo })
      expect(send.status).toBe(200)
      const challengeId = send.body.data.challengeId as string
      const raw = takeCapturedOtp(challengeId)
      expect(raw).toBeDefined()

      expect(JSON.stringify(send.body)).not.toContain(raw!)
      const status = await api().get(`/api/v1/otp/${challengeId}`).set(bearer(cv.token))
      expect(JSON.stringify(status.body)).not.toContain(raw!)

      const logs = await prisma.auditLog.findMany({
        where: { luc: { gte: new Date(Date.now() - 60_000) } },
        take: 30,
      })
      for (const l of logs) expect(JSON.stringify(l)).not.toContain(raw!)
    })

    it('môi trường chưa cấu hình kênh thật → từ chối gửi và báo lỗi cấu hình', async () => {
      const truoc = env.OTP_CHANNEL
      env.OTP_CHANNEL = 'SMS'
      try {
        expect(getOtpChannel().ten).toBe('SMS')
        const msg: OtpMessage = {
          challengeId: 'kiem-thu',
          otp: '123456',
          maHoSo: 'MC-TEST-000000',
          stepOrder: 1,
          hetHanLuc: new Date(Date.now() + 60_000),
          to: { id: 'u', hoTen: 'Kiểm thử', email: null, soDienThoai: null },
        }
        await expect(sendOtp(msg)).rejects.toMatchObject({ status: 503 })
      } finally {
        env.OTP_CHANNEL = truoc
      }
    })

    it('kênh CONSOLE (development) in mã ra console máy chủ, không qua log có cấu trúc', async () => {
      const truoc = env.OTP_CHANNEL
      env.OTP_CHANNEL = 'CONSOLE'
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
      try {
        await sendOtp({
          challengeId: 'kiem-thu-console',
          otp: '654321',
          maHoSo: 'MC-TEST-999999',
          stepOrder: 1,
          hetHanLuc: new Date(Date.now() + 60_000),
          to: { id: 'u', hoTen: 'Kiểm thử', email: null, soDienThoai: null },
        })
        const daIn = write.mock.calls.map((c) => String(c[0])).join('')
        expect(daIn).toContain('654321')
      } finally {
        write.mockRestore()
        env.OTP_CHANNEL = truoc
      }
    })
  })

  /* ------------------------------------------------------------------ *
   * 10. Giới hạn tần suất
   * ------------------------------------------------------------------ */

  describe('Giới hạn tần suất → RATE_LIMITED', () => {
    it('vượt ngưỡng → 429 RATE_LIMITED kèm tiêu đề Retry-After', async () => {
      setRateLimitEnabled(true)
      authLimiter.resetKey('127.0.0.1')
      try {
        const ketQua: Array<{ status: number; code?: string; retryAfter?: string }> = []
        for (let i = 0; i < 22; i += 1) {
          const res = await api()
            .post('/api/v1/auth/login')
            .send({ dinhDanh: 'admin', matKhau: 'demo1234' })
          ketQua.push({
            status: res.status,
            code: res.body?.error?.code,
            retryAfter: res.headers['retry-after'],
          })
        }
        const chan = ketQua.find((r) => r.status === 429)
        expect(chan, 'phải có ít nhất một phản hồi bị chặn').toBeDefined()
        expect(chan!.code).toBe('RATE_LIMITED')
        expect(chan!.retryAfter).toBeDefined()
      } finally {
        setRateLimitEnabled(false)
        authLimiter.resetKey('127.0.0.1')
      }
    })
  })

  /* ------------------------------------------------------------------ *
   * 11. Khoá ký HMAC theo môi trường (Q2)
   * ------------------------------------------------------------------ */

  describe('Khoá ký HMAC theo môi trường (Q2)', () => {
    it('production hoặc NODE_ENV chưa đặt mà thiếu khoá → từ chối khởi động', () => {
      expect(signatureSecretProblem('production', 'INTERNAL_HMAC', DEV_HMAC_SECRET)).not.toBeNull()
      expect(signatureSecretProblem(undefined, 'INTERNAL_HMAC', DEV_HMAC_SECRET)).not.toBeNull()
      expect(signatureSecretProblem('staging', 'INTERNAL_HMAC', DEV_HMAC_SECRET)).not.toBeNull()
      expect(
        signatureSecretProblem('production', 'INTERNAL_HMAC', DEV_HMAC_SECRET),
      ).toMatch(/TỪ CHỐI KHỞI ĐỘNG/)
    })

    it('development/test hoặc có khoá riêng → hợp lệ', () => {
      expect(signatureSecretProblem('development', 'INTERNAL_HMAC', DEV_HMAC_SECRET)).toBeNull()
      expect(signatureSecretProblem('test', 'INTERNAL_HMAC', DEV_HMAC_SECRET)).toBeNull()
      expect(
        signatureSecretProblem('production', 'INTERNAL_HMAC', 'khoa-rieng-du-16-ky-tu-abc'),
      ).toBeNull()
      expect(signatureSecretProblem('production', 'RSA_SHA256', DEV_HMAC_SECRET)).toBeNull()
    })
  })
})
