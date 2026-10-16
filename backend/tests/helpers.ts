import { randomUUID } from 'node:crypto'
import supertest from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'

/** Ứng dụng dùng chung cho mọi ca kiểm thử (không mở cổng mạng). */
export const app = createApp()
export const api = () => supertest(app)
export { prisma }

export interface Session {
  token: string
  refreshToken: string
  user: { id: string; maSo: string; hoTen: string; role: string; [k: string]: unknown }
}

export async function login(dinhDanh: string, matKhau = 'demo1234'): Promise<Session> {
  const res = await api().post('/api/v1/auth/login').send({ dinhDanh, matKhau })
  if (res.status !== 200) {
    throw new Error(`Đăng nhập thất bại (${res.status}): ${JSON.stringify(res.body)}`)
  }
  return res.body.data as Session
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })
export const idemKey = () => randomUUID()

/* ---------------------- Truy vấn dữ liệu mẫu ---------------------- */

export async function twoStudents() {
  const rows = await prisma.student.findMany({
    include: { user: true, class: true },
    orderBy: { createdAt: 'asc' },
    take: 2,
  })
  if (rows.length < 2) throw new Error('Cần ít nhất hai sinh viên trong dữ liệu mẫu.')
  return rows
}

/** Loại đơn đang hoạt động và có luồng duyệt (ưu tiên loại có bước ký OTP). */
export async function pickRequestTypeId(preferOtp = false): Promise<string> {
  const types = await prisma.requestType.findMany({
    where: { hoatDong: true, deletedAt: null, workflowId: { not: null } },
    include: { workflow: { include: { steps: true } } },
    orderBy: { ma: 'asc' },
  })
  const usable = types.filter((t) => (t.workflow?.steps.length ?? 0) > 0)
  if (!usable.length) throw new Error('Không có loại đơn nào gắn luồng duyệt trong dữ liệu mẫu.')
  if (preferOtp) {
    const withOtp = usable.find((t) => t.workflow?.steps.some((s) => s.mode === 'OTP'))
    if (withOtp) return withOtp.id
  }
  return usable[0]!.id
}

/** Người dùng phù hợp để xử lý một vai trò đối với hồ sơ của sinh viên đã cho. */
export async function userForRole(studentUserId: string, role: string) {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId },
    include: {
      class: { include: { coVan: true, faculty: { include: { truongKhoa: true } } } },
    },
  })
  switch (role) {
    case 'CO_VAN':
      return student?.class?.coVan ?? null
    case 'TRUONG_KHOA':
      return student?.class?.faculty?.truongKhoa ?? null
    default:
      return prisma.user.findFirst({
        where: { role: role as never, deletedAt: null, trangThai: 'ACTIVE' },
        orderBy: { maSo: 'asc' },
      })
  }
}

/* ---------------------- Dựng dữ liệu biểu mẫu ---------------------- */

export interface RequestTypeLike {
  id: string
  formFields: Array<{ key: string; type: string; required: boolean; readOnly: boolean; options?: unknown }>
  giayTo: Array<{ key: string; batBuoc: boolean }>
}

export function fieldValue(field: { type: string; options?: unknown }): unknown {
  switch (field.type) {
    case 'checkbox':
      return true
    case 'number':
      return 1
    case 'date':
      return '2026-01-05'
    case 'email':
      return 'kiemthu@tbu.edu.vn'
    case 'phone':
      return '0912345678'
    case 'select':
    case 'radio': {
      const options = Array.isArray(field.options) ? field.options : []
      const first = options[0]
      if (typeof first === 'string') return first
      if (first && typeof first === 'object' && 'value' in first) {
        return (first as { value: unknown }).value
      }
      return 'Kiểm thử'
    }
    default:
      return 'Kiểm thử'
  }
}

export function buildDraftBody(rt: RequestTypeLike) {
  const duLieu: Record<string, unknown> = {}
  for (const f of rt.formFields) {
    if (!f.required || f.readOnly || f.type === 'upload') continue
    duLieu[f.key] = fieldValue(f)
  }
  const tepDinhKem = rt.giayTo
    .filter((g) => g.batBuoc)
    .map((g) => ({
      ten: `giay-to-${g.key}.pdf`,
      loai: 'application/pdf',
      kichThuoc: 2048,
      requirementKey: g.key,
    }))
  return { requestTypeId: rt.id, duLieu, tepDinhKem }
}

