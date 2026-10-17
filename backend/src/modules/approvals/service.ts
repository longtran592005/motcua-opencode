import { Prisma } from '@prisma/client'
import type { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { scopeWhere } from '../../lib/scope'
import { recordAudit } from '../../lib/audit'
import { notifyRole, pushNotification } from '../../lib/notify'
import {
  applicationDetailDto,
  applicationDto,
  applicationInclude,
  type ApplicationRow,
} from '../shared/dto'
import {
  actorOf,
  assertCanApprove,
  currentStepInstance,
  transition,
  type TransitionOutcome,
} from '../workflow/engine'
import { activeDelegationsReceived } from '../delegations/service'
import { loadApplication, type Ctx } from '../applications/service'
import type { applicationListQuery } from '../applications/schemas'
import type { batchApproveBody } from './schemas'

type ListQuery = z.infer<typeof applicationListQuery>
type BatchBody = z.infer<typeof batchApproveBody>

export { assertCanApprove }

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

/** Hồ sơ đang chờ chính người dùng này xử lý (vai trò, người được giao, ủy quyền, leo thang). */
export function isWaitingAt(
  app: ApplicationRow,
  user: Express.AuthUser,
  uyQuyenSet?: Set<string>,
): boolean {
  if (app.trangThai !== 'PENDING_APPROVAL' && app.trangThai !== 'SUBMITTED') return false
  const si = currentStepInstance(app)
  if (!si) return false
  if (si.trangThai !== 'PENDING' && si.trangThai !== 'IN_PROGRESS') return false

  if (user.role === 'ADMIN') return true
  if (si.role === user.role) return true
  if (si.assigneeId === user.id) return true
  if (si.leoThangLuc && si.escalateTo === user.role) return true
  if (si.assigneeId && uyQuyenSet?.has(`${si.assigneeId}:${si.role}`)) return true
  return false
}

/** Tập ủy quyền còn hiệu lực mà người dùng đang nhận, dạng `nguoiUyQuyenId:vaiTro`. */
export async function receivedDelegationKeys(userId: string): Promise<{
  keys: Set<string>
  fromIds: string[]
}> {
  const rows = await activeDelegationsReceived(userId)
  return {
    keys: new Set(rows.map((d) => `${d.nguoiUyQuyenId}:${d.vaiTro}`)),
    fromIds: [...new Set(rows.map((d) => d.nguoiUyQuyenId))],
  }
}

/* ------------------------------- Phê duyệt ------------------------------- */

async function baoSauDuyet(
  ctx: Ctx,
  app: ApplicationRow,
  outcome: TransitionOutcome,
): Promise<void> {
  if (outcome.buocKeTiep) {
    await pushNotification({
      nguoiNhanId: app.applicantId,
      tieuDe: 'Hồ sơ đã qua một cấp phê duyệt',
      noiDung: `Hồ sơ ${app.maHoSo} đã được ${ctx.user.chucVu ?? ctx.user.hoTen} phê duyệt và chuyển tới bước "${outcome.buocKeTiep.ten}".`,
      loai: 'INFO',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}`,
    })
    await notifyRole(
      outcome.buocKeTiep.role,
      {
        tieuDe: 'Có hồ sơ mới chờ bạn xử lý',
        noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.applicant.hoTen} đã tới bước "${outcome.buocKeTiep.ten}".`,
        loai: 'INFO',
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: `/quan-ly/don/${app.maHoSo}`,
      },
      prisma,
      ctx.user.id,
    )
    return
  }
  if (outcome.vanBan) {
    await pushNotification({
      nguoiNhanId: app.applicantId,
      tieuDe: 'Văn bản đã được ký số và phát hành',
      noiDung: `Hồ sơ ${app.maHoSo} đã hoàn thành. Văn bản số ${outcome.vanBan.soVanBan} đã được ký điện tử, bạn có thể tải về và in.`,
      loai: 'SUCCESS',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}/van-ban`,
    })
  }
}

export async function approve(
  ctx: Ctx,
  input: { maHoSo: string; ghiChu?: string; challengeId?: string; otp?: string },
  idempotencyKey?: string | null,
) {
  const app = await loadApplication(input.maHoSo)
  // Kiểm tra sớm để báo lỗi rõ ràng; engine kiểm tra LẠI bên trong giao dịch.
  const si = await assertCanApprove(app, ctx.user)
  if (si.mode === 'OTP' && (!input.challengeId || !input.otp)) {
    throw AppError.validation('Bước này yêu cầu ký OTP. Vui lòng gửi và nhập mã OTP.', {
      truongThieu: ['challengeId', 'otp'],
    })
  }

  const outcome = await transition({
    action: 'APPROVE',
    appId: app.id,
    actor: actorOf(ctx.user),
    ghiChu: input.ghiChu ?? null,
    otp:
      si.mode === 'OTP' && input.challengeId && input.otp
        ? { challengeId: input.challengeId, ma: input.otp }
        : null,
    expectedStepOrder: si.stepOrder,
    idempotencyKey: idempotencyKey ?? null,
  })

  await baoSauDuyet(ctx, app, outcome)

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'APPROVE_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: `Bước ${outcome.buocOrder}: Đang chờ duyệt`,
    giaTriSau: outcome.buocKeTiep ? `Chuyển bước ${outcome.buocKeTiep.order}` : 'Hoàn thành',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return applicationDetailDto(await loadApplication(app.id))
}

export async function reject(ctx: Ctx, maHoSo: string, lyDo: string) {
  const app = await loadApplication(maHoSo)
  const si = await assertCanApprove(app, ctx.user)

  const outcome = await transition({
    action: 'REJECT',
    appId: app.id,
    actor: actorOf(ctx.user),
    lyDo,
    expectedStepOrder: si.stepOrder,
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

  void outcome
  return applicationDetailDto(await loadApplication(app.id))
}

export async function requestSupplement(ctx: Ctx, maHoSo: string, noiDung: string) {
  const app = await loadApplication(maHoSo)
  const si = await assertCanApprove(app, ctx.user)

  const outcome = await transition({
    action: 'REQUEST_SUPPLEMENT',
    appId: app.id,
    actor: actorOf(ctx.user),
    lyDo: noiDung,
    expectedStepOrder: si.stepOrder,
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
    giaTriSau: `Cần bổ sung (quay về bước ${si.stepOrder})`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  void outcome
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

/** Tập hồ sơ mà người dùng được PHÉP THẤY khi xử lý: phạm vi gốc + việc giao đích danh. */
function visibleWhere(user: Express.AuthUser): Prisma.ApplicationWhereInput {
  return {
    OR: [scopeWhere(user), { stepInstances: { some: { assigneeId: user.id } } }],
  }
}

/** Tập hồ sơ có thể đang tới lượt người dùng xử lý (dùng cho hộp thư "Chờ tôi duyệt"). */
function pendingWhere(user: Express.AuthUser, fromIds: string[]): Prisma.ApplicationWhereInput {
  const phamVi: Prisma.ApplicationWhereInput[] = [
    scopeWhere(user),
    // Hồ sơ đang giao ĐÍCH DANH cho người dùng này (kể cả khi người dùng không
    // thuộc phạm vi khoa/lớp của hồ sơ — ví dụ người nhận ủy quyền).
    {
      stepInstances: {
        some: { assigneeId: user.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      },
    },
  ]
  if (fromIds.length) {
    // Hồ sơ đang giao cho những người đã ủy quyền cho người dùng này.
    phamVi.push({
      stepInstances: {
        some: {
          assigneeId: { in: fromIds },
          trangThai: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      },
    })
  }
  return phamVi.length === 1 ? phamVi[0] : { OR: phamVi }
}

/**
 * Hộp thư "Chờ tôi duyệt". Lọc trong bộ nhớ (quyết định D8) vì điều kiện
 * "đang tới lượt vai trò/người được giao ở bước hiện tại" không diễn đạt được
 * bằng một mệnh đề WHERE thông thường. Phạm vi dữ liệu được mở rộng cho các
 * hồ sơ đang giao cho người nhận ủy quyền.
 */
export async function listPending(user: Express.AuthUser, query: ListQuery) {
  const { keys, fromIds } = await receivedDelegationKeys(user.id)

  const rows = await prisma.application.findMany({
    where: {
      deletedAt: null,
      AND: [
        { trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL'] } },
        pendingWhere(user, fromIds),
      ],
    },
    include: applicationInclude,
  })
  const filtered = sortRows(
    rows.filter((r) => isWaitingAt(r, user, keys) && matchesFilters(r, query)),
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
    AND: [
      {
        OR: [
          scopeWhere(user),
          // Người nhận ủy quyền đã xử lý hồ sơ ngoài phạm vi khoa/lớp của mình.
          { approvals: { some: { actorId: user.id } } },
        ],
      },
      { approvals: { some: { actorId: user.id } } },
    ],
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
  const { keys } = await receivedDelegationKeys(user.id)
  const scoped = await prisma.application.findMany({
    where: { deletedAt: null, AND: [visibleWhere(user)] },
    include: applicationInclude,
  })
  const pending = scoped.filter((a) => isWaitingAt(a, user, keys))
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

/**
 * Duyệt hàng loạt: CHỈ áp cho bước `ONE_CLICK`. Mỗi đơn xử lý ĐỘC LẬP trong
 * giao dịch riêng của nó — một đơn lỗi không ảnh hưởng các đơn còn lại, và
 * kết quả trả về theo TỪNG đơn.
 */
export async function approveBatch(ctx: Ctx, body: BatchBody, idempotencyKey?: string | null) {
  const thanhCong: string[] = []
  const thatBai: { maHoSo: string; maLoi: string; lyDo: string }[] = []

  for (const maHoSo of body.maHoSoList) {
    try {
      const app = await loadApplication(maHoSo)
      const si = await assertCanApprove(app, ctx.user)
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
