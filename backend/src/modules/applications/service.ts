import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid, randomToken } from '../../lib/crypto'
import { assertInScope, scopeWhere, type ScopeUser } from '../../lib/scope'
import { nextMaHoSo } from '../../lib/ids'
import { recordAudit } from '../../lib/audit'
import { notifyRole, pushNotification } from '../../lib/notify'
import type { RequestContext } from '../../lib/context'
import {
  applicationDetailDto,
  applicationDto,
  applicationInclude,
  type ApplicationRow,
} from '../shared/dto'
import { addHours, firstStepOf, pickAssignee } from '../shared/workflow'
import type {
  applicationListQuery,
  createApplicationBody,
  supplementBody,
} from './schemas'

type ListQuery = z.infer<typeof applicationListQuery>
type CreateBody = z.infer<typeof createApplicationBody>
type SupplementBody = z.infer<typeof supplementBody>

export interface Ctx extends RequestContext {
  user: Express.AuthUser
}

/** Tìm hồ sơ theo MÃ CÔNG KHAI (maHoSo) hoặc UUID nội bộ (quyết định B1). */
export async function loadApplication(idOrMa: string): Promise<ApplicationRow> {
  const row = await prisma.application.findFirst({
    where: {
      ...(isUuid(idOrMa) ? { id: idOrMa } : { maHoSo: idOrMa }),
      deletedAt: null,
    },
    include: applicationInclude,
  })
  if (!row) throw AppError.notFound('Không tìm thấy hồ sơ.')
  return row
}

/** Tìm hồ sơ rồi kiểm tra phạm vi TRÊN BẢN GHI vừa tìm được. */
export async function loadApplicationForUser(
  idOrMa: string,
  user: ScopeUser,
): Promise<ApplicationRow> {
  const row = await loadApplication(idOrMa)
  assertInScope(row, user)
  return row
}

/* --------------------------------- Đọc --------------------------------- */

function buildWhere(user: ScopeUser, query: ListQuery): Prisma.ApplicationWhereInput {
  const conditions: Prisma.ApplicationWhereInput[] = [scopeWhere(user)]

  if (query.trangThai && query.trangThai !== 'ALL') conditions.push({ trangThai: query.trangThai })
  if (query.requestTypeId) conditions.push({ requestTypeId: query.requestTypeId })
  if (query.lop) {
    conditions.push(isUuid(query.lop) ? { classId: query.lop } : { class: { ma: query.lop } })
  }
  if (query.khoa) {
    conditions.push(
      isUuid(query.khoa)
        ? { OR: [{ facultyId: query.khoa }, { class: { facultyId: query.khoa } }] }
        : { class: { faculty: { ma: query.khoa } } },
    )
  }
  if (query.tuKhoa) {
    const t = query.tuKhoa
    conditions.push({
      OR: [
        { maHoSo: { contains: t, mode: 'insensitive' } },
        { applicant: { hoTen: { contains: t, mode: 'insensitive' } } },
        { requestType: { ten: { contains: t, mode: 'insensitive' } } },
      ],
    })
  }
  const now = new Date()
  if (query.hanXuLy === 'QUA_HAN') conditions.push({ hanXuLy: { lt: now } })
  if (query.hanXuLy === 'SAP_HET_HAN') {
    conditions.push({ hanXuLy: { gte: now, lte: addHours(now, 24) } })
  }

  return { deletedAt: null, AND: conditions }
}

function orderBy(query: ListQuery): Prisma.ApplicationOrderByWithRelationInput {
  switch (query.sapXep) {
    case 'CU_NHAT':
      return { createdAt: 'asc' }
    case 'HAN_GAN_NHAT':
      return { hanXuLy: 'asc' }
    default:
      return { createdAt: 'desc' }
  }
}

export async function listMine(user: ScopeUser, query: ListQuery) {
  const where = buildWhere(user, query)
  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: orderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(applicationDto), total, page: query.page, pageSize: query.pageSize }
}

/** Danh sách dùng chung cho hộp thư phê duyệt — thêm điều kiện "đang chờ vai trò". */
export async function listScoped(
  user: ScopeUser,
  query: ListQuery,
  extra?: Prisma.ApplicationWhereInput,
) {
  const where: Prisma.ApplicationWhereInput = { ...buildWhere(user, query) }
  if (extra) where.AND = [...(where.AND as Prisma.ApplicationWhereInput[]), extra]
  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: orderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(applicationDto), total, page: query.page, pageSize: query.pageSize }
}

