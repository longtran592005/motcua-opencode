import pg from 'pg'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Quản lý Connection Pool và độ bền kết nối (Connection Pool & Resilience)', () => {
  it('GET /health: Báo cáo đúng trạng thái CSDL kết nối thành công và độ khả dụng', async () => {
    const app = createApp()
    const start = Date.now()
    const res = await request(app).get('/health')
    const latency = Date.now() - start

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.db).toBe(true)
    expect(res.body.data.ok).toBe(true)
    expect(typeof res.body.data.uptime).toBe('number')
    expect(latency).toBeLessThan(100)
  })

  it('Connection pool đầy: các truy vấn xếp hàng tuần tự và hoàn thành mà không làm treo tiến trình', async () => {
    // Tạo pool giới hạn chỉ 2 kết nối
    const smallPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 2,
    })

    try {
      // Bắn 6 truy vấn đồng thời vào pool 2 kết nối
      const results = await Promise.all(
        Array.from({ length: 6 }, async (_, i) => {
          const res = await smallPool.query<{ idx: number }>(`SELECT ${i}::int AS idx`)
          return res.rows[0].idx
        }),
      )

      expect(results).toEqual([0, 1, 2, 3, 4, 5])
    } finally {
      await smallPool.end()
    }
  })

  it('Connection timeout: ném lỗi rõ ràng khi hàng đợi vượt quá thời gian chờ, không treo server', async () => {
    // Pool 1 kết nối, timeout 300ms
    const tightPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 300,
    })

    try {
      const client = await tightPool.connect()
      let timedOut = false

      try {
        // Chiếm giữ kết nối 800ms
        const holdingPromise = client.query('SELECT pg_sleep(0.8)')

        // Truy vấn thứ 2 phải chờ và quá hạn 300ms
        await expect(tightPool.query('SELECT 1')).rejects.toThrow(/timeout/i)
        timedOut = true

        await holdingPromise
      } finally {
        client.release()
      }

      expect(timedOut).toBe(true)

      // Sau khi nhả kết nối, pool phục hồi và phục vụ bình thường
      const recoveredRes = await tightPool.query('SELECT 1 AS ok')
      expect(recoveredRes.rows[0].ok).toBe(1)
    } finally {
      await tightPool.end()
    }
  })
})
