import { describe, expect, it } from 'vitest'
import { api, bearer, login, prisma } from './helpers'

describe('Phiên đăng nhập — xoay vòng refresh token & phát hiện dùng lại', () => {
  it('refresh token xoay vòng: token mới khác token cũ và dùng được', async () => {
    const session = await login('20211234')

    const res = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })

    expect(res.status).toBe(200)
    expect(res.body.data.refreshToken).toBeTruthy()
    expect(res.body.data.refreshToken).not.toBe(session.refreshToken)
    expect(res.body.data.token).toBeTruthy()

    const me = await api().get('/api/v1/auth/me').set(bearer(res.body.data.token))
    expect(me.status).toBe(200)
  })

  it('refresh token cũ bị từ chối sau khi đã xoay vòng', async () => {
    const session = await login('cv001')

    const first = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
    expect(first.status).toBe(200)

    const reuse = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe('UNAUTHORIZED')
  })

  it('phát hiện dùng lại token cũ → thu hồi TOÀN BỘ phiên của người dùng', async () => {
    const user = await prisma.user.findFirst({
      where: { maSo: { equals: 'tk001', mode: 'insensitive' } },
    })
    const session = await login('tk001')

    const rotated = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
    expect(rotated.status).toBe(200)
    const newToken = rotated.body.data.refreshToken as string

    // Dùng lại token cũ (đã bị thu hồi) → kích hoạt phát hiện dùng lại.
    const reuse = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
    expect(reuse.status).toBe(401)

    // Token mới cũng phải bị vô hiệu do toàn bộ phiên đã bị thu hồi.
    const afterRevoke = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: newToken })
    expect(afterRevoke.status).toBe(401)

    const conHieuLuc = await prisma.refreshToken.count({
      where: { userId: user!.id, daThuHoi: false },
    })
    expect(conHieuLuc).toBe(0)

    const nhat = await prisma.auditLog.findFirst({
      where: { hanhDong: 'REFRESH_REUSE_DETECTED', doiTuongId: user!.id },
      orderBy: { luc: 'desc' },
    })
    expect(nhat).not.toBeNull()
  })

  it('refresh token không tồn tại → 401', async () => {
    const res = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'a'.repeat(64) })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('đăng xuất thu hồi toàn bộ refresh token của người dùng', async () => {
    const session = await login('pdt001')

    const out = await api().post('/api/v1/auth/logout').set(bearer(session.token))
    expect(out.status).toBe(204)

    const res = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
    expect(res.status).toBe(401)
  })

  it('refresh token chỉ được lưu dưới dạng băm, không lưu mã thô', async () => {
    const session = await login('20211234')
    const row = await prisma.refreshToken.findFirst({
      where: { userId: session.user.id, daThuHoi: false },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
    expect(row!.tokenHash).not.toBe(session.refreshToken)
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