export async function recentMine(user: ScopeUser, limit: number) {
  const rows = await prisma.application.findMany({
    where: { applicantId: user.id, deletedAt: null },
    include: applicationInclude,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(applicationDto)
}

export async function statsMine(user: ScopeUser) {
  const groups = await prisma.application.groupBy({
    by: ['trangThai'],
    where: { applicantId: user.id, deletedAt: null },
    _count: { _all: true },
  })
  const count = (s: string) => groups.find((g) => g.trangThai === s)?._count._all ?? 0
  const tong = groups.reduce((sum, g) => sum + g._count._all, 0)
  return {
    nhap: count('DRAFT'),
    dangXuLy: count('SUBMITTED') + count('PENDING_APPROVAL'),
    canBoSung: count('NEED_SUPPLEMENT'),
    hoanThanh: count('COMPLETED'),
    tong,
  }
}

export async function getByCode(idOrMa: string, user: ScopeUser) {
  const row = await loadApplicationForUser(idOrMa, user)
  return applicationDetailDto(row)
}

export async function nextApproverRoles(idOrMa: string, user: ScopeUser) {
  const row = await loadApplicationForUser(idOrMa, user)
  if (row.trangThai !== 'SUBMITTED' && row.trangThai !== 'PENDING_APPROVAL') return []
  const si = row.stepInstances.find((s) => s.stepOrder === row.currentStepOrder)
  return si ? [si.role] : []
}

export async function allowedRequestTypes() {
  const rows = await prisma.requestType.findMany({
    where: { hoatDong: true, deletedAt: null },
    include: { formFields: { orderBy: { order: 'asc' } }, requiredDocs: true },
    orderBy: { nhom: 'asc' },
  })
  const { requestTypeDto } = await import('../shared/dto')
  return rows.map((r) => requestTypeDto(r))
}

/* ------------------------------ Tạo / sửa ------------------------------ */

function attachmentRows(
  appId: string,
  files: CreateBody['tepDinhKem'],
  nguoiTaiLenId: string,
): Prisma.ApplicationAttachmentCreateManyInput[] {
  return files.map((t) => ({
    applicationId: appId,
    ten: t.ten,
    loai: t.loai,
    kichThuoc: t.kichThuoc,
    // Giai đoạn 5 sẽ thay bằng khóa lưu trữ thật do StorageProvider trả về.
    storageKey: t.id ?? randomToken(16),
    requirementKey: t.requirementKey ?? null,
    nguoiTaiLenId,
  }))
}

async function findRequestType(id: string) {
  const rt = await prisma.requestType.findFirst({ where: { id, deletedAt: null } })
  if (!rt) throw AppError.notFound('Không tìm thấy loại đơn.')
  if (!rt.hoatDong) throw AppError.validation('Loại đơn này đang tạm dừng nhận hồ sơ.')
  return rt
}

export async function createDraft(ctx: Ctx, body: CreateBody) {
  const rt = await findRequestType(body.requestTypeId)
  const student = await prisma.student.findUnique({
    where: { userId: ctx.user.id },
    select: { classId: true, class: { select: { facultyId: true } } },
  })
  if (!student) {
    throw AppError.validation('Chỉ sinh viên có hồ sơ học tập mới tạo được hồ sơ một cửa.')
  }

  const maHoSo = await nextMaHoSo()
  const created = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        maHoSo,
        requestTypeId: rt.id,
        applicantId: ctx.user.id,
        classId: student.classId,
        facultyId: student.class.facultyId,
        workflowId: rt.workflowId ?? null,
        trangThai: 'DRAFT',
        duLieu: body.duLieu as Prisma.InputJsonValue,
      },
    })
    if (body.tepDinhKem.length) {
      await tx.applicationAttachment.createMany({
        data: attachmentRows(app.id, body.tepDinhKem, ctx.user.id),
      })
    }
    return app
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'CREATE_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: created.maHoSo,
    giaTriSau: 'Bản nháp',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDto(await prisma.application.findFirstOrThrow({ where: { id: created.id }, include: applicationInclude }))
}

