import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

interface PlanNode {
  'Node Type': string
  'Index Name'?: string
  Plans?: PlanNode[]
}

interface ExplainResult {
  Plan: PlanNode
  'Execution Time': number
}

function collectNodeTypes(node?: PlanNode): string[] {
  if (!node) return []
  const types = [node['Node Type']]
  if (Array.isArray(node.Plans)) {
    for (const child of node.Plans) {
      types.push(...collectNodeTypes(child))
    }
  }
  return types
}

describe('CSDL — Kế hoạch thực thi và hiệu năng truy vấn (Benchmark & EXPLAIN ANALYZE)', () => {
  let pool: pg.Pool

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 5 })
  })

  afterAll(async () => {
    await pool.end()
  })

  it('Tra cứu hồ sơ theo mã hồ sơ (ma_ho_so): dùng Index Scan và thời gian < 100ms', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET enable_seqscan = OFF')

      const sample = await client.query<{ ma_ho_so: string }>(
        'SELECT ma_ho_so FROM applications LIMIT 1',
      )
      const maHoSo = sample.rows[0]?.ma_ho_so ?? 'MC-2026-000001'

      const explainRes = await client.query<{ 'QUERY PLAN': string }>(
        'EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM applications WHERE ma_ho_so = $1',
        [maHoSo],
      )

      const rawPlan = explainRes.rows[0]['QUERY PLAN']
      const planObj = (typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan) as ExplainResult[]
      const rootPlan = planObj[0]?.Plan
      const executionTime = planObj[0]?.['Execution Time'] ?? 0

      const allTypes = collectNodeTypes(rootPlan).join(' ')
      expect(allTypes).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan/)
      expect(executionTime).toBeLessThan(100)
    } finally {
      await client.query('SET enable_seqscan = ON')
      client.release()
    }
  })

  it('Danh sách hồ sơ của sinh viên (applicant_id + trang_thai): dùng Index Scan và thời gian < 100ms', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET enable_seqscan = OFF')

      const sampleUser = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE role = 'SINH_VIEN' LIMIT 1",
      )
      const userId = sampleUser.rows[0]?.id

      const explainRes = await client.query<{ 'QUERY PLAN': string }>(
        'EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM applications WHERE applicant_id = $1 AND trang_thai = $2',
        [userId, 'SUBMITTED'],
      )

      const rawPlan = explainRes.rows[0]['QUERY PLAN']
      const planObj = (typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan) as ExplainResult[]
      const rootPlan = planObj[0]?.Plan
      const executionTime = planObj[0]?.['Execution Time'] ?? 0

      const allTypes = collectNodeTypes(rootPlan).join(' ')
      expect(allTypes).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan|Bitmap Heap Scan/)
      expect(executionTime).toBeLessThan(100)
    } finally {
      await client.query('SET enable_seqscan = ON')
      client.release()
    }
  })

  it('Hộp thư việc cần xử lý của cán bộ (role + trang_thai + sla_due_at): dùng Index Scan và < 100ms', async () => {
    const client = await pool.connect()
    try {
      await client.query('SET enable_seqscan = OFF')

      const explainRes = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, FORMAT JSON)
         SELECT * FROM step_instances
         WHERE role = 'CO_VAN' AND trang_thai = 'PENDING'
         ORDER BY sla_due_at ASC`,
      )

      const rawPlan = explainRes.rows[0]['QUERY PLAN']
      const planObj = (typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan) as ExplainResult[]
      const rootPlan = planObj[0]?.Plan
      const executionTime = planObj[0]?.['Execution Time'] ?? 0

      const allTypes = collectNodeTypes(rootPlan).join(' ')
      expect(allTypes).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan|Bitmap Heap Scan/)
      expect(executionTime).toBeLessThan(100)
    } finally {
      await client.query('SET enable_seqscan = ON')
      client.release()
    }
  })
})
