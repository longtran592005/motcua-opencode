import { afterAll, describe, expect, it } from 'vitest'
import { runSlaJob } from '../src/modules/workflow/sla'
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
  twoStudents,
  userForRole,
} from './helpers'

const GIO = 3_600_000

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

/** Tao ho so 1 cap CO_VAN voi cau hinh SLA ro rang. */
async function taoHoSoSLA(opts: {
  nhacTruocGio?: number
  leoThangSauGio?: number
  escalateTo?: string | null
}) {
  const [student] = await twoStudents()
  const session = await login(student.user.maSo)
  const { requestType } = await createFlow([
    {
      role: 'CO_VAN',
      mode: 'ONE_CLICK',
      slaHours: 48,
      nhacTruocGio: opts.nhacTruocGio ?? 24,
      leoThangSauGio: opts.leoThangSauGio ?? 24,
      escalateTo: opts.escalateTo ?? 'TRUONG_KHOA',
    },
  ])
  const draft = await createDraft(session, requestType.id)
  await submit(session, draft.maHoSo)
  const { app, step } = await currentStepOf(draft.maHoSo)
  return { app, step: step!, session, student }
}

async function datThoiHan(stepId: string, lechMs: number) {
  await prisma.stepInstance.update({
    where: { id: stepId },
    data: {
      slaDueAt: new Date(Date.now() + lechMs),
      nhacLuc: null,
      daQuaHan: false,
      leoThangLuc: null,
    },
  })
}

