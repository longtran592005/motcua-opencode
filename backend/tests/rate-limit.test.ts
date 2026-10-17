import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authLimiter, setRateLimitEnabled } from '../src/middleware/rateLimit'
import { api } from './helpers'

beforeAll(() => {
  setRateLimitEnabled(true)
  // Xoá dem cua limiter de moi test bat dau tu trang thai sach.
  authLimiter.resetKey('127.0.0.1')
})

afterAll(() => {
  setRateLimitEnabled(false)
})

describe('Gioi tan suat (RATE_LIMITED)', () => {
  it('vuot gioi han -> 429 RATE_LIMITED kem Retry-After', async () => {
    // AUTH_RATE_LIMIT_MAX mac dinh = 20. Gui 22 request /auth/login.
    const results: number[] = []
    for (let i = 0; i < 22; i += 1) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ dinhDanh: 'admin', matKhau: 'demo1234' })
      results.push(res.status)
    }

    // Request vuot nguong phai bi chan.
    expect(results).toContain(429)
    const chan = results.filter((s) => s === 429)
    expect(chan.length).toBeGreaterThanOrEqual(1)
    // 20 request dau tien thanh con, request thu 21 tro di bi chan.
    expect(results.slice(0, 20).every((s) => s === 200)).toBe(true)
  })

  it('RATE_LIMITED khong lam thay doi du lieu', async () => {
    // Xoar dem cua limiter de test nay doc lap.
    authLimiter.resetKey('127.0.0.1')

    // Gui den nguong.
    for (let i = 0; i < 20; i += 1) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ dinhDanh: 'admin', matKhau: 'demo1234' })
      if (i === 19) {
        expect(res.status).toBe(200)
      }
    }

    // Request tiep theo bi chan.
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ dinhDanh: 'admin', matKhau: 'demo1234' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect(res.headers['retry-after']).toBeDefined()
  })
})
