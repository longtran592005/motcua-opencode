import { afterAll, describe, expect, it } from 'vitest'
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
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'
import {
  TRANSITION_ACTIONS,
  TRANSITION_RULES,
  isTransitionAllowed,
} from '../src/modules/workflow/engine'

const ALL_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'NEED_SUPPLEMENT',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

describe('Ma trận chuyển trạng thái (bảng đặc tả)', () => {
  it('mọi cặp (trạng thái × hành động) khớp bảng đặc tả', () => {
    const bang: Record<string, string[]> = {
      SUBMIT: ['DRAFT'],
      APPROVE: ['SUBMITTED', 'PENDING_APPROVAL'],
      REJECT: ['SUBMITTED', 'PENDING_APPROVAL'],
      REQUEST_SUPPLEMENT: ['SUBMITTED', 'PENDING_APPROVAL'],
      SUPPLEMENT: ['NEED_SUPPLEMENT'],
      CANCEL: ['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'],
    }

    let hopLe = 0
    let khongHopLe = 0
    for (const action of TRANSITION_ACTIONS) {
      for (const trangThai of ALL_STATUSES) {
        const mongDoi = bang[action].includes(trangThai)
        expect(isTransitionAllowed(trangThai, action), `${action} từ ${trangThai}`).toBe(mongDoi)
        if (mongDoi) hopLe += 1
        else khongHopLe += 1
      }
    }

    // 6 hành động × 7 trạng thái = 42 ô, trong đó 11 ô hợp lệ.
    expect(hopLe).toBe(11)
    expect(khongHopLe).toBe(31)
    expect(TRANSITION_RULES.map((r) => r.action).sort()).toEqual([...TRANSITION_ACTIONS].sort())
  })

  it('trạng thái sau khi chuyển khớp bảng', () => {
    const sau: Record<string, string> = {
      SUBMIT: 'SUBMITTED',
      APPROVE: 'PENDING_APPROVAL',
      REJECT: 'REJECTED',
      REQUEST_SUPPLEMENT: 'NEED_SUPPLEMENT',
      SUPPLEMENT: 'PENDING_APPROVAL',
      CANCEL: 'CANCELLED',
    }
    for (const rule of TRANSITION_RULES) {
      expect(rule.ketQua, rule.action).toBe(sau[rule.action])
    }
  })
})

describe('Chuyển trạng thái bị từ chối qua API', () => {
  it('nộp hai lần → INVALID_TRANSITION', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const res = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/submit`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({})
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('bổ sung khi không ở trạng thái Cần bổ sung → INVALID_TRANSITION', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const res = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ duLieu: { lyDo: 'bổ sung khi chưa được yêu cầu' } })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('phê duyệt khi hồ sơ còn là bản nháp → INVALID_TRANSITION', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)

    const { session: approver } = await approverFor(student.userId, 'CO_VAN')
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approver.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'duyệt nháp' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('rút hồ sơ sau khi đã có một cấp duyệt → INVALID_TRANSITION', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const approved = await approveCurrentStep(draft.maHoSo, student.userId)
    expect(approved.status).toBe(200)

    const res = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/cancel`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ lyDo: 'muốn rút dù đã duyệt' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('bước đã bị xử lý nhưng hồ sơ vẫn dừng ở bước đó → ALREADY_PROCESSED', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    // Mô phỏng: một người khác đã xử lý xong bước này (hồ sơ chưa kịp chuyển bước).
    await prisma.stepInstance.update({
      where: { id: step!.id },
      data: { trangThai: 'APPROVED', completedAt: new Date() },
    })

    const { session: approver } = await approverFor(student.userId, step!.role)
    const res = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(approver.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'duyệt trùng' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_PROCESSED')
  })
})

describe('Bổ sung quay về ĐÚNG cấp đã yêu cầu', () => {
  it('yêu cầu bổ sung ở bước 2 → hồ sơ quay về bước 2, không phải bước 1', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([
      { role: 'CO_VAN', mode: 'ONE_CLICK' },
      { role: 'TRUONG_KHOA', mode: 'ONE_CLICK' },
      { role: 'PHONG_DAO_TAO', mode: 'ONE_CLICK' },
    ])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    // Bước 1 duyệt bình thường.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)

    // Bước 2 yêu cầu bổ sung.
    const { step: buoc2 } = await currentStepOf(draft.maHoSo)
    expect(buoc2!.stepOrder).toBe(2)
    const { session: nguoiBuoc2 } = await approverFor(student.userId, 'TRUONG_KHOA')
    const yeuCau = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/request-supplement`)
      .set(bearer(nguoiBuoc2.token))
      .set('Idempotency-Key', idemKey())
      .send({ noiDung: 'Bổ sung bảng điểm học kỳ gần nhất.' })
    expect(yeuCau.status).toBe(200)

    const sauYeuCau = await currentStepOf(draft.maHoSo)
    expect(sauYeuCau.app.trangThai).toBe('NEED_SUPPLEMENT')
    expect(sauYeuCau.app.yeuCauBoSung).toMatchObject({ quayVeBuocOrder: 2 })

    // Sinh viên bổ sung.
    const boSung = await api()
      .post(`/api/v1/applications/${draft.maHoSo}/supplement`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({ duLieu: { lyDo: 'Đã bổ sung bảng điểm.' } })
    expect(boSung.status).toBe(200)

    const sauBoSung = await currentStepOf(draft.maHoSo)
    expect(sauBoSung.app.trangThai).toBe('PENDING_APPROVAL')
    // QUAN TRỌNG: quay về ĐÚNG bước 2, không quay về bước 1.
    expect(sauBoSung.app.currentStepOrder).toBe(2)
    expect(sauBoSung.app.buocDaDuyet).toBe(1)
    expect(sauBoSung.step!.trangThai).toBe('IN_PROGRESS')
    expect(sauBoSung.step!.stepOrder).toBe(2)

    // Bước 1 vẫn giữ nguyên đã duyệt, không bị đặt lại.
    const buoc1 = await currentStepOf(draft.maHoSo)
    const step1 = buoc1.app.stepInstances.find((s: { stepOrder: number }) => s.stepOrder === 1)
    expect(step1?.trangThai).toBe('APPROVED')

    // Và duyệt tiếp được từ bước 2 tới hết.
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)
    const cuoi = await currentStepOf(draft.maHoSo)
    expect(cuoi.app.trangThai).toBe('COMPLETED')
  })
})
