import type { Prisma } from '@prisma/client'
import { dateOnly } from './dto'

/** Quan hệ cần nạp để dựng `User` đúng khuôn frontend. */
export const userInclude = {
  faculty: { select: { id: true, ten: true } },
  department: { select: { id: true, ten: true } },
  studentProfile: {
    select: {
      class: {
        select: {
          id: true,
          ten: true,
          major: { select: { ten: true } },
          academicYear: { select: { ten: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude

export type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>

/** Ánh xạ người dùng sang đúng interface `User` của frontend. */
export function userDto(u: UserRow) {
  const cls = u.studentProfile?.class
  const donViId = u.facultyId ?? u.departmentId ?? undefined
  const donViTen = u.faculty?.ten ?? u.department?.ten ?? undefined

  return {
    id: u.id,
    maSo: u.maSo,
    hoTen: u.hoTen,
    email: u.email,
    role: u.role,
    ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
    ...(u.soDienThoai ? { soDienThoai: u.soDienThoai } : {}),
    ...(dateOnly(u.ngaySinh) ? { ngaySinh: dateOnly(u.ngaySinh) } : {}),
    ...(u.gioiTinh ? { gioiTinh: u.gioiTinh } : {}),
    ...(u.chucVu ? { chucVu: u.chucVu } : {}),
    ...(donViId ? { donViId } : {}),
    ...(donViTen ? { donViTen } : {}),
    ...(cls ? { lopId: cls.id, lopTen: cls.ten } : {}),
    ...(cls ? { nganhTen: cls.major.ten, khoaHoc: cls.academicYear.ten } : {}),
    trangThai: u.trangThai,
  }
}
