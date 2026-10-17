import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { activeDelegationGiven } from '../delegations/service'

export function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 3_600_000)
}

export function firstStepOf<T extends { order: number }>(steps: T[]): T | undefined {
  return [...steps].sort((a, b) => a.order - b.order)[0]
}

export function stepAfter<T extends { order: number }>(steps: T[], order: number): T | undefined {
  return [...steps].sort((a, b) => a.order - b.order).find((s) => s.order > order)
}

/**
 * Người "tự nhiên" của một bước (chưa xét ủy quyền):
 *  - CO_VAN      -> cố vấn học tập của lớp
 *  - TRUONG_KHOA -> trưởng khoa của khoa
 *  - còn lại     -> để trống (bất kỳ ai có vai trò đó đều xử lý được)
 */
export async function naturalAssigneeOf(
  step: { role: Role },
  opts: { classId: string | null; facultyId: string | null },
): Promise<string | null> {
  if (step.role === 'CO_VAN' && opts.classId) {
    const cls = await prisma.class.findUnique({
      where: { id: opts.classId },
      select: { coVanId: true },
    })
    return cls?.coVanId ?? null
  }
  if (step.role === 'TRUONG_KHOA' && opts.facultyId) {
    const f = await prisma.faculty.findUnique({
      where: { id: opts.facultyId },
      select: { truongKhoaId: true },
    })
    return f?.truongKhoaId ?? null
  }
  return null
}

/**
 * Người được giao xử lý một bước, ĐÃ XÉT ủy quyền: nếu người tự nhiên của bước
 * đang giao việc cho người khác bằng một ủy quyền còn hiệu lực (theo ngày) thì
 * việc được giao cho người nhận ủy quyền.
 *
 * Lưu ý: hiệu lực ủy quyền còn được kiểm tra lại ở thời điểm phê duyệt
 * (xem `assertCanApprove`) — ủy quyền hết hạn thì không duyệt được nữa.
 */
export async function pickAssignee(
  step: { role: Role },
  opts: { classId: string | null; facultyId: string | null },
  at: Date = new Date(),
): Promise<string | null> {
  const natural = await naturalAssigneeOf(step, opts)
  if (!natural) return null
  const uyQuyen = await activeDelegationGiven(natural, step.role, at)
  return uyQuyen ? uyQuyen.nguoiNhanId : natural
}