export async function fetchRequestType(id: string): Promise<RequestTypeLike> {
  const res = await api().get(`/api/v1/request-types/${id}`).set(bearer((await login('admin')).token))
  if (res.status !== 200) throw new Error(`Không lấy được loại đơn: ${JSON.stringify(res.body)}`)
  return res.body.data as RequestTypeLike
}

/* ------------------------- Tạo / dọn hồ sơ ------------------------- */

const created: string[] = []

export function trackApplication(maHoSo: string): string {
  created.push(maHoSo)
  return maHoSo
}

export async function cleanupTracked(): Promise<void> {
  if (!created.length) return
  const list = [...created]
  created.length = 0
  await prisma.notification.deleteMany({ where: { maHoSo: { in: list } } })
  // applications cascade: attachments, step_instances, approvals, signatures, otp_challenges, signed_documents
  await prisma.application.deleteMany({ where: { maHoSo: { in: list } } })
}

export async function createDraft(session: Session, requestTypeId: string) {
  const rt = await fetchRequestType(requestTypeId)
  const res = await api()
    .post('/api/v1/applications')
    .set(bearer(session.token))
    .set('Idempotency-Key', idemKey())
    .send(buildDraftBody(rt))
  if (res.status !== 201) {
    throw new Error(`Tạo hồ sơ nháp thất bại (${res.status}): ${JSON.stringify(res.body)}`)
  }
  trackApplication(res.body.data.maHoSo)
  return res.body.data as { id: string; maHoSo: string }
}

export async function submit(session: Session, maHoSo: string) {
  const res = await api()
    .post(`/api/v1/applications/${maHoSo}/submit`)
    .set(bearer(session.token))
    .set('Idempotency-Key', idemKey())
    .send({})
  if (res.status !== 200) {
    throw new Error(`Nộp hồ sơ thất bại (${res.status}): ${JSON.stringify(res.body)}`)
  }
  return res.body.data
}

export async function currentStepOf(maHoSo: string) {
  const appRow = await prisma.application.findUnique({
    where: { maHoSo },
    include: { stepInstances: true },
  })
  if (!appRow) throw new Error(`Không tìm thấy hồ sơ ${maHoSo}`)
  const step = appRow.stepInstances.find((s) => s.stepOrder === appRow.currentStepOrder) ?? null
  return { app: appRow, step }
}

/** Duyệt hồ sơ qua từng bước cho tới khi hoàn thành (tự xử lý bước ký OTP). */
export async function driveToCompletion(maHoSo: string, studentUserId: string) {
  for (let i = 0; i < 10; i += 1) {
    const { app: appRow, step } = await currentStepOf(maHoSo)
    if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(appRow.trangThai)) return appRow
    if (!step) {
      throw new Error(`Hồ sơ ${maHoSo} không có bước hiện tại (${appRow.trangThai})`)
    }
    const approver = await userForRole(studentUserId, step.role)
    if (!approver) throw new Error(`Không tìm được người dùng vai trò ${step.role}.`)
    const session = await login(approver.maSo)

    const payload: Record<string, unknown> = { ghiChu: 'Duyệt tự động trong kiểm thử.' }
    if (step.mode === 'OTP') {
      const sendRes = await api()
        .post('/api/v1/otp/send')
        .set(bearer(session.token))
        .send({ maHoSo })
      if (sendRes.status !== 200) throw new Error(`Gửi OTP thất bại: ${JSON.stringify(sendRes.body)}`)
      payload.challengeId = sendRes.body.data.challengeId
      payload.otp = sendRes.body.data.devOtp
    }

    const res = await api()
      .post(`/api/v1/approvals/${maHoSo}/approve`)
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send(payload)
    if (res.status !== 200) {
      throw new Error(`Duyệt bước ${step.stepOrder} thất bại: ${JSON.stringify(res.body)}`)
    }
  }
  throw new Error('Hồ sơ chưa hoàn tất sau 10 bước.')
}
