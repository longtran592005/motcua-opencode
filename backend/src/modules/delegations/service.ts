import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export const delegationInclude = {
  nguoiUyQuyen: { select: { id: true, hoTen: true } },
  nguoiNhan: { select: { id: true, hoTen: true } },
} satisfies Prisma.DelegationInclude

export type DelegationRow = Prisma.DelegationGetPayload<{ include: typeof delegationInclude }>

/** Ánh xạ sang đúng interface `Delegation` của frontend. */
export function delegationDto(d: DelegationRow) {
  return {
    id: d.id,
    nguoiUyQuyenId: d.nguoiUyQuyenId,
    nguoiUyQuyenTen: d.nguoiUyQuyen.hoTen,
    nguoiNhanId: d.nguoiNhanId,
    nguoiNhanTen: d.nguoiNhan.hoTen,
    vaiTro: d.vaiTro,
    tuNgay: d.tuNgay.toISOString(),
    denNgay: d.denNgay.toISOString(),
    lyDo: d.lyDo,
    hieuLuc: d.hieuLuc,
    taoLuc: d.createdAt.toISOString(),
  }
}

/**
 * Ủy quyền CÒN HIỆU LỰC gần nhất từ `nguoiUyQuyenId` sang `nguoiNhanId` cho một vai trò.
 * Kiểm tra hiệu lực theo ngày: `tuNgay <= lúc <= denNgay` và cờ `hieuLuc`.
 * Dùng khi gán người duyệt và khi kiểm tra quyền phê duyệt (ủy quyền hết hạn ⇒ hết quyền).
 */
export async function activeDelegationFor(
  nguoiUyQuyenId: string,
  vaiTro: Role,
  nguoiNhanId: string,
  at: Date = new Date(),
): Promise<DelegationRow | null> {
  return prisma.delegation.findFirst({
    where: {
      nguoiUyQuyenId,
      nguoiNhanId,
      vaiTro,
      hieuLuc: true,
      deletedAt: null,
      tuNgay: { lte: at },
      denNgay: { gte: at },
    },
    include: delegationInclude,
    orderBy: { createdAt: 'desc' },
  })
}

/** Ủy quyền còn hiệu lực (bất kỳ người nhận nào) mà một người đã giao đi theo vai trò. */
export async function activeDelegationGiven(
  nguoiUyQuyenId: string,
  vaiTro: Role,
  at: Date = new Date(),
): Promise<DelegationRow | null> {
  return prisma.delegation.findFirst({
    where: {
      nguoiUyQuyenId,
      vaiTro,
      hieuLuc: true,
      deletedAt: null,
      tuNgay: { lte: at },
      denNgay: { gte: at },
    },
    include: delegationInclude,
    orderBy: { createdAt: 'desc' },
  })
}

/** Các ủy quyền còn hiệu lực NHẬN ĐƯỢC của một người (dùng lọc hộp thư). */
export async function activeDelegationsReceived(
  nguoiNhanId: string,
  at: Date = new Date(),
): Promise<DelegationRow[]> {
  return prisma.delegation.findMany({
    where: {
      nguoiNhanId,
      hieuLuc: true,
      deletedAt: null,
      tuNgay: { lte: at },
      denNgay: { gte: at },
    },
    include: delegationInclude,
  })
}