export async function updateDraft(ctx: Ctx, idOrMa: string, body: CreateBody) {
  const app = await loadApplicationForUser(idOrMa, ctx.user)
  if (app.applicantId !== ctx.user.id) {
    throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
  }
  if (app.trangThai !== 'DRAFT') {
    throw AppError.invalidTransition('Chỉ hồ sơ ở trạng thái bản nháp mới sửa được.')
  }
  const rt = await findRequestType(body.requestTypeId)

  await prisma.$transaction(async (tx) => {
    await tx.applicationAttachment.deleteMany({ where: { applicationId: app.id } })
    await tx.application.update({
      where: { id: app.id },
      data: {
        requestTypeId: rt.id,
        workflowId: rt.workflowId ?? null,
        duLieu: body.duLieu as Prisma.InputJsonValue,
        attachments: { create: attachmentRows(app.id, body.tepDinhKem, ctx.user.id).map(({ applicationId, ...rest }) => { void applicationId; return rest }) },
      },
    })
  })

  return applicationDto(await prisma.application.findFirstOrThrow({ where: { id: app.id }, include: applicationInclude }))
}

export async function deleteDraft(ctx: Ctx, idOrMa: string) {
  const app = await loadApplicationForUser(idOrMa, ctx.user)
  if (app.applicantId !== ctx.user.id) {
    throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
  }
  if (app.trangThai !== 'DRAFT') {
    throw AppError.invalidTransition('Chỉ hồ sơ ở trạng thái bản nháp mới xoá được.')
  }
  await prisma.application.update({ where: { id: app.id }, data: { deletedAt: new Date() } })
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'DELETE_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Bản nháp',
    giaTriSau: 'Đã xoá (xóa mềm)',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
}

/* -------------------------------- Nghiệp vụ ---------------------------- */

function kiemTraBatBuoc(app: ApplicationRow): void {
  const rt = app.requestType
  const duLieu = (app.duLieu ?? {}) as Record<string, unknown>
  const thieu = rt.formFields
    .filter((f) => f.required && !f.readOnly)
    .filter((f) => {
      const v = duLieu[f.key]
      return v === undefined || v === null || v === '' || (f.type === 'checkbox' && v !== true)
    })
    .map((f) => f.label)

  if (thieu.length) {
    throw AppError.validation(
      `Vui lòng hoàn thiện các trường bắt buộc: ${thieu.join(', ')}.`,
      { truongThieu: thieu },
    )
  }

  const keyDaCo = new Set(app.attachments.map((t) => t.requirementKey).filter(Boolean))
  const thieuTep = rt.requiredDocs.filter((g) => g.batBuoc && !keyDaCo.has(g.key))
  if (thieuTep.length) {
    throw new AppError(
      'MISSING_ATTACHMENT',
      `Thiếu giấy tờ bắt buộc: ${thieuTep.map((g) => g.label).join(', ')}.`,
      { giayToThieu: thieuTep.map((g) => g.key) },
    )
  }
}