describe('Job SLA', () => {
  it('nhắc TRƯỚC hạn đúng một lần rồi không nhắc lại', async () => {
    const { app, step } = await taoHoSoSLA({ nhacTruocGio: 24 })

    // Còn khoảng 1 giờ nữa tới hạn → trong khung nhắc.
    await datThoiHan(step.id, GIO)

    const lan1 = await runSlaJob()
    // Job có thể xử lý cả hồ sơ mẫu khác; kiểm tra riêng bước của chúng ta.
    expect(lan1.daNhac).toBeGreaterThanOrEqual(1)

    const sau1 = await prisma.stepInstance.findUniqueOrThrow({ where: { id: step.id } })
    expect(sau1.nhacLuc).not.toBeNull()
    expect(sau1.daQuaHan).toBe(false)

    // Có thông báo nhắc cho người được giao bước.
    const nhac = await prisma.notification.findFirst({
      where: { applicationId: app.id, loai: 'WARNING', tieuDe: 'Hồ sơ sắp tới hạn xử lý' },
    })
    expect(nhac).not.toBeNull()
    expect(nhac!.noiDung).toContain(app.maHoSo)

    const audit = await prisma.auditLog.findFirst({
      where: { doiTuongId: step.id, hanhDong: 'SLA_REMIND' },
    })
    expect(audit).not.toBeNull()

    // Chạy lại → không nhắc thêm cho bước này (mốc nhắc giữ nguyên).
    await runSlaJob()
    const sau2 = await prisma.stepInstance.findUniqueOrThrow({ where: { id: step.id } })
    expect(sau2.nhacLuc?.getTime()).toBe(sau1.nhacLuc!.getTime())

    const soThongBao = await prisma.notification.count({
      where: { applicationId: app.id, tieuDe: 'Hồ sơ sắp tới hạn xử lý' },
    })
    expect(soThongBao).toBe(1)
  })

  it('đánh dấu QUÁ HẠN khi đã qua thời hạn', async () => {
    const { app, step } = await taoHoSoSLA({})

    // Đã quá hạn 2 giờ, chưa từng nhắc.
    await datThoiHan(step.id, -2 * GIO)

    await runSlaJob()

    const sau = await prisma.stepInstance.findUniqueOrThrow({ where: { id: step.id } })
    expect(sau.daQuaHan).toBe(true)

    const quaHan = await prisma.notification.findFirst({
      where: { applicationId: app.id, loai: 'DANGER', tieuDe: 'Hồ sơ đã quá hạn xử lý' },
    })
    expect(quaHan).not.toBeNull()
    expect(quaHan!.noiDung).toContain('quá hạn')

    const audit = await prisma.auditLog.findFirst({
      where: { doiTuongId: step.id, hanhDong: 'SLA_OVERDUE' },
    })
    expect(audit).not.toBeNull()

    // Chạy lại → không báo thêm.
    await runSlaJob()
    const soThongBao = await prisma.notification.count({
      where: { applicationId: app.id, tieuDe: 'Hồ sơ đã quá hạn xử lý' },
    })
    expect(soThongBao).toBe(1)
  })

  it('LEO THANG lên cấp trên và cấp trên được quyền duyệt', async () => {
    const { app, step, student } = await taoHoSoSLA({ leoThangSauGio: 1, escalateTo: 'TRUONG_KHOA' })

    // Quá hạn 2 giờ, leo thang sau 1 giờ kể từ hạn → đã tới lúc.
    await datThoiHan(step.id, -2 * GIO)

    await runSlaJob()

    const sau = await prisma.stepInstance.findUniqueOrThrow({ where: { id: step.id } })
    expect(sau.leoThangLuc).not.toBeNull()
    expect(sau.escalateTo).toBe('TRUONG_KHOA')
    expect(sau.daQuaHan).toBe(true)

    // Thông báo gửi cho MỌI người có vai trò cấp trên.
    const len = await prisma.notification.findMany({
      where: { applicationId: app.id, tieuDe: 'Hồ sơ quá hạn cần bạn xử lý' },
    })
    expect(len.length).toBeGreaterThanOrEqual(1)
    expect(len[0]!.loai).toBe('DANGER')
    expect(len[0]!.noiDung).toContain('TRUONG_KHOA')

    const audit = await prisma.auditLog.findFirst({
      where: { doiTuongId: step.id, hanhDong: 'SLA_ESCALATE' },
    })
    expect(audit).not.toBeNull()

    // Trưởng khoa của khoa chứa sinh viên thấy hồ sơ trong hộp thư "Chờ tôi duyệt".
    const truongKhoa = await userForRole(student.userId, 'TRUONG_KHOA')
    const sessionTK = await login(truongKhoa!.maSo)

    const pending = await api()
      .get('/api/v1/approvals/pending')
      .query({ page: 1, pageSize: 50 })
      .set(bearer(sessionTK.token))
    expect(pending.body.data.some((a: { maHoSo: string }) => a.maHoSo === app.maHoSo)).toBe(true)

    // Trưởng khoa duyệt được bước của cố vấn học tập (thông qua leo thang).
    const duyet = await api()
      .post(`/api/v1/approvals/${app.maHoSo}/approve`)
      .set(bearer(sessionTK.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt theo leo thang SLA.' })
    expect(duyet.status).toBe(200)
    expect(duyet.body.data.trangThai).toBe('COMPLETED')

    // Chạy lại job → không leo thang thêm.
    await runSlaJob()
    const soThongBaoLeoThang = await prisma.notification.count({
      where: { applicationId: app.id, tieuDe: 'Hồ sơ quá hạn cần bạn xử lý' },
    })
    expect(soThongBaoLeoThang).toBe(len.length)
  })

  it('không nhắc khi còn quá sớm', async () => {
    const { app, step } = await taoHoSoSLA({ nhacTruocGio: 6 })

    // Còn 24 giờ tới hạn, khung nhắc là 6 giờ → chưa tới.
    await datThoiHan(step.id, 24 * GIO)

    await runSlaJob()

    const sau = await prisma.stepInstance.findUniqueOrThrow({ where: { id: step.id } })
    expect(sau.nhacLuc).toBeNull()
    expect(sau.daQuaHan).toBe(false)
    expect(sau.leoThangLuc).toBeNull()

    const thongBao = await prisma.notification.count({
      where: { applicationId: app.id, tieuDe: 'Hồ sơ sắp tới hạn xử lý' },
    })
    expect(thongBao).toBe(0)
  })
})
