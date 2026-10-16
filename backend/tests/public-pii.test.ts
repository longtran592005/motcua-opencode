import { describe, expect, it } from 'vitest'
import { api, bearer, login, prisma } from './helpers'

async function seededDocument() {
  const doc = await prisma.signedDocument.findFirst({
    where: { trangThai: 'VALID', deletedAt: null },
    orderBy: { ngayCap: 'desc' },
    include: {
      application: {
        select: {
          applicant: {
            select: { hoTen: true, maSo: true, email: true, soDienThoai: true },
          },
        },
      },
    },
  })
  if (!doc) throw new Error('Dữ liệu mẫu chưa có văn bản hợp lệ nào.')
  return doc
}

describe('API công khai — che dữ liệu cá nhân tại máy chủ (A3)', () => {
  it('tra cứu theo mã QR trả về họ tên/MSSV đã che, không có email/số điện thoại', async () => {
    const doc = await seededDocument()
    const real = doc.application.applicant

    const res = await api().get(`/api/v1/public/verify/token/${doc.tokenXacThuc}`)
    expect(res.status).toBe(200)

    const sv = res.body.data.vanBan.sinhVien
    expect(sv.hoTen).not.toBe(real.hoTen)
    expect(sv.hoTen).toContain('*')
    expect(sv.mssv).not.toBe(real.maSo)
    expect(sv.mssv).toContain('*')
    expect('email' in sv).toBe(false)
    expect('soDienThoai' in sv).toBe(false)

    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain(real.hoTen)
    expect(raw).not.toContain(real.maSo)
    expect(raw).not.toContain(real.email)
    if (real.soDienThoai) expect(raw).not.toContain(real.soDienThoai)
  })

  it('tra cứu theo số văn bản cũng được che dữ liệu', async () => {
    const doc = await seededDocument()
    const real = doc.application.applicant

    const res = await api().get(
      `/api/v1/public/verify/so-van-ban/${encodeURIComponent(doc.soVanBan)}`,
    )
    expect(res.status).toBe(200)
    expect(res.body.data.vanBan.sinhVien.hoTen).not.toBe(real.hoTen)
    expect(res.body.data.vanBan.sinhVien.mssv).not.toBe(real.maSo)
    expect(JSON.stringify(res.body)).not.toContain(real.email)
  })

  it('danh sách văn bản mới cấp không lộ bất kỳ họ tên đầy đủ nào', async () => {
    const res = await api().get('/api/v1/public/verify/recent?limit=20')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)

    const allNames = new Set(
      (await prisma.user.findMany({ select: { hoTen: true } })).map((u) => u.hoTen),
    )
    for (const item of res.body.data as Array<{ sinhVien: { hoTen: string; mssv: string } }>) {
      expect(allNames.has(item.sinhVien.hoTen)).toBe(false)
      expect(item.sinhVien.mssv).toContain('*')
      expect(item.sinhVien.hoTen).toContain('*')
    }
  })

  it('mã tra cứu không tồn tại → NOT_FOUND, không lộ chi tiết', async () => {
    const res = await api().get('/api/v1/public/verify/token/' + 'f'.repeat(64))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('đối chiếu mã băm không cần đăng nhập và vẫn che dữ liệu', async () => {
    const doc = await seededDocument()
    const res = await api()
      .post(`/api/v1/public/verify/token/${doc.tokenXacThuc}/compare`)
      .send({ maBamNguoiDung: doc.maBamSha256 })
    expect(res.status).toBe(200)
    expect(res.body.data.ketQuaDoiChieu.trungKhop).toBe(true)
    expect(res.body.data.vanBan.sinhVien.hoTen).toContain('*')
    expect(JSON.stringify(res.body)).not.toContain(doc.application.applicant.email)
  })

  it('đối chiếu với mã băm khác → trungKhop = false', async () => {
    const doc = await seededDocument()
    const res = await api()
      .post(`/api/v1/public/verify/token/${doc.tokenXacThuc}/compare`)
      .send({ maBamNguoiDung: 'b'.repeat(64) })
    expect(res.status).toBe(200)
    expect(res.body.data.ketQuaDoiChieu.trungKhop).toBe(false)
  })

  it('API nội bộ (đã đăng nhập) vẫn trả dữ liệu đầy đủ — che chỉ áp dụng cho API công khai', async () => {
    const doc = await seededDocument()
    const admin = await login('admin')
    const res = await api()
      .get(`/api/v1/documents?tuKhoa=${encodeURIComponent(doc.soVanBan)}`)
      .set(bearer(admin.token))
    expect(res.status).toBe(200)

    const found = (res.body.data as Array<{ soVanBan: string; sinhVien: { hoTen: string } }>).find(
      (d) => d.soVanBan === doc.soVanBan,
    )
    expect(found).toBeTruthy()
    expect(found!.sinhVien.hoTen).toBe(doc.application.applicant.hoTen)
  })
})
