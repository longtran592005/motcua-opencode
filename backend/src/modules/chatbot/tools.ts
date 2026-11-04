/**
 * Công cụ cho mô hình (Q5): CHỈ ĐỌC hoặc ĐỀ XUẤT — KHÔNG ghi dữ liệu.
 * - Danh tính người dùng LUÔN lấy từ token đăng nhập (ctx.user), KHÔNG nhận
 *   bất kỳ tham số userId nào từ mô hình.
 * - Đơn của người khác trả như không tồn tại (chống IDOR).
 * - Kết quả gửi cho mô hình chỉ gồm mã hồ sơ, tên loại đơn, trạng thái, bước
 *   hiện tại, ngày — KHÔNG có họ tên, MSSV, nội dung đơn, tệp.
 */
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { keywords, normalizeText } from './vietnamese'

export interface ToolCtx {
  /** Thông tin người dùng từ token đăng nhập (đã lấy từ token trước khi gọi). */
  user: { id: string; role: string; hoTen: string; maSo: string }
}

const SV_ONLY = 'Chức năng tra cứu đơn chỉ dành cho sinh viên.'

function ensureStudent(ctx: ToolCtx): string | null {
  return ctx.user.role === 'SINH_VIEN' ? null : SV_ONLY
}

interface ApplicationBrief {
  maHoSo: string
  tenLoaiDon: string
  trangThai: string
  buocHienTai: string
  ngayTao: string
}

function brief(r: {
  maHoSo: string
  trangThai: string
  currentStepOrder: number
  tongSoBuoc: number
  createdAt: Date
  requestType: { ten: string }
}): ApplicationBrief {
  return {
    maHoSo: r.maHoSo,
    tenLoaiDon: r.requestType.ten,
    trangThai: r.trangThai,
    buocHienTai:
      r.trangThai === 'DRAFT'
        ? 'bản nháp chưa nộp'
        : r.trangThai === 'COMPLETED'
          ? 'đã hoàn tất'
          : `bước ${r.currentStepOrder}/${Math.max(r.tongSoBuoc, r.currentStepOrder)}`,
    ngayTao: r.createdAt.toISOString().slice(0, 10),
  }
}

/* ---------------- get_my_applications ---------------- */

export const myApplicationsInput = z.object({
  trangThai: z
    .enum(['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT', 'REJECTED', 'COMPLETED', 'CANCELLED'])
    .optional(),
})

