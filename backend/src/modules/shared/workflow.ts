import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'

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
 * Người được giao xử lý một bước:
 *  - CO_VAN      -> cố vấn học tập của lớp
 *  - TRUONG_KHOA -> trưởng khoa của khoa
 *  - còn lại     -> để trống (bất kỳ ai có vai trò đó đều xử lý được)
 */
export async function pickAssignee(
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
