import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Sinh mã hồ sơ đồng thời và reset theo năm (Sequence & Concurrency)', () => {
  let pool: pg.Pool

  beforeAll(() => {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 20,
    })
  })

  afterAll(async () => {
    await pool.end()
  })

  it('200 lệnh gọi đồng thời sinh ma_ho_so không trùng lặp và đúng định dạng MC-YYYY-NNNNNN', async () => {
    // Đảm bảo năm hiện tại đã được đồng bộ trước khi chạy đồng thời
    await pool.query('UPDATE application_code_year SET nam = EXTRACT(YEAR FROM now())::int')

    const totalCalls = 200
    const promises = Array.from({ length: totalCalls }, async () => {
      const res = await pool.query<{ next_ma_ho_so: string }>('SELECT next_ma_ho_so()')
      return res.rows[0].next_ma_ho_so
    })

    const codes = await Promise.all(promises)

    // Kiểm tra định dạng
    for (const code of codes) {
      expect(code).toMatch(/^MC-\d{4}-\d{6}$/)
    }

    // Không trùng lặp
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(totalCalls)

    // Trích xuất số thứ tự
    const numbers = codes.map((c) => parseInt(c.split('-')[2], 10))
    const min = Math.min(...numbers)
    const max = Math.max(...numbers)

    // 200 số liên tiếp nhau không có khe hở
    expect(max - min + 1).toBe(totalCalls)
  })

  it('Chuyển sang năm mới (mock clock) -> sequence reset về 000001 cho năm mới', async () => {
    const client = await pool.connect()
    try {
      // Giả lập năm 2030 bằng GUC motcua.now
      await client.query("SET motcua.now = '2030-01-01 00:00:00+07'")
      const res2030 = await client.query<{ next_ma_ho_so: string }>('SELECT next_ma_ho_so()')
      expect(res2030.rows[0].next_ma_ho_so).toBe('MC-2030-000001')

      const res2030Next = await client.query<{ next_ma_ho_so: string }>('SELECT next_ma_ho_so()')
      expect(res2030Next.rows[0].next_ma_ho_so).toBe('MC-2030-000002')

      // Reset lại đồng hồ bình thường và cập nhật lại năm thực tế
      await client.query("SET motcua.now = ''")
      await client.query('UPDATE application_code_year SET nam = EXTRACT(YEAR FROM now())::int')
    } finally {
      client.release()
    }
  })
})
