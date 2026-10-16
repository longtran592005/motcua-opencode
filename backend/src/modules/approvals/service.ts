import { Prisma } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { sha256 } from '../../lib/crypto'
import { assertInScope, scopeWhere } from '../../lib/scope'
import { recordAudit } from '../../lib/audit'
import { notifyRole, pushNotification } from '../../lib/notify'
import {
  applicationDetailDto,
  applicationDto,
  applicationInclude,
  type ApplicationRow,
} from '../shared/dto'
import { addHours, pickAssignee, stepAfter } from '../shared/workflow'
import { consumeOtp } from '../otp/service'
import { issueDocument } from '../documents/issuer'
import { loadApplication, type Ctx } from '../applications/service'
import type { applicationListQuery } from '../applications/schemas'
import type { batchApproveBody } from './schemas'

type ListQuery = z.infer<typeof applicationListQuery>
type BatchBody = z.infer<typeof batchApproveBody>

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Đã nộp',
  PENDING_APPROVAL: 'Đang chờ duyệt',
  NEED_SUPPLEMENT: 'Cần bổ sung',
  REJECTED: 'Từ chối',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã rút',
}

/* --------------------------- Quy tắc nghiệp vụ --------------------------- */

function currentStepInstance(app: ApplicationRow) {
  return app.stepInstances.find((s) => s.stepOrder === app.currentStepOrder) ?? null
}

/** Hồ sơ đang chờ chính người dùng này xử lý. */
export function isWaitingAt(app: ApplicationRow, user: Express.AuthUser): boolean {
  if (app.trangThai !== 'PENDING_APPROVAL' && app.trangThai !== 'SUBMITTED') return false
  const si = currentStepInstance(app)
  if (!si) return false
  if (si.trangThai !== 'PENDING' && si.trangThai !== 'IN_PROGRESS') return false
  return user.role === 'ADMIN' || si.role === user.role
}

/**
 * Bốn điều kiện bắt buộc trước khi cho phép phê duyệt (theo mock + quyết định B1/B2):
 * phạm vi, trạng thái chờ duyệt, đúng cấp xử lý, bước chưa bị xử lý.
 */
export function assertCanApprove(app: ApplicationRow, user: Express.AuthUser) {
  assertInScope(app, user)
  const waiting =
    app.trangThai === 'PENDING_APPROVAL' ||
    (app.trangThai === 'SUBMITTED' && app.currentStepOrder === 1)
  if (!waiting) {
    throw AppError.invalidTransition('Hồ sơ không ở trạng thái chờ duyệt nên không thể phê duyệt.')
  }
  const si = currentStepInstance(app)
  if (!si) throw AppError.invalidTransition('Hồ sơ không có bước xử lý hiện tại.')
  if (si.trangThai === 'APPROVED' || si.trangThai === 'REJECTED') {
    throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
  }
  if (user.role !== 'ADMIN' && si.role !== user.role) {
    throw AppError.forbidden('Hồ sơ này không thuộc cấp xử lý của bạn.')
  }
  return si
}

function createSignature(
  tx: Prisma.TransactionClient,
  params: {
    app: ApplicationRow
    stepOrder: number
    tenBuoc: string
    mode: 'ONE_CLICK' | 'OTP'
    user: Express.AuthUser
    now: Date
  },
) {
  const { app, stepOrder, tenBuoc, mode, user, now } = params
  const maBam = sha256(
    `${app.maHoSo}|${stepOrder}|${user.id}|${JSON.stringify(app.duLieu ?? {})}|${now.toISOString()}`,
  )
  return tx.signature.create({
    data: {
      applicationId: app.id,
      buocOrder: stepOrder,
      tenBuoc,
      nguoiKyId: user.id,
      hoTen: user.hoTen,
      chucVu: user.chucVu,
      vaiTro: user.role,
      phuongThuc: mode === 'OTP' ? 'OTP' : 'ELECTRONIC',
      thoiDiemKy: now,
      maBam,
      maChuKy: maBam.slice(0, 8).toUpperCase(),
      hopLe: true,
    },
  })
}

/* ------------------------------- Phê duyệt ------------------------------- */

