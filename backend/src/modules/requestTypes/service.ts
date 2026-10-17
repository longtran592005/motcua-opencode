import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { recordAudit } from '../../lib/audit'
import { requestTypeDto } from '../shared/dto'
import type { Ctx } from '../applications/service'

export const requestTypeInclude = {
  formFields: { orderBy: { order: 'asc' as const } },
  requiredDocs: true,
} satisfies Prisma.RequestTypeInclude

export type RequestTypeWithChildren = Prisma.RequestTypeGetPayload<{
  include: typeof requestTypeInclude
}>

export interface FormFieldInput {
  key: string
  label: string
  type: string
  placeholder?: string
  helpText?: string
  required?: boolean
  options?: unknown
  defaultValue?: unknown
  min?: number
  max?: number
  rows?: number
  accept?: string
  maxSizeMb?: number
  width?: string
  order?: number
  readOnly?: boolean
}

export interface RequiredDocInput {
  key: string
  label: string
  batBuoc?: boolean
  accept?: string
  helpText?: string
}

export interface RequestTypeInput {
  ma?: string
  ten?: string
  nhom?: string
  moTa?: string
  icon?: string
  mau?: string
  formFields?: FormFieldInput[]
  giayTo?: RequiredDocInput[]
  workflowId?: string | null
  templateId?: string | null
  soNgayXuLy?: number
  lePhi?: number
  hoatDong?: boolean
}

/** Tìm loại đơn theo MÃ hoặc UUID (quyết định B1). */
export async function loadRequestType(idOrMa: string): Promise<RequestTypeWithChildren> {
  const row = await prisma.requestType.findFirst({
    where: { ...(isUuid(idOrMa) ? { id: idOrMa } : { ma: idOrMa }), deletedAt: null },
    include: requestTypeInclude,
  })
  if (!row) throw AppError.notFound('Không tìm thấy loại đơn.')
  return row
}

/** Quy đổi mã/UUID của luồng duyệt và mẫu văn bản sang UUID (chấp nhận cả hai). */
async function resolveWorkflowId(
  value: string | null | undefined,
): Promise<string | null | undefined> {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const wf = await prisma.workflow.findFirst({
    where: isUuid(value)
      ? { id: value, deletedAt: null }
      : { ma: value, deletedAt: null, hoatDong: true },
    select: { id: true },
  })
  if (!wf) throw AppError.notFound(`Không tìm thấy luồng duyệt "${value}".`)
  return wf.id
}

async function resolveTemplateId(
  value: string | null | undefined,
): Promise<string | null | undefined> {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const tpl = await prisma.documentTemplate.findFirst({
    where: isUuid(value) ? { id: value, deletedAt: null } : { ma: value, deletedAt: null },
    select: { id: true },
  })
  if (!tpl) throw AppError.notFound(`Không tìm thấy mẫu văn bản "${value}".`)
  return tpl.id
}

function fieldRows(requestTypeId: string, fields: FormFieldInput[]) {
  const keys = fields.map((f) => f.key)
  if (new Set(keys).size !== keys.length) {
    throw AppError.validation('Khoá trường biểu mẫu bị trùng.', { trung: keys.filter((k, i) => keys.indexOf(k) !== i) })
  }
  return fields.map((f, i) => ({
    requestTypeId,
    key: f.key,
    label: f.label,
    type: f.type as never,
    placeholder: f.placeholder ?? null,
    helpText: f.helpText ?? null,
    required: f.required ?? false,
    options: (f.options ?? null) as Prisma.InputJsonValue,
    defaultValue: (f.defaultValue ?? null) as Prisma.InputJsonValue,
    min: f.min ?? null,
    max: f.max ?? null,
    rows: f.rows ?? null,
    accept: f.accept ?? null,
    maxSizeMb: f.maxSizeMb ?? null,
    width: f.width ?? null,
    order: f.order ?? i + 1,
    readOnly: f.readOnly ?? false,
  }))
}

function docRows(requestTypeId: string, docs: RequiredDocInput[]) {
  const keys = docs.map((d) => d.key)
  if (new Set(keys).size !== keys.length) {
    throw AppError.validation('Khoá giấy tờ yêu cầu bị trùng.')
  }
  return docs.map((d) => ({
    requestTypeId,
    key: d.key,
    label: d.label,
    batBuoc: d.batBuoc ?? true,
    accept: d.accept ?? null,
    helpText: d.helpText ?? null,
  }))
}

