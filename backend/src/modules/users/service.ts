import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid, randomToken } from '../../lib/crypto'
import { recordAudit } from '../../lib/audit'
import { userDto, userInclude, type UserRow } from '../shared/userDto'
import type { Ctx } from '../applications/service'

export const BCRYPT_ROUNDS = 10

/** Mật khẩu tạm dễ đọc, tránh ký tự dễ nhầm (0/O, 1/l/I). */
export function matKhauTam(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const raw = randomToken(16)
  let out = ''
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16) % alphabet.length]
  }
  return out
}

export interface UserInput {
  maSo?: string
  hoTen?: string
  email?: string
  role?: string
  soDienThoai?: string | null
  ngaySinh?: string | null
  gioiTinh?: string | null
  chucVu?: string | null
  donViId?: string | null
  lopId?: string | null
  trangThai?: string
  matKhau?: string
}

/** Tìm người dùng theo MÃ SỐ hoặc UUID (quyết định B1, D6). */
export async function loadUser(idOrMa: string): Promise<UserRow> {
  const row = await prisma.user.findFirst({
    where: {
      ...(isUuid(idOrMa) ? { id: idOrMa } : { maSo: { equals: idOrMa, mode: 'insensitive' } }),
      deletedAt: null,
    },
    include: userInclude,
  })
  if (!row) throw AppError.notFound('Không tìm thấy người dùng.')
  return row
}

/** `donViId` là UUID của khoa HOẶC phòng ban — tra xem khớp bảng nào. */
async function resolveDonVi(donViId: string | null | undefined) {
  if (donViId === undefined) return { facultyId: undefined, departmentId: undefined }
  if (!donViId) return { facultyId: null, departmentId: null }
  const khoa = await prisma.faculty.findFirst({ where: { id: donViId }, select: { id: true } })
  if (khoa) return { facultyId: khoa.id, departmentId: null }
  const phong = await prisma.department.findFirst({ where: { id: donViId }, select: { id: true } })
  if (phong) return { facultyId: null, departmentId: phong.id }
  throw AppError.notFound('Không tìm thấy đơn vị (khoa/phòng ban).')
}

async function kiemTraTrung(
  input: { maSo?: string; email?: string },
  boQuaId?: string,
): Promise<void> {
  if (input.maSo) {
    const trung = await prisma.user.findFirst({
      where: {
        maSo: { equals: input.maSo.trim(), mode: 'insensitive' },
        ...(boQuaId ? { id: { not: boQuaId } } : {}),
      },
      select: { id: true },
    })
    if (trung) throw new AppError('DUPLICATE_ACTION', `Mã số "${input.maSo}" đã được dùng.`)
  }
  if (input.email) {
    const trung = await prisma.user.findFirst({
      where: { email: { equals: input.email.trim(), mode: 'insensitive' }, ...(boQuaId ? { id: { not: boQuaId } } : {}) },
      select: { id: true },
    })
    if (trung) throw new AppError('DUPLICATE_ACTION', `Email "${input.email}" đã được dùng.`)
  }
}

export async function createUser(ctx: Ctx, input: UserInput) {
  if (!input.maSo?.trim()) throw AppError.validation('Thiếu mã số.')
  if (!input.hoTen?.trim()) throw AppError.validation('Thiếu họ tên.')
  if (!input.email?.trim()) throw AppError.validation('Thiếu email.')
  if (!input.role) throw AppError.validation('Thiếu vai trò.')
  const role = input.role as never

  if (input.matKhau && input.matKhau.length < 6) {
    throw AppError.validation('Mật khẩu phải dài ít nhất 6 ký tự.')
  }
  await kiemTraTrung(input)

  // Sinh viên BẮT BUỘC thuộc một lớp.
  let classId: string | null = null
  if (input.role === 'SINH_VIEN') {
    if (!input.lopId) throw AppError.validation('Sinh viên phải được gán vào một lớp (lopId).')
    const lop = await prisma.class.findFirst({ where: { id: input.lopId }, select: { id: true } })
    if (!lop) throw AppError.notFound('Không tìm thấy lớp.')
    classId = lop.id
  }
  const donVi = await resolveDonVi(input.donViId)

  const matKhau = input.matKhau ?? matKhauTam()
  const passwordHash = await bcrypt.hash(matKhau, BCRYPT_ROUNDS)

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        maSo: input.maSo!.trim(),
        hoTen: input.hoTen!.trim(),
        email: input.email!.trim().toLowerCase(),
        passwordHash,
        role,
        soDienThoai: input.soDienThoai ?? null,
        ngaySinh: input.ngaySinh ? new Date(input.ngaySinh) : null,
        gioiTinh: (input.gioiTinh ?? null) as never,
        chucVu: input.chucVu ?? null,
        trangThai: (input.trangThai ?? 'ACTIVE') as never,
        facultyId: donVi.facultyId ?? null,
        departmentId: donVi.departmentId ?? null,
      },
    })
    if (classId) {
      await tx.student.create({ data: { userId: user.id, classId } })
    }
    return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'CREATE_USER',
    doiTuong: 'Người dùng',
    doiTuongId: created.maSo,
    giaTriSau: `Tạo ${created.role} ${created.maSo}`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  // Mật khẩu tạm CHỈ trả về khi người tạo không tự đặt mật khẩu.
  return {
    ...userDto(created),
    ...(input.matKhau ? {} : { matKhauTam: matKhau }),
  }
}