export async function approve(
  ctx: Ctx,
  input: { maHoSo: string; ghiChu?: string; challengeId?: string; otp?: string },
  idempotencyKey?: string | null,
) {
  const app = await loadApplication(input.maHoSo)
  const si = assertCanApprove(app, ctx.user)

  if (si.mode === 'OTP') {
    if (!input.challengeId || !input.otp) {
      throw AppError.validation('Bước này yêu cầu ký OTP. Vui lòng gửi và nhập mã OTP.', {
        truongThieu: ['challengeId', 'otp'],
      })
    }
  }

  const workflow = app.workflow!
  const next = stepAfter(workflow.steps, si.stepOrder)
  const assigneeId = next ? await pickAssignee(next, { classId: app.classId, facultyId: app.facultyId }) : null
  const now = new Date()

  const outcome = await prisma.$transaction(async (tx) => {
    if (si.mode === 'OTP') {
      await consumeOtp(tx, {
        challengeId: input.challengeId!,
        otp: input.otp!,
        userId: ctx.user.id,
        applicationId: app.id,
        stepOrder: si.stepOrder,
      })
    }

    const sig = await createSignature(tx, {
      app,
      stepOrder: si.stepOrder,
      tenBuoc: si.ten,
      mode: si.mode,
      user: ctx.user,
      now,
    })

    await tx.approval.create({
      data: {
        applicationId: app.id,
        stepInstanceId: si.id,
        buocOrder: si.stepOrder,
        hanhDong: 'APPROVE',
        actorId: ctx.user.id,
        vaiTro: ctx.user.role,
        chucVu: ctx.user.chucVu,
        ghiChu: input.ghiChu ?? null,
        phuongThuc: si.mode,
        signatureId: sig.id,
        idempotencyKey: idempotencyKey ?? null,
      },
    })
    // "Chiếm" bước một cách nguyên tử: nếu người khác vừa xử lý xong (đổi trạng thái)
    // thì câu lệnh này không khớp bản ghi nào → ALREADY_PROCESSED (quyết định B2).
    const claimed = await tx.stepInstance.updateMany({
      where: { id: si.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { trangThai: 'APPROVED', completedAt: now },
    })
    if (claimed.count === 0) {
      throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
    }

    if (next) {
      await tx.stepInstance.updateMany({
        where: { applicationId: app.id, stepOrder: next.order },
        data: {
          trangThai: 'IN_PROGRESS',
          assigneeId,
          startedAt: now,
          slaDueAt: addHours(now, next.slaHours),
        },
      })
      await tx.application.update({
        where: { id: app.id },
        data: {
          trangThai: 'PENDING_APPROVAL',
          currentStepOrder: next.order,
          buocDaDuyet: si.stepOrder,
          hanXuLy: addHours(now, next.slaHours),
        },
      })
      return { next, doc: null as null | { soVanBan: string } }
    }

    const doc = await issueDocument(tx, { app, now, actorId: ctx.user.id })
    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'COMPLETED',
        buocDaDuyet: si.stepOrder,
        ngayHoanThanh: now,
        hanXuLy: null,
      },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: workflow.steps.length,
        hanhDong: 'ISSUE_DOCUMENT',
        actorId: ctx.user.id,
        vaiTro: ctx.user.role,
        chucVu: ctx.user.chucVu,
        ghiChu: `Cấp văn bản số ${doc.soVanBan}, ký số và sinh mã QR xác thực.`,
      },
    })
    return { next: null, doc }
  })

  if (outcome.next) {
    await pushNotification({
      nguoiNhanId: app.applicantId,
      tieuDe: 'Hồ sơ đã qua một cấp phê duyệt',
      noiDung: `Hồ sơ ${app.maHoSo} đã được ${ctx.user.chucVu ?? ctx.user.hoTen} phê duyệt và chuyển tới bước "${outcome.next.ten}".`,
      loai: 'INFO',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}`,
    })
    await notifyRole(
      outcome.next.role,
      {
        tieuDe: 'Có hồ sơ mới chờ bạn xử lý',
        noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.applicant.hoTen} đã tới bước "${outcome.next.ten}".`,
        loai: 'INFO',
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: `/quan-ly/don/${app.maHoSo}`,
      },
      prisma,
      ctx.user.id,
    )
  } else if (outcome.doc) {
    await pushNotification({
      nguoiNhanId: app.applicantId,
      tieuDe: 'Văn bản đã được ký số và phát hành',
      noiDung: `Hồ sơ ${app.maHoSo} đã hoàn thành. Văn bản số ${outcome.doc.soVanBan} đã được ký điện tử, bạn có thể tải về và in.`,
      loai: 'SUCCESS',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}/van-ban`,
    })
  }

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'APPROVE_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: `Bước ${si.stepOrder}: Đang chờ duyệt`,
    giaTriSau: outcome.next ? `Chuyển bước ${outcome.next.order}` : 'Hoàn thành',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export async function reject(ctx: Ctx, maHoSo: string, lyDo: string) {
  const app = await loadApplication(maHoSo)
  const si = assertCanApprove(app, ctx.user)
  if (si.workflowStep && !si.workflowStep.allowReject) {
    throw AppError.invalidTransition('Bước duyệt này không cho phép từ chối hồ sơ.')
  }
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        applicationId: app.id,
        stepInstanceId: si.id,
        buocOrder: si.stepOrder,
        hanhDong: 'REJECT',
        actorId: ctx.user.id,
        vaiTro: ctx.user.role,
        chucVu: ctx.user.chucVu,
        lyDo,
      },
    })
    await tx.stepInstance.update({
      where: { id: si.id },
      data: { trangThai: 'REJECTED', completedAt: now },
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, trangThai: 'PENDING' },
      data: { trangThai: 'SKIPPED', completedAt: now },
    })
    await tx.application.update({
      where: { id: app.id },
      data: { trangThai: 'REJECTED', lyDoTuChoi: lyDo, hanXuLy: null },
    })
  })

  await pushNotification({
    nguoiNhanId: app.applicantId,
    tieuDe: 'Hồ sơ đã bị từ chối',
    noiDung: `Hồ sơ ${app.maHoSo} bị từ chối ở bước "${si.ten}". Lý do: ${lyDo}`,
    loai: 'DANGER',
    applicationId: app.id,
    maHoSo: app.maHoSo,
    lienKet: `/don/${app.maHoSo}`,
  })
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'REJECT_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đang chờ duyệt',
    giaTriSau: 'Từ chối',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export async function requestSupplement(ctx: Ctx, maHoSo: string, noiDung: string) {
  const app = await loadApplication(maHoSo)
  const si = assertCanApprove(app, ctx.user)
  if (si.workflowStep && !si.workflowStep.allowSupplement) {
    throw AppError.invalidTransition('Bước duyệt này không cho phép yêu cầu bổ sung.')
  }
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        applicationId: app.id,
        stepInstanceId: si.id,
        buocOrder: si.stepOrder,
        hanhDong: 'REQUEST_SUPPLEMENT',
        actorId: ctx.user.id,
        vaiTro: ctx.user.role,
        chucVu: ctx.user.chucVu,
        lyDo: noiDung,
      },
    })
    await tx.stepInstance.update({
      where: { id: si.id },
      data: { trangThai: 'PENDING', completedAt: null, startedAt: null, slaDueAt: null },
    })
    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'NEED_SUPPLEMENT',
        currentStepOrder: 0,
        hanXuLy: null,
        yeuCauBoSung: {
          noiDung,
          boiAiId: ctx.user.id,
          boiAiTen: ctx.user.hoTen,
          luc: now.toISOString(),
          daBoSung: false,
          quayVeBuocOrder: si.stepOrder,
        } as Prisma.InputJsonValue,
      },
    })
  })

  await pushNotification({
    nguoiNhanId: app.applicantId,
    tieuDe: 'Hồ sơ cần bổ sung thông tin',
    noiDung: `Hồ sơ ${app.maHoSo} cần bổ sung: ${noiDung}`,
    loai: 'WARNING',
    applicationId: app.id,
    maHoSo: app.maHoSo,
    lienKet: `/don/${app.maHoSo}`,
  })
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'REQUEST_SUPPLEMENT',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đang chờ duyệt',
    giaTriSau: 'Cần bổ sung',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

/* ------------------------------ Hộp thư duyệt ---------------------------- */

function matchesFilters(app: ApplicationRow, query: ListQuery): boolean {
  if (query.trangThai && query.trangThai !== 'ALL' && app.trangThai !== query.trangThai) return false
  if (query.requestTypeId && app.requestTypeId !== query.requestTypeId) return false
  if (query.lop && app.class?.ma !== query.lop && app.classId !== query.lop) return false
  if (query.tuKhoa) {
    const t = query.tuKhoa.toLowerCase()
    const hay = `${app.maHoSo} ${app.applicant.hoTen} ${app.requestType.ten}`.toLowerCase()
    if (!hay.includes(t)) return false
  }
  return true
}

function sortRows(rows: ApplicationRow[], query: ListQuery): ApplicationRow[] {
  const copy = [...rows]
  if (query.sapXep === 'HAN_GAN_NHAT') {
    return copy.sort((a, b) => (a.hanXuLy?.getTime() ?? Infinity) - (b.hanXuLy?.getTime() ?? Infinity))
  }
  if (query.sapXep === 'CU_NHAT') {
    return copy.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
  return copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export async function listPending(user: Express.AuthUser, query: ListQuery) {
  const rows = await prisma.application.findMany({
    where: {
      deletedAt: null,
      AND: [scopeWhere(user), { trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } }],
    },
    include: applicationInclude,
  })
  const filtered = sortRows(
    rows.filter((r) => isWaitingAt(r, user) && matchesFilters(r, query)),
    query,
  )
  const start = (query.page - 1) * query.pageSize
  return {
    items: filtered.slice(start, start + query.pageSize).map(applicationDto),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function listProcessed(user: Express.AuthUser, query: ListQuery) {
  const where: Prisma.ApplicationWhereInput = {
    deletedAt: null,
    AND: [scopeWhere(user), { approvals: { some: { actorId: user.id } } }],
  }
  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: applicationInclude,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])
  return { items: rows.map(applicationDto), total, page: query.page, pageSize: query.pageSize }
}

export async function pendingCount(user: Express.AuthUser): Promise<number> {
  return (await listPending(user, { page: 1, pageSize: 1 } as ListQuery)).total
}

export async function listOverdue(user: Express.AuthUser, limit: number) {
  const rows = await prisma.application.findMany({
    where: {
      deletedAt: null,
      AND: [
        scopeWhere(user),
        { trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } },
        { hanXuLy: { lt: new Date() } },
      ],
    },
    include: applicationInclude,
    orderBy: { hanXuLy: 'asc' },
    take: limit,
  })
  return rows.map(applicationDto)
}

function groupCount(rows: ApplicationRow[], pick: (r: ApplicationRow) => string) {
  const map = new Map<string, number>()
  for (const r of rows) map.set(pick(r), (map.get(pick(r)) ?? 0) + 1)
  return [...map.entries()]
    .map(([ten, soLuong]) => ({ ten, soLuong }))
    .sort((a, b) => b.soLuong - a.soLuong)
}

export async function statsApproval(user: Express.AuthUser) {
  const scoped = await prisma.application.findMany({
    where: { deletedAt: null, AND: [scopeWhere(user)] },
    include: applicationInclude,
  })
  const pending = scoped.filter((a) => isWaitingAt(a, user))
  const now = Date.now()
  const day = 86_400_000

  const weekAgo = new Date(now - 7 * day)
  const processed = await prisma.approval.findMany({
    where: { actorId: user.id, createdAt: { gte: weekAgo } },
    select: { applicationId: true },
  })

  const xuHuong7Ngay = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(now - (6 - i) * day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + day)
    return {
      ngay: start.toISOString().slice(0, 10),
      nop: scoped.filter((a) => a.ngayNop && a.ngayNop >= start && a.ngayNop < end).length,
      duyet: scoped.filter((a) => a.ngayHoanThanh && a.ngayHoanThanh >= start && a.ngayHoanThanh < end)
        .length,
    }
  })

  return {
    choToiDuyet: pending.length,
    sapHetHan: pending.filter(
      (a) => a.hanXuLy && a.hanXuLy.getTime() >= now && a.hanXuLy.getTime() <= now + day,
    ).length,
    quaHan: pending.filter((a) => a.hanXuLy && a.hanXuLy.getTime() < now).length,
    daXuLyTuanNay: new Set(processed.map((p) => p.applicationId)).size,
    theoTrangThai: Object.keys(STATUS_LABELS).map((trangThai) => ({
      trangThai,
      nhan: STATUS_LABELS[trangThai],
      soLuong: scoped.filter((a) => a.trangThai === trangThai).length,
    })),
    theoLoaiDon: groupCount(scoped, (r) => r.requestType.ten),
    theoKhoa: groupCount(scoped, (r) => r.class?.faculty.ten ?? 'Không xác định'),
    xuHuong7Ngay,
  }
}

export async function approveBatch(ctx: Ctx, body: BatchBody, idempotencyKey?: string | null) {
  const thanhCong: string[] = []
  const thatBai: { maHoSo: string; maLoi: string; lyDo: string }[] = []

  for (const maHoSo of body.maHoSoList) {
    try {
      const app = await loadApplication(maHoSo)
      const si = assertCanApprove(app, ctx.user)
      if (si.mode !== 'ONE_CLICK') {
        throw AppError.validation('Bước này yêu cầu ký OTP nên không thể duyệt hàng loạt.')
      }
      await approve(ctx, { maHoSo, ghiChu: body.ghiChu }, idempotencyKey)
      thanhCong.push(maHoSo)
    } catch (e) {
      const err = e as { code?: string; message?: string }
      thatBai.push({
        maHoSo,
        maLoi: err.code ?? 'UNKNOWN',
        lyDo: err.message ?? 'Không xử lý được hồ sơ.',
      })
    }
  }

  return { thanhCong, thatBai }
}