export async function get_my_applications(
  input: unknown,
  ctx: ToolCtx,
): Promise<{ danhSach: ApplicationBrief[] } | { error: string }> {
  const blocked = ensureStudent(ctx)
  if (blocked) return { error: SV_ONLY }
  const args = myApplicationsInput.parse(input ?? {})
  const rows = await prisma.application.findMany({
    where: {
      applicantId: ctx.user.id,
      deletedAt: null,
      ...(args.trangThai ? { trangThai: args.trangThai } : {}),
    },
    select: {
      maHoSo: true,
      trangThai: true,
      currentStepOrder: true,
      tongSoBuoc: true,
      createdAt: true,
      requestType: { select: { ten: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  return { danhSach: rows.map(brief) }
}

/* ---------------- get_application_status ---------------- */

export const applicationStatusInput = z.object({ maHoSo: z.string().trim().min(4).max(40) })

export async function get_application_status(
  input: unknown,
  ctx: ToolCtx,
): Promise<{ hoSo: ApplicationBrief } | { error: string }> {
  const blocked = ensureStudent(ctx)
  if (blocked) return { error: SV_ONLY }
  const args = applicationStatusInput.parse(input ?? {})
  const row = await prisma.application.findFirst({
    // Ownership từ token: applicantId = user hiện tại. Đơn người khác → null.
    where: { applicantId: ctx.user.id, deletedAt: null, maHoSo: args.maHoSo.toUpperCase() },
    select: {
      maHoSo: true,
      trangThai: true,
      currentStepOrder: true,
      tongSoBuoc: true,
      createdAt: true,
      requestType: { select: { ten: true } },
    },
  })
  if (!row) return { error: 'Không tìm thấy hồ sơ với mã này trong danh sách đơn của bạn.' }
  return { hoSo: brief(row) }
}

/* ---------------- suggest_request_types ---------------- */

export const suggestTypesInput = z.object({ moTa: z.string().trim().min(2).max(500) })

export interface SuggestedType {
  maLoaiDon: string
  ten: string
  lyDo: string
}

/** Đề xuất kiểu đề xuất: chỉ được gọi cho SINH_VIEN nhưng không bắt buộc. */
export async function suggest_request_types(
  input: unknown,
): Promise<{ goiY: SuggestedType[] }> {
  const args = suggestTypesInput.parse(input ?? {})
  const types = await prisma.requestType.findMany({
    where: { hoatDong: true, deletedAt: null },
    select: { ma: true, ten: true, moTa: true },
  })
  const qTokens = new Set(keywords(args.moTa))
  const scored = types.map((t) => {
    const nName = normalizeText(t.ten).split(/[^a-z0-9]+/)
    const nDesc = normalizeText(t.moTa).split(/[^a-z0-9]+/)
    let hitsName = 0
    let hitsDesc = 0
    for (const q of qTokens) {
      if (nName.includes(q)) hitsName += 1
      if (nDesc.includes(q)) hitsDesc += 1
    }
    const score = hitsName * 2 + hitsDesc
    let lyDo = 'tên loại đơn khớp với yêu cầu của bạn'
    if (hitsName && !hitsDesc) lyDo = 'tên loại đơn khớp với yêu cầu của bạn'
    else if (!hitsName && hitsDesc) lyDo = 'mô tả loại đơn khớp với yêu cầu của bạn'
    else lyDo = 'cả tên và mô tả loại đơn đều khớp với yêu cầu của bạn'
    return { ma: t.ma, ten: t.ten, score, lyDo }
  })
  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  return {
    goiY: top.map((t) => ({
      maLoaiDon: t.ma,
      ten: t.ten,
      lyDo: t.lyDo,
    })),
  }
}

/* ---------------- propose_draft ---------------- */

export const proposeDraftInput = z.object({
  maLoiDon: z.string().trim().min(1).max(64),
  truong: z.record(z.string().max(2000)).default({}),
})

export interface DraftFieldInfo {
  /** Khóa trường trong biểu mẫu (dùng khi tạo bản nháp). */
  ten: string
  nhan: string
  kieu: string
  batBuoc: boolean
  giaTriGoiY: string
}

export interface DraftProposal {
  maLoiDon: string
  tenLoaiDon: string
  cacTruong: DraftFieldInfo[]
  canhBao: string[]
}

/**
 * Đề xuất bản nháp (KHÔNG tạo bản ghi):
 * - Chỉ nhận trường nằm trong request_type_fields (loại trường lạ).
 * - Các trường do sinh viên tự điền khi nộp thường — chỉ mang giá trị người
 *   dùng đã cung cấp trong cuộc hội thoại.
 */
export async function propose_draft(
  input: unknown,
  ctx: ToolCtx,
): Promise<{ deXuat: DraftProposal } | { error: string }> {
  const blocked = ensureStudent(ctx)
  if (blocked) return { error: SV_ONLY }
  const args = proposeDraftInput.parse(input ?? {})
    const rt = await prisma.requestType.findFirst({
    where: { ma: args.maLoiDon, hoatDong: true, deletedAt: null },
    select: { id: true, ma: true, ten: true, formFields: { select: { key: true, label: true, type: true, required: true } } },
  })
  if (!rt) return { error: `Không có loại đơn với mã "${args.maLoiDon}".` }

  const fieldKeys = new Set(rt.formFields.map((f) => f.key))
  const canhBao: string[] = []
  const cacTruong: DraftFieldInfo[] = []
  for (const f of rt.formFields) {
    cacTruong.push({ ten: f.key, nhan: f.label, kieu: f.type, batBuoc: f.required, giaTriGoiY: '' })
  }
  for (const [key, value] of Object.entries(args.truong)) {
    if (!fieldKeys.has(key)) {
      canhBao.push(`Bỏ trường lạ: "${key}"`)
      continue
    }
    const matched = cacTruong.find((f) => f.ten === key)
    if (matched) matched.giaTriGoiY = String(value)
  }
  return {
    deXuat: {
      maLoiDon: rt.ma,
      tenLoaiDon: rt.ten,
      cacTruong,
      canhBao,
    },
  }
}

/** Trường lạ => loại bỏ; dùng cho orchestrator dựng action DRAFT_PROPOSAL. */
export const TOOL_DEFS = {
  get_my_applications: { input: myApplicationsInput },
  get_application_status: { input: applicationStatusInput },
  suggest_request_types: { input: suggestTypesInput },
  propose_draft: { input: proposeDraftInput },
} as const