export async function updateUser(ctx: Ctx, idOrMa: string, input: UserInput) {
  const target = await loadUser(idOrMa)
  await kiemTraTrung(input, target.id)

  if (input.role && input.role !== 'SINH_VIEN' && input.lopId) {
    throw AppError.validation('Chỉ sinh viên mới có lớp.')
  }
  const roleMoi = (input.role ?? target.role) as string
  const classIdHienTai = target.studentProfile?.class.id ?? null
  const classIdMoi = input.lopId ?? classIdHienTai
  if (roleMoi === 'SINH_VIEN' && !classIdMoi) {
    throw AppError.validation('Sinh viên phải được gán vào một lớp (lopId).')
  }
  const donVi = await resolveDonVi(input.donViId)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        ...(input.maSo ? { maSo: input.maSo.trim() } : {}),
        ...(input.hoTen ? { hoTen: input.hoTen.trim() } : {}),
        ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.role ? { role: input.role as never } : {}),
        ...(input.soDienThoai !== undefined ? { soDienThoai: input.soDienThoai } : {}),
        ...(input.ngaySinh !== undefined
          ? { ngaySinh: input.ngaySinh ? new Date(input.ngaySinh) : null }
          : {}),
        ...(input.gioiTinh !== undefined ? { gioiTinh: input.gioiTinh as never } : {}),
        ...(input.chucVu !== undefined ? { chucVu: input.chucVu } : {}),
        ...(input.trangThai ? { trangThai: input.trangThai as never } : {}),
        ...(donVi.facultyId !== undefined ? { facultyId: donVi.facultyId } : {}),
        ...(donVi.departmentId !== undefined ? { departmentId: donVi.departmentId } : {}),
      },
    })

    if (roleMoi === 'SINH_VIEN' && classIdMoi) {
      await tx.student.upsert({
        where: { userId: target.id },
        create: { userId: target.id, classId: classIdMoi },
        update: { classId: classIdMoi },
      })
    } else if (target.studentProfile) {
      // Đổi khỏi vai trò sinh viên ⇒ bỏ hồ sơ sinh viên.
      await tx.student.delete({ where: { userId: target.id } })
    }

    return tx.user.findUniqueOrThrow({ where: { id: target.id }, include: userInclude })
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'UPDATE_USER',
    doiTuong: 'Người dùng',
    doiTuongId: updated.maSo,
    giaTriTruoc: `${target.role} / ${target.trangThai}`,
    giaTriSau: `${updated.role} / ${updated.trangThai}`,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return userDto(updated)
}

/** Xoá mềm người dùng. Không cho xoá tài khoản ADMIN. */
export async function deleteUser(ctx: Ctx, idOrMa: string): Promise<void> {
  const target = await loadUser(idOrMa)
  if (target.role === 'ADMIN') {
    throw AppError.forbidden('Không thể xoá tài khoản quản trị viên.')
  }
  if (target.id === ctx.user.id) {
    throw AppError.forbidden('Không thể xoá chính mình.')
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { deletedAt: new Date(), trangThai: 'LOCKED' },
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'DELETE_USER',
    doiTuong: 'Người dùng',
    doiTuongId: target.maSo,
    giaTriTruoc: `${target.role} đang hoạt động`,
    giaTriSau: 'Đã xoá',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
}

/**
 * Đặt lại mật khẩu về mật khẩu tạm và trả về cho quản trị viên.
 * KHÔNG áp dụng idempotency cho endpoint này để mật khẩu không bị lưu vào
 * nhật ký idempotency; nhật ký kiểm toán cũng KHÔNG ghi mật khẩu.
 */
export async function resetPassword(ctx: Ctx, idOrMa: string): Promise<{ matKhauTam: string }> {
  const target = await loadUser(idOrMa)
  const tam = matKhauTam()
  const passwordHash = await bcrypt.hash(tam, BCRYPT_ROUNDS)

  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash },
  })
  // Thu hồi mọi phiên làm mới đang mở của người dùng bị đặt lại mật khẩu.
  await prisma.refreshToken.updateMany({
    where: { userId: target.id, daThuHoi: false },
    data: { daThuHoi: true },
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'RESET_PASSWORD',
    doiTuong: 'Người dùng',
    doiTuongId: target.maSo,
    giaTriTruoc: 'Mật khẩu cũ',
    giaTriSau: 'Đặt lại về mật khẩu tạm',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return { matKhauTam: tam }
}