export async function createRequestType(ctx: Ctx, input: RequestTypeInput) {
  if (!input.ma?.trim()) throw AppError.validation('Thiếu mã loại đơn.')
  if (!input.ten?.trim()) throw AppError.validation('Thiếu tên loại đơn.')
  if (!input.nhom?.trim()) throw AppError.validation('Thiếu nhóm loại đơn.')
  const ma = input.ma.trim()

  const trung = await prisma.requestType.findFirst({ where: { ma }, select: { id: true } })
  if (trung) throw new AppError('DUPLICATE_ACTION', `Mã loại đơn "${ma}" đã tồn tại.`)

  const workflowId = await resolveWorkflowId(input.workflowId)
  const templateId = await resolveTemplateId(input.templateId)

  const created = await prisma.$transaction(async (tx) => {
    const rt = await tx.requestType.create({
      data: {
        ma,
        ten: input.ten!.trim(),
        nhom: input.nhom!.trim(),
        moTa: input.moTa?.trim() ?? '',
        icon: input.icon?.trim() || 'FileText',
        mau: input.mau?.trim() || 'brand',
        workflowId: workflowId ?? null,
        templateId: templateId ?? null,
        soNgayXuLy: input.soNgayXuLy ?? 3,
        lePhi: input.lePhi ?? 0,
        hoatDong: input.hoatDong ?? true,
      },
    })
    const fields = input.formFields ?? []
    if (fields.length) await tx.requestTypeField.createMany({ data: fieldRows(rt.id, fields) })
    const docs = input.giayTo ?? []
    if (docs.length) await tx.requiredDocument.createMany({ data: docRows(rt.id, docs) })
    return tx.requestType.findUniqueOrThrow({ where: { id: rt.id }, include: requestTypeInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'CREATE_REQUEST_TYPE',
    doiTuong: 'Loại đơn',
    doiTuongId: created.ma,
    giaTriSau: `Tạo loại đơn ${created.ma}`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return requestTypeDto(created)
}

/**
 * Cập nhật loại đơn. Biểu mẫu/giấy tờ được THAY THẾ toàn bộ khi có gửi lên.
 * Hồ sơ đã nộp giữ nguyên dữ liệu đã nhập nên thay đổi chỉ ảnh hưởng hồ sơ MỚI.
 */
export async function updateRequestType(ctx: Ctx, idOrMa: string, input: RequestTypeInput) {
  const target = await loadRequestType(idOrMa)
  const workflowId = await resolveWorkflowId(input.workflowId)
  const templateId = await resolveTemplateId(input.templateId)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.requestType.update({
      where: { id: target.id },
      data: {
        ...(input.ma ? { ma: input.ma.trim() } : {}),
        ...(input.ten ? { ten: input.ten.trim() } : {}),
        ...(input.nhom ? { nhom: input.nhom.trim() } : {}),
        ...(input.moTa !== undefined ? { moTa: input.moTa.trim() } : {}),
        ...(input.icon ? { icon: input.icon.trim() } : {}),
        ...(input.mau ? { mau: input.mau.trim() } : {}),
        ...(workflowId !== undefined ? { workflowId } : {}),
        ...(templateId !== undefined ? { templateId } : {}),
        ...(input.soNgayXuLy !== undefined ? { soNgayXuLy: input.soNgayXuLy } : {}),
        ...(input.lePhi !== undefined ? { lePhi: input.lePhi } : {}),
        ...(input.hoatDong !== undefined ? { hoatDong: input.hoatDong } : {}),
      },
    })
    if (input.formFields) {
      await tx.requestTypeField.deleteMany({ where: { requestTypeId: target.id } })
      if (input.formFields.length) {
        await tx.requestTypeField.createMany({ data: fieldRows(target.id, input.formFields) })
      }
    }
    if (input.giayTo) {
      await tx.requiredDocument.deleteMany({ where: { requestTypeId: target.id } })
      if (input.giayTo.length) {
        await tx.requiredDocument.createMany({ data: docRows(target.id, input.giayTo) })
      }
    }
    return tx.requestType.findUniqueOrThrow({ where: { id: target.id }, include: requestTypeInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'UPDATE_REQUEST_TYPE',
    doiTuong: 'Loại đơn',
    doiTuongId: updated.ma,
    giaTriTruoc: target.ten,
    giaTriSau: updated.ten,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return requestTypeDto(updated)
}

/** Xoá mềm loại đơn — từ chối nếu còn hồ sơ đang xử lý (chưa kết thúc). */
export async function deleteRequestType(ctx: Ctx, idOrMa: string): Promise<void> {
  const target = await loadRequestType(idOrMa)
  const dangXuLy = await prisma.application.count({
    where: {
      requestTypeId: target.id,
      deletedAt: null,
      trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'] },
    },
  })
  if (dangXuLy > 0) {
    throw AppError.invalidTransition(
      `Không thể xoá: còn ${dangXuLy} hồ sơ đang xử lý theo loại đơn này.`,
    )
  }

  await prisma.requestType.update({
    where: { id: target.id },
    data: { deletedAt: new Date(), hoatDong: false },
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'DELETE_REQUEST_TYPE',
    doiTuong: 'Loại đơn',
    doiTuongId: target.ma,
    giaTriTruoc: 'Đang hoạt động',
    giaTriSau: 'Đã xoá',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
}
