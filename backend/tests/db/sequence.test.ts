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

  // Q3: bảo vệ chống lệch sequence (mã seed viết tay làm sequence thấp hơn max mã).
  it('Bảo vệ (Q3): sequence ≥ max mã hồ sơ của năm và 5 mã sinh mới không trùng', async () => {
    // Đồng bộ sequence theo dữ liệu hiện có trước khi kiểm tra.
    await pool.query('SELECT sync_ma_ho_so_sequence()')

    const year = new Date().getFullYear()
    const seqRes = await pool.query<{ last_value: string; is_called: boolean }>(
      'SELECT last_value, is_called FROM application_code_seq',
    )
    const lastValue = BigInt(seqRes.rows[0].last_value)
    const isCalled = seqRes.rows[0].is_called
    // nextval() kế tiếp trả về last_value + 1 nếu is_called, ngược lại là last_value.
    const nextValue = isCalled ? lastValue + 1n : lastValue

    const maxRes = await pool.query<{ max_num: string | null }>(
      `SELECT MAX(substring(ma_ho_so FROM '^MC-${year}-(\\d+)$')::bigint)::text AS max_num
         FROM applications`,
    )
    const maxCode = BigInt(maxRes.rows[0].max_num ?? '0')

    // Sequence phải "đi trước" mọi mã hồ sơ đang tồn tại của năm ⇒ không bao giờ trùng.
    expect(nextValue).toBeGreaterThan(maxCode)

    // Sinh 5 mã mới: không trùng nhau, không trùng mã đã có trong CSDL.
    const codes: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const r = await pool.query<{ next_ma_ho_so: string }>('SELECT next_ma_ho_so()')
      codes.push(r.rows[0].next_ma_ho_so)
    }
    expect(new Set(codes).size).toBe(5)
    for (const code of codes) {
      expect(code).toMatch(new RegExp(`^MC-${year}-\\d{6}$`))
    }
    const clash = await pool.query<{ n: string }>(
      'SELECT count(*)::text AS n FROM applications WHERE ma_ho_so = ANY($1::text[])',
      [codes],
    )
    expect(clash.rows[0].n).toBe('0')

    // Trả sequence về đúng trạng thái đã đồng bộ (5 mã vừa sinh chỉ để kiểm tra).
    await pool.query('SELECT sync_ma_ho_so_sequence()')
  })
})
