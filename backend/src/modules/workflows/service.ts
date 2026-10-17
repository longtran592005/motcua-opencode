import type { ApprovalMode, Prisma, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { recordAudit } from '../../lib/audit'
import { workflowDto } from '../shared/dto'
import type { Ctx } from '../applications/service'

export const workflowInclude = {
  steps: { orderBy: { order: 'asc' as const } },
  requestTypes: { select: { id: true, ma: true } },
} satisfies Prisma.WorkflowInclude

export type WorkflowWithSteps = Prisma.WorkflowGetPayload<{ include: typeof workflowInclude }>

export const TOI_DA_CAP_DUYET = 3

export interface WorkflowStepInput {
  order?: number
  ten: string
  role: Role
  mode: ApprovalMode
  slaHours: number
  nhacTruocGio?: number
  leoThangSauGio?: number
  escalateTo?: Role | null
  allowReject: boolean
  allowSupplement: boolean
  moTa?: string | null
}

export interface WorkflowInput {
  ma?: string
  ten?: string
  requestTypeIds?: string[]
  steps?: WorkflowStepInput[]
  hoatDong?: boolean
}

export interface KetQuaKiemTra {
  hopLe: boolean
  canhBao: string[]
}

/**
 * Kiểm tra cấu hình luồng duyệt TRƯỚC khi ghi (dùng cho cả POST /validate).
 * `hopLe = false` khi có lỗi chặn; `canhBao` luôn liệt kê mọi vấn đề tìm thấy.
 */
export function kiemTraWorkflow(input: WorkflowInput): KetQuaKiemTra {
  const canhBao: string[] = []
  const steps = input.steps ?? []

  if (!steps.length) canhBao.push('Luồng duyệt phải có ít nhất một bước xử lý.')
  if (steps.length > TOI_DA_CAP_DUYET) {
    canhBao.push(`Tối đa ${TOI_DA_CAP_DUYET} cấp duyệt, hiện có ${steps.length} bước.`)
  }

  const orders = steps.map((s, i) => s.order ?? i + 1)
  if (new Set(orders).size !== orders.length) canhBao.push('Thứ tự các bước bị trùng.')
  const sorted = [...orders].sort((a, b) => a - b)
  if (sorted.some((o, i) => o !== i + 1)) {
    canhBao.push('Thứ tự các bước phải liên tục và bắt đầu từ 1.')
  }

  for (const [i, s] of steps.entries()) {
    if (!s.ten?.trim()) canhBao.push(`Bước ${i + 1} chưa có tên.`)
    if (!(s.slaHours > 0)) canhBao.push(`Bước ${i + 1} phải có thời hạn xử lý lớn hơn 0 giờ.`)
    if (s.nhacTruocGio !== undefined && s.nhacTruocGio < 0) {
      canhBao.push(`Bước ${i + 1} có thời điểm nhắc trước hạn không hợp lệ.`)
    }
    if (s.leoThangSauGio !== undefined && s.leoThangSauGio < 0) {
      canhBao.push(`Bước ${i + 1} có thời điểm leo thang không hợp lệ.`)
    }
    if (s.escalateTo && s.escalateTo === s.role) {
      canhBao.push(`Bước ${i + 1}: vai trò nhận leo thang phải khác vai trò xử lý.`)
    }
  }

  if (steps.length === 1 && steps[0].role === 'SINH_VIEN') {
    canhBao.push('Bước duyệt không thể giao cho sinh viên.')
  }
  for (const [i, s] of steps.entries()) {
    if (s.role === 'SINH_VIEN') canhBao.push(`Bước ${i + 1} không thể giao cho sinh viên.`)
  }

  return { hopLe: canhBao.length === 0, canhBao }
}

function normalizeSteps(steps: WorkflowStepInput[]) {
  return steps.map((s, i) => ({
    order: s.order ?? i + 1,
    ten: s.ten.trim(),
    role: s.role,
    mode: s.mode,
    slaHours: s.slaHours,
    nhacTruocGio: s.nhacTruocGio ?? 12,
    leoThangSauGio: s.leoThangSauGio ?? 24,
    escalateTo: s.escalateTo ?? null,
    allowReject: s.allowReject,
    allowSupplement: s.allowSupplement,
    moTa: s.moTa ?? null,
  }))
}

/**
 * Tìm luồng duyệt: UUID → đúng bản ghi; mã nghiệp vụ → bản đang hoạt động,
 * nếu không có thì bản mới nhất.
 */
export async function loadWorkflow(idOrMa: string): Promise<WorkflowWithSteps> {
  const row = isUuid(idOrMa)
    ? await prisma.workflow.findFirst({
        where: { id: idOrMa, deletedAt: null },
        include: workflowInclude,
      })
    : await prisma.workflow.findFirst({
        where: { ma: idOrMa, deletedAt: null },
        include: workflowInclude,
        orderBy: [{ hoatDong: 'desc' }, { version: 'desc' }],
      })
  if (!row) throw AppError.notFound('Không tìm thấy luồng duyệt.')
  return row
}

export async function listWorkflows() {
  const rows = await prisma.workflow.findMany({
    where: { deletedAt: null },
    include: workflowInclude,
    orderBy: [{ ma: 'asc' }, { version: 'desc' }],
  })
  return rows.map(workflowDto)
}

export async function createWorkflow(ctx: Ctx, input: WorkflowInput) {
  if (!input.ma?.trim()) throw AppError.validation('Thiếu mã luồng duyệt.')
  if (!input.ten?.trim()) throw AppError.validation('Thiếu tên luồng duyệt.')
  const ma = input.ma.trim()

  const check = kiemTraWorkflow(input)
  if (!check.hopLe) {
    throw AppError.validation('Cấu hình luồng duyệt không hợp lệ.', { canhBao: check.canhBao })
  }

  const daCo = await prisma.workflow.findFirst({ where: { ma }, select: { id: true } })
  if (daCo) {
    throw new AppError(
      'DUPLICATE_ACTION',
      `Mã luồng "${ma}" đã tồn tại. Hãy sửa luồng đó để tạo phiên bản mới.`,
    )
  }

  const steps = normalizeSteps(input.steps!)
  const created = await prisma.$transaction(async (tx) => {
    const wf = await tx.workflow.create({
      data: { ma, ten: input.ten!.trim(), capDo: steps.length, hoatDong: input.hoatDong ?? true },
    })
    await tx.workflowStep.createMany({ data: steps.map((s) => ({ ...s, workflowId: wf.id })) })
    if (input.requestTypeIds?.length) {
      await tx.requestType.updateMany({
        where: { id: { in: input.requestTypeIds }, deletedAt: null },
        data: { workflowId: wf.id },
      })
    }
    return tx.workflow.findUniqueOrThrow({ where: { id: wf.id }, include: workflowInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'CREATE_WORKFLOW',
    doiTuong: 'Luồng duyệt',
    doiTuongId: created.ma,
    giaTriSau: `Tạo luồng ${created.ma} phiên bản ${created.version} với ${steps.length} bước`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return workflowDto(created)
}

/**
 * Sửa luồng duyệt = tạo PHIÊN BẢN MỚI cùng mã (version + 1), tắt bản cũ và
 * trỏ lại các loại đơn đang dùng. Hồ sơ đang chạy giữ nguyên ảnh chụp luồng nên
 * không bị ảnh hưởng — chỉ các hồ sơ nộp SAU mới dùng phiên bản mới.
 */
export async function updateWorkflow(ctx: Ctx, idOrMa: string, input: WorkflowInput) {
  const target = await loadWorkflow(idOrMa)
  const moiNhat = await prisma.workflow.findFirst({
    where: { ma: target.ma },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const version = (moiNhat?.version ?? target.version) + 1
  const ma = input.ma?.trim() || target.ma

  if (ma !== target.ma) {
    const trung = await prisma.workflow.findFirst({ where: { ma }, select: { id: true } })
    if (trung) throw new AppError('DUPLICATE_ACTION', `Mã luồng "${ma}" đã tồn tại.`)
  }

  const steps = input.steps
    ? normalizeSteps(input.steps)
    : normalizeSteps(
        target.steps.map((s) => ({
          order: s.order,
          ten: s.ten,
          role: s.role,
          mode: s.mode,
          slaHours: s.slaHours,
          nhacTruocGio: s.nhacTruocGio,
          leoThangSauGio: s.leoThangSauGio,
          escalateTo: s.escalateTo,
          allowReject: s.allowReject,
          allowSupplement: s.allowSupplement,
          moTa: s.moTa,
        })),
      )

  const check = kiemTraWorkflow({ ...input, steps })
  if (!check.hopLe) {
    throw AppError.validation('Cấu hình luồng duyệt không hợp lệ.', { canhBao: check.canhBao })
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.workflow.updateMany({
      where: { ma: target.ma, deletedAt: null },
      data: { hoatDong: false },
    })
    const wf = await tx.workflow.create({
      data: {
        ma,
        ten: input.ten?.trim() || target.ten,
        version,
        capDo: steps.length,
        hoatDong: input.hoatDong ?? true,
      },
    })
    await tx.workflowStep.createMany({ data: steps.map((s) => ({ ...s, workflowId: wf.id })) })
    // Mọi loại đơn đang trỏ tới bản CŨ được trỏ sang bản MỚI.
    await tx.requestType.updateMany({
      where: { workflowId: target.id },
      data: { workflowId: wf.id },
    })
    if (input.requestTypeIds) {
      await tx.requestType.updateMany({
        where: { id: { in: input.requestTypeIds }, deletedAt: null },
        data: { workflowId: wf.id },
      })
    }
    return tx.workflow.findUniqueOrThrow({ where: { id: wf.id }, include: workflowInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'UPDATE_WORKFLOW',
    doiTuong: 'Luồng duyệt',
    doiTuongId: created.ma,
    giaTriTruoc: `Phiên bản ${target.version}`,
    giaTriSau: `Phiên bản ${created.version} (${steps.length} bước)`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return workflowDto(created)
}

/** Xoá mềm luồng duyệt — từ chối nếu còn loại đơn đang dùng. */
export async function deleteWorkflow(ctx: Ctx, idOrMa: string): Promise<void> {
  const target = await loadWorkflow(idOrMa)
  const dangDung = await prisma.requestType.findMany({
    where: { workflow: { ma: target.ma }, deletedAt: null },
    select: { ma: true, ten: true },
  })
  if (dangDung.length) {
    throw AppError.invalidTransition(
      `Không thể xoá: luồng "${target.ma}" đang được ${dangDung.length} loại đơn sử dụng ` +
        `(${dangDung.map((r) => r.ma).join(', ')}). Hãy chuyển các loại đơn sang luồng khác trước.`,
    )
  }

  await prisma.workflow.updateMany({
    where: { ma: target.ma, deletedAt: null },
    data: { deletedAt: new Date(), hoatDong: false },
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'DELETE_WORKFLOW',
    doiTuong: 'Luồng duyệt',
    doiTuongId: target.ma,
    giaTriTruoc: 'Đang hoạt động',
    giaTriSau: 'Đã xoá',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
}
