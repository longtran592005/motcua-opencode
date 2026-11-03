import { createHash, randomUUID } from 'node:crypto'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { takeCapturedOtp } from '../src/modules/otp/channel'
import { readPdf } from '../src/modules/documents/pdf'

type Json = Record<string, any>
const results: Array<{ step: string; ok: boolean; detail: string }> = []
const mark = (step: string, ok: boolean, detail: string) => {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}\t${step}\t${detail}`)
  if (!ok) process.exitCode = 1
}

async function request(base: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) as Json : {} }
}

async function login(base: string, maSo: string): Promise<{ token: string; user: Json }> {
  const result = await request(base, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ dinhDanh: maSo, matKhau: 'demo1234' }),
  })
  if (result.status !== 200) throw new Error(`login ${maSo}: ${JSON.stringify(result.body)}`)
  return result.body.data
}

const server = createApp().listen(0)
try {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Không lấy được cổng smoke.')
  const base = `http://127.0.0.1:${address.port}`

  const student = await prisma.user.findFirstOrThrow({ where: { maSo: '20211234' } })
  const otherStudent = await prisma.user.findFirstOrThrow({
    where: { role: 'SINH_VIEN', id: { not: student.id }, deletedAt: null },
  })
  const admin = await login(base, 'ADMIN')
  const suffix = Date.now().toString(36).toUpperCase()
  const workflow = await request(base, '/api/v1/workflows', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + admin.token, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      ma: `WF-SMOKE-${suffix}`,
      ten: `Luồng smoke ${suffix}`,
      steps: [
        { order: 1, ten: 'Cố vấn', role: 'CO_VAN', mode: 'ONE_CLICK', slaHours: 48, allowReject: true, allowSupplement: true },
        { order: 2, ten: 'Trưởng khoa', role: 'TRUONG_KHOA', mode: 'OTP', slaHours: 48, allowReject: true, allowSupplement: true },
        { order: 3, ten: 'Phòng Đào tạo', role: 'PHONG_DAO_TAO', mode: 'OTP', slaHours: 48, allowReject: true, allowSupplement: true },
      ],
    }),
  })
  if (workflow.status !== 201) throw new Error(`Tạo workflow smoke: ${JSON.stringify(workflow.body)}`)
  const requestTypeCreated = await request(base, '/api/v1/request-types', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + admin.token, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({
      ma: `RT-SMOKE-${suffix}`,
      ten: `Loại đơn smoke ${suffix}`,
      nhom: 'Smoke',
      moTa: 'Loại đơn tạm cho smoke test.',
      icon: 'FileText',
      mau: 'brand',
      workflowId: workflow.body.data.ma,
      soNgayXuLy: 5,
      lePhi: 0,
      formFields: [{ key: 'lyDo', label: 'Lý do', type: 'textarea', required: true, order: 1 }],
      giayTo: [{ key: 'cccd', label: 'CCCD', batBuoc: true }],
    }),
  })
  if (requestTypeCreated.status !== 201) {
    throw new Error(`Tạo request type smoke: ${JSON.stringify(requestTypeCreated.body)}`)
  }
  const requestType = await prisma.requestType.findUniqueOrThrow({
    where: { id: requestTypeCreated.body.data.id },
    include: { formFields: true, requiredDocs: true, workflow: { include: { steps: true } } },
  })
  const threeLevel = requestType.workflow?.steps.length === 3
  mark('chọn loại đơn 3 cấp', threeLevel, `${requestType.ma} (${requestType.workflow?.steps.length ?? 0} cấp)`)
  if (!threeLevel) throw new Error('Seed không có loại đơn 3 cấp.')

  const sv = await login(base, student.maSo)
  const rtList = await request(base, '/api/v1/request-types?hoatDong=true', {
    headers: { Authorization: 'Bearer ' + sv.token },
  })
  mark('frontend contract loại đơn', rtList.status === 200 && Array.isArray(rtList.body.data), `HTTP ${rtList.status}`)

  const duLieu: Record<string, unknown> = {}
  for (const field of requestType.formFields) {
    if (field.required && !field.readOnly && field.type !== 'upload') duLieu[field.key] = 'Smoke kiểm thử'
  }
  const tepDinhKem = requestType.requiredDocs.filter((item) => item.batBuoc).map((item) => ({
    ten: `${item.key}.pdf`,
    loai: 'application/pdf',
    kichThuoc: 2048,
    requirementKey: item.key,
  }))
  const draft = await request(base, '/api/v1/applications', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + sv.token, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ requestTypeId: requestType.id, duLieu, tepDinhKem }),
  })
  mark('sinh viên tạo đơn', draft.status === 201, `HTTP ${draft.status}`)
  const maHoSo = draft.body.data.maHoSo as string
  const submitted = await request(base, `/api/v1/applications/${maHoSo}/submit`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + sv.token, 'Idempotency-Key': randomUUID() },
    body: '{}',
  })
  mark('sinh viên nộp đơn', submitted.status === 200, `HTTP ${submitted.status}`)

  for (const step of requestType.workflow!.steps.sort((a, b) => a.order - b.order)) {
    const maSo = step.role === 'CO_VAN' ? 'CV001' : step.role === 'TRUONG_KHOA' ? 'TK001' : 'PDT001'
    const approver = await login(base, maSo)
    const payload: Json = { ghiChu: 'Smoke duyệt thật' }
    if (step.mode === 'OTP') {
      const sent = await request(base, '/api/v1/otp/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + approver.token },
        body: JSON.stringify({ maHoSo }),
      })
      if (sent.status !== 200) throw new Error(`otp ${step.order}: ${JSON.stringify(sent.body)}`)
      payload.challengeId = sent.body.data.challengeId
      payload.otp = takeCapturedOtp(payload.challengeId)
      if (!payload.otp) throw new Error(`OTP không được capture ở bước ${step.order}`)
    }
    const approved = await request(base, `/api/v1/approvals/${maHoSo}/approve`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + approver.token, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(payload),
    })
    mark(`duyệt cấp ${step.order} ${step.role}`, approved.status === 200, `HTTP ${approved.status}`)
  }

  const completed = await prisma.application.findUniqueOrThrow({
    where: { maHoSo },
    include: { document: true },
  })
  mark('hồ sơ COMPLETED', completed.trangThai === 'COMPLETED', completed.trangThai)
  if (!completed.document?.pdfStorageKey) throw new Error('Thiếu PDF sau khi hoàn tất.')
  const pdf = await readPdf(completed.document.pdfStorageKey)
  const hash = createHash('sha256').update(pdf).digest('hex')
  mark('PDF tồn tại và hash khớp', hash === completed.document.maBamSha256, completed.document.pdfStorageKey)

  const verified = await request(base, `/api/v1/public/verify/token/${completed.document.tokenXacThuc}`)
  mark('verify công khai HỢP LỆ', verified.status === 200 && verified.body.data?.trangThai === 'VALID', `HTTP ${verified.status}`)

  const revoked = await request(base, `/api/v1/documents/${completed.document.id}/revoke`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + admin.token, 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ lyDo: 'Smoke thu hồi' }),
  })
  mark('Admin thu hồi văn bản', revoked.status === 200, `HTTP ${revoked.status}`)
  const revokedVerify = await request(base, `/api/v1/public/verify/token/${completed.document.tokenXacThuc}`)
  mark('verify báo ĐÃ THU HỒI', revokedVerify.status === 200 && revokedVerify.body.data?.trangThai === 'REVOKED', `HTTP ${revokedVerify.status}`)

  const other = await login(base, otherStudent.maSo)
  const idor = await request(base, `/api/v1/applications/${maHoSo}`, {
    headers: { Authorization: 'Bearer ' + other.token },
  })
  mark('IDOR sinh viên khác bị chặn', idor.status === 403, `HTTP ${idor.status}`)

  const orphanSteps = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT si.id FROM step_instances si
    LEFT JOIN applications a ON a.id = si.application_id
    WHERE a.id IS NULL LIMIT 1
  `
  mark('check-integrity không có step mồ côi', orphanSteps.length === 0, `${orphanSteps.length} vi phạm`)
} catch (error) {
  mark('smoke tổng', false, error instanceof Error ? error.message : String(error))
} finally {
  await prisma.$disconnect()
  server.close()
}

if (results.some((result) => !result.ok)) process.exitCode = 1
