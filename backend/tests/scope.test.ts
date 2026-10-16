import { describe, expect, it } from 'vitest'
import { api, bearer, login, prisma } from './helpers'

async function mine(token: string, extra = '') {
  const res = await api()
    .get(`/api/v1/applications/mine?pageSize=100${extra}`)
    .set(bearer(token))
  expect(res.status).toBe(200)
  return res.body.data as Array<Record<string, never> & {
    maHoSo: string
    sinhVienId: string
    sinhVien: { id: string; coVanId?: string; khoa: string; lop: string }
  }>
}

describe('Phạm vi dữ liệu theo vai trò (A2/B1)', () => {
  it('SINH_VIÊN chỉ thấy hồ sơ của chính mình', async () => {
    const student = await prisma.user.findFirst({
      where: { role: 'SINH_VIEN', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const session = await login(student!.maSo)
    const rows = await mine(session.token)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.sinhVienId).toBe(student!.id)
    }
  })

  it('CỐ VẤN chỉ thấy hồ sơ của sinh viên lớp mình phụ trách', async () => {
    const cls = await prisma.class.findFirst({
      where: { coVanId: { not: null }, deletedAt: null },
      include: { coVan: true },
    })
    if (!cls?.coVan) return
    const session = await login(cls.coVan.maSo)
    const rows = await mine(session.token)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.sinhVien.coVanId).toBe(cls.coVanId)
    }
  })

  it('TRƯỞNG KHOA chỉ thấy hồ sơ thuộc khoa mình', async () => {
    const faculty = await prisma.faculty.findFirst({
      where: { truongKhoaId: { not: null }, deletedAt: null },
      include: { truongKhoa: true },
    })
    if (!faculty?.truongKhoa) return
    const session = await login(faculty.truongKhoa.maSo)
    const rows = await mine(session.token)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      if (row.sinhVien.khoa) expect(row.sinhVien.khoa).toBe(faculty.ten)
    }
  })

  it('PHÒNG ĐÀO TẠO thấy toàn trường (nhiều khoa, nhiều hơn một khoa đơn lẻ)', async () => {
    const pdt = await prisma.user.findFirst({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const session = await login(pdt!.maSo)
    const rows = await mine(session.token)

    expect(rows.length).toBeGreaterThan(0)
    const khoaSet = new Set(rows.map((r) => r.sinhVien.khoa).filter(Boolean))
    expect(khoaSet.size).toBeGreaterThan(1)

    // Nhiều hơn (hoặc bằng) số hồ sơ mà một trưởng khoa bất kỳ nhìn thấy.
    const faculty = await prisma.faculty.findFirst({
      where: { truongKhoaId: { not: null } },
      include: { truongKhoa: true },
    })
    if (faculty?.truongKhoa) {
      const tkSession = await login(faculty.truongKhoa.maSo)
      const tkRows = await mine(tkSession.token)
      expect(rows.length).toBeGreaterThanOrEqual(tkRows.length)
    }
  })

  it('TRƯỞNG KHOA bị chặn khi truy cập hồ sơ của khoa khác', async () => {
    const faculty = await prisma.faculty.findFirst({
      where: { truongKhoaId: { not: null }, deletedAt: null },
      include: { truongKhoa: true },
    })
    if (!faculty?.truongKhoa) return

    const other = await prisma.application.findFirst({
      where: { deletedAt: null, facultyId: { not: faculty.id }, classId: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    expect(other).not.toBeNull()
    if (!other) return

    const session = await login(faculty.truongKhoa.maSo)
    const res = await api()
      .get(`/api/v1/applications/${other.maHoSo}`)
      .set(bearer(session.token))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_SCOPE')
  })

  it('PHÒNG ĐÀO TẠO đọc được hồ sơ của mọi khoa', async () => {
    const pdt = await prisma.user.findFirst({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null },
      orderBy: { maSo: 'asc' },
    })
    const any = await prisma.application.findFirst({ where: { deletedAt: null } })
    const session = await login(pdt!.maSo)
    const res = await api()
      .get(`/api/v1/applications/${any!.maHoSo}`)
      .set(bearer(session.token))
    expect(res.status).toBe(200)
    expect(res.body.data.maHoSo).toBe(any!.maHoSo)
  })

  it('hộp thư chờ duyệt chỉ chứa hồ sơ đúng cấp xử lý', async () => {
    const faculty = await prisma.faculty.findFirst({
      where: { truongKhoaId: { not: null }, deletedAt: null },
      include: { truongKhoa: true },
    })
    if (!faculty?.truongKhoa) return

    const session = await login(faculty.truongKhoa.maSo)
    const res = await api()
      .get('/api/v1/approvals/pending?pageSize=100')
      .set(bearer(session.token))
    expect(res.status).toBe(200)

    for (const item of res.body.data as Array<{ buocHienTai: { role: string } | null }>) {
      if (item.buocHienTai) expect(item.buocHienTai.role).toBe('TRUONG_KHOA')
    }
  })
})