export async function submit(ctx: Ctx, idOrMa: string) {
  const app = await loadApplicationForUser(idOrMa, ctx.user)
  if (app.applicantId !== ctx.user.id) throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
  if (app.trangThai !== 'DRAFT') {
    throw AppError.invalidTransition('Chỉ hồ sơ ở trạng thái bản nháp mới có thể nộp.')
  }
  if (!app.workflow) throw AppError.validation('Loại đơn chưa được gắn luồng duyệt.')
  const steps = app.workflow.steps
  if (!steps.length) throw AppError.validation('Luồng duyệt chưa có bước xử lý nào.')

  kiemTraBatBuoc(app)

  const first = firstStepOf(steps)!
  const now = new Date()
  const assigneeId = await pickAssignee(first, {
    classId: app.classId,
    facultyId: app.facultyId,
  })

  await prisma.$transaction(async (tx) => {
    await tx.stepInstance.createMany({
      data: steps.map((s) => ({
        applicationId: app.id,
        workflowStepId: s.id,
        stepOrder: s.order,
        ten: s.ten,
        role: s.role,
        mode: s.mode,
        trangThai: s.order === first.order ? 'IN_PROGRESS' : 'PENDING',
        assigneeId: s.order === first.order ? assigneeId : null,
        startedAt: s.order === first.order ? now : null,
        slaDueAt: s.order === first.order ? addHours(now, s.slaHours) : null,
      })),
    })
    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'SUBMITTED',
        workflowId: app.workflowId,
        workflowVersion: app.workflow!.version,
        currentStepOrder: first.order,
        tongSoBuoc: steps.length,
        buocDaDuyet: 0,
        ngayNop: now,
        hanXuLy: addHours(now, first.slaHours),
      },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'SUBMIT',
        actorId: ctx.user.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: 'Sinh viên nộp hồ sơ.',
      },
    })
  })

  await notifyRole(
    first.role,
    {
      tieuDe: 'Có hồ sơ mới chờ bạn xử lý',
      noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.applicant.hoTen} đã được nộp và đang chờ xử lý.`,
      loai: 'INFO',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/quan-ly/don/${app.maHoSo}`,
    },
    prisma,
    ctx.user.id,
  )
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'SUBMIT_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Bản nháp',
    giaTriSau: `Chờ xử lý bước ${first.order}`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export async function cancel(ctx: Ctx, idOrMa: string, lyDo?: string) {
  const app = await loadApplicationForUser(idOrMa, ctx.user)
  if (app.applicantId !== ctx.user.id) throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
  if (app.buocDaDuyet > 0) {
    throw AppError.invalidTransition('Hồ sơ đã được phê duyệt ở một cấp nên không thể rút.')
  }
  if (!['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'].includes(app.trangThai)) {
    throw AppError.invalidTransition('Hồ sơ ở trạng thái hiện tại không thể rút.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: app.id },
      data: { trangThai: 'CANCELLED', hanXuLy: null },
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { trangThai: 'SKIPPED', completedAt: new Date() },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'CANCEL',
        actorId: ctx.user.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: lyDo ?? 'Sinh viên chủ động rút hồ sơ.',
        lyDo: lyDo ?? null,
      },
    })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'CANCEL_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đã nộp',
    giaTriSau: 'Đã rút',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export async function supplement(ctx: Ctx, idOrMa: string, input: SupplementBody) {
  const app = await loadApplicationForUser(idOrMa, ctx.user)
  if (app.applicantId !== ctx.user.id) throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
  if (app.trangThai !== 'NEED_SUPPLEMENT') {
    throw AppError.invalidTransition(
      'Chỉ hồ sơ đang ở trạng thái Cần bổ sung mới có thể bổ sung.',
    )
  }
  if (!app.workflow) throw AppError.validation('Hồ sơ chưa gắn luồng duyệt.')

  const yeuCau = (app.yeuCauBoSung ?? {}) as Record<string, unknown>
  const quayVe = Number(yeuCau.quayVeBuocOrder ?? 1)
  const step = app.workflow.steps.find((s) => s.order === quayVe) ?? firstStepOf(app.workflow.steps)!

  const now = new Date()
  const duLieuMoi = { ...((app.duLieu ?? {}) as Record<string, unknown>), ...(input.duLieu ?? {}) }

  await prisma.$transaction(async (tx) => {
    if (input.tepDinhKem?.length) {
      await tx.applicationAttachment.createMany({
        data: attachmentRows(app.id, input.tepDinhKem, ctx.user.id),
      })
    }
    await tx.application.update({
      where: { id: app.id },
      data: {
        duLieu: duLieuMoi as Prisma.InputJsonValue,
        yeuCauBoSung: { ...yeuCau, daBoSung: true } as Prisma.InputJsonValue,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: step.order,
        hanXuLy: addHours(now, step.slaHours),
      },
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, stepOrder: step.order },
      data: { trangThai: 'IN_PROGRESS', startedAt: now, slaDueAt: addHours(now, step.slaHours) },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'SUPPLEMENT',
        actorId: ctx.user.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: input.ghiChu ?? 'Sinh viên bổ sung hồ sơ theo yêu cầu.',
      },
    })
  })

  await notifyRole(
    step.role,
    {
      tieuDe: 'Sinh viên đã bổ sung hồ sơ',
      noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.applicant.hoTen} đã được bổ sung và quay lại bước "${step.ten}".`,
      loai: 'SUCCESS',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/quan-ly/don/${app.maHoSo}`,
    },
    prisma,
    ctx.user.id,
  )
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'SUPPLEMENT_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Cần bổ sung',
    giaTriSau: `Quay lại bước ${step.order}`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export { pushNotification }
