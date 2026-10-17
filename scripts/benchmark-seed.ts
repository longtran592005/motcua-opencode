/**
 * Benchmark seed — TAO va DO LUONG, sau do DON SACH.
 *
 * Tao 2.000 user + 10.000 application du trang thai + step_instances + approvals
 * chay ANALYZE -> do EXPLAIN (ANALYZE, BUFFERS) 5 truy van -> in ket qua -> xoa.
 *
 *   npx tsx scripts/benchmark-seed.ts
 *
 * KHONG lan vao seed thuong. Chi chay tren CSDL test (URL phai chua "test").
 */
import { randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { assertTestDatabaseUrl } from './lib/assert-test-db'

const DATABASE_URL = assertTestDatabaseUrl()

const BATCH = 500
const N_USERS = 2_000
const N_APPS = 10_000
const STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'NEED_SUPPLEMENT',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
]

const TAG = `BM_${Date.now()}`

interface QueryPlan {
  Plan: PlanNode
  'Execution Time': number
  'Planning Time': number
}

interface PlanNode {
  'Node Type': string
  Plans?: PlanNode[]
  'Actual Total Time'?: number
}

function collectNodeTypes(node?: PlanNode): string[] {
  if (!node) return []
  const types = [node['Node Type']]
  for (const child of node.Plans ?? []) types.push(...collectNodeTypes(child))
  return types
}

async function run(): Promise<void> {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
  const client = await pool.connect()

  console.log(`\n=== BENCHMARK SEED [${TAG}] ===`)
  console.log(`DATABASE: ${DATABASE_URL.replace(/:([^:@/]+)@/, ':***@')}`)

  const reqTypeRes = await client.query<{ id: string }>('SELECT id FROM request_types LIMIT 1')
  if (!reqTypeRes.rows[0]) throw new Error('Can it nhat 1 request_type trong CSDL test.')
  const reqTypeId = reqTypeRes.rows[0].id

  const wfStepRes = await client.query<{ id: string; role: string; mode: string }>(
    "SELECT id, role, mode FROM workflow_steps LIMIT 1",
  )
  const wfStep = wfStepRes.rows[0]

  console.log('\n--- So dong truoc khi seed ---')
  const tables = ['users', 'applications', 'step_instances', 'approvals', 'notifications', 'audit_logs']
  for (const t of tables) {
    const r = await client.query<{ c: string }>(`SELECT count(*) AS c FROM ${t}`)
    console.log(`  ${t.padEnd(20)} ${r.rows[0].c.padStart(8)} dong`)
  }

  console.log(`\nTao ${N_USERS} users...`)
  const userIds: string[] = []
  let inserted = 0
  while (inserted < N_USERS) {
    const batchSize = Math.min(BATCH, N_USERS - inserted)
    const values: string[] = []
    const params: unknown[] = []
    let p = 1
    for (let i = 0; i < batchSize; i++) {
      const id = randomUUID()
      userIds.push(id)
      const ms = `BM${String(inserted + i + 1).padStart(7, '0')}`
      const email = `bm${inserted + i + 1}${TAG.toLowerCase()}@test.local`
      const role = i % 5 === 0 ? 'CO_VAN' : i % 5 === 1 ? 'TRUONG_KHOA' : 'SINH_VIEN'
      // password_hash la gia tri bcrypt mau (khong dung o production)
      const pwHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      values.push(`($${p++}::uuid,$${p++},$${p++},$${p++},$${p++},$${p++},'ACTIVE',now(),now())`)
      params.push(id, ms, email, `BM User ${inserted + i + 1}`, pwHash, role)
    }
    await client.query(
      `INSERT INTO users (id, ma_so, email, ho_ten, password_hash, role, trang_thai, created_at, updated_at) VALUES ${values.join(',')}`,
      params,
    )
    inserted += batchSize
    process.stdout.write(`\r  Da tao ${inserted}/${N_USERS} users`)
  }
  console.log()

  console.log(`\nTao ${N_APPS} applications...`)
  const appIds: string[] = []
  inserted = 0
  // Khong insert vao application_code_year -- chi ghi nhan nam, khong phai sequence counter

  while (inserted < N_APPS) {
    const batchSize = Math.min(BATCH, N_APPS - inserted)
    const values: string[] = []
    const params: unknown[] = []
    let p = 1
    for (let i = 0; i < batchSize; i++) {
      const id = randomUUID()
      appIds.push(id)
      const idx = inserted + i + 1
      // Dung offset 900000 de tranh xung dot voi du lieu seed (seq < 1000)
      const seq = String(900000 + idx).padStart(6, '0')
      const maHoSo = `MC-2026-${seq}`
      const status = STATUSES[idx % STATUSES.length]
      const applicantId = userIds[idx % userIds.length]
      // current_step_order: 1 cho PENDING_APPROVAL, 0 cho cac trang thai khac (NOT NULL)
      const stepOrder = status === 'PENDING_APPROVAL' ? 1 : 0
      values.push(
        `($${p++}::uuid,$${p++},$${p++}::uuid,$${p++}::uuid,$${p++},$${p++},'{}'::jsonb,now(),now())`,
      )
      params.push(id, maHoSo, applicantId, reqTypeId, status, stepOrder)
    }
    await client.query(
      `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, current_step_order, du_lieu, created_at, updated_at) VALUES ${values.join(',')}`,
      params,
    )
    inserted += batchSize
    process.stdout.write(`\r  Da tao ${inserted}/${N_APPS} applications`)
  }
  console.log()

  const pendingApps = appIds.filter((_, i) =>
    STATUSES[(i + 1) % STATUSES.length] === 'PENDING_APPROVAL' ||
    STATUSES[i % STATUSES.length] === 'PENDING_APPROVAL',
  )
  const role = wfStep?.role ?? 'CO_VAN'
  const mode = wfStep?.mode ?? 'ONE_CLICK'
  const assigneeId = userIds[0]

  if (pendingApps.length > 0) {
    console.log(`\nTao ${pendingApps.length} step_instances...`)
    let siInserted = 0
    while (siInserted < pendingApps.length) {
      const batchSize = Math.min(BATCH, pendingApps.length - siInserted)
      const values: string[] = []
      const params: unknown[] = []
      let p = 1
      for (let i = 0; i < batchSize; i++) {
        values.push(
          `($${p++}::uuid,$${p++}::uuid,1,'Buoc xu ly',$${p++},$${p++},'PENDING',$${p++}::uuid,now(),now())`,
        )
        params.push(randomUUID(), pendingApps[siInserted + i], role, mode, assigneeId)
      }
      await client.query(
        `INSERT INTO step_instances (id, application_id, step_order, ten, role, mode, trang_thai, assignee_id, created_at, updated_at) VALUES ${values.join(',')}`,
        params,
      )
      siInserted += batchSize
      process.stdout.write(`\r  Da tao ${siInserted}/${pendingApps.length} step_instances`)
    }
    console.log()
  }

  const completedApps = appIds.filter((_, i) => STATUSES[(i + 1) % STATUSES.length] === 'COMPLETED')
  if (completedApps.length > 0) {
    console.log(`\nTao ${completedApps.length} approvals...`)
    let apInserted = 0
    while (apInserted < completedApps.length) {
      const batchSize = Math.min(BATCH, completedApps.length - apInserted)
      const values: string[] = []
      const params: unknown[] = []
      let p = 1
      for (let i = 0; i < batchSize; i++) {
        values.push(`($${p++}::uuid,$${p++}::uuid,$${p++}::uuid,1,'APPROVE','CO_VAN',now())`)
        params.push(randomUUID(), completedApps[apInserted + i], assigneeId)
      }
      await client.query(
        `INSERT INTO approvals (id, application_id, actor_id, buoc_order, hanh_dong, vai_tro, created_at) VALUES ${values.join(',')}`,
        params,
      )
      apInserted += batchSize
      process.stdout.write(`\r  Da tao ${apInserted}/${completedApps.length} approvals`)
    }
    console.log()
  }

  const sampleToken = randomBytes(32).toString('hex')
  const sampleSha = randomBytes(32).toString('hex')
  const sampleAppId = appIds[0]
  await client.query(
    `INSERT INTO signed_documents
       (id, application_id, so_van_ban, trich_yeu, loai_van_ban, noi_dung, sinh_vien_snapshot,
        token_xac_thuc, ma_bam_sha256, trang_thai, ngay_cap, created_at, updated_at)
     VALUES ($1::uuid,$2::uuid,'VB-BM-001','Benchmark doc','GIAY_XAC_NHAN','Noi dung bm','{}',
             $3,$4,'VALID',now(),now(),now())
     ON CONFLICT DO NOTHING`,
    [randomUUID(), sampleAppId, sampleToken, sampleSha],
  )

  console.log('\nChay ANALYZE...')
  await client.query('ANALYZE')

  console.log('\n--- So dong sau khi seed ---')
  for (const t of tables) {
    const r = await client.query<{ c: string }>(`SELECT count(*) AS c FROM ${t}`)
    console.log(`  ${t.padEnd(20)} ${r.rows[0].c.padStart(8)} dong`)
  }

  console.log('\n=== KET QUA EXPLAIN (ANALYZE, BUFFERS) ===\n')

  const queries: Array<{ name: string; sql: string; params: unknown[] }> = [
    {
      name: 'Q1: Tra cuu theo ma_ho_so',
      sql: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM applications WHERE ma_ho_so = $1',
      params: ['MC-2026-000001'],
    },
    {
      name: 'Q2: Danh sach don cua sinh vien',
      sql: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM applications WHERE applicant_id = $1 ORDER BY created_at DESC LIMIT 20',
      params: [userIds[0]],
    },
    {
      name: 'Q3: Hop thu cho duyet (step_instances.role + trang_thai)',
      sql: "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM step_instances WHERE role = 'CO_VAN' AND trang_thai = 'PENDING' ORDER BY sla_due_at ASC NULLS LAST LIMIT 50",
      params: [],
    },
    {
      name: 'Q4: Tra cuu theo verify_token',
      sql: 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT * FROM signed_documents WHERE token_xac_thuc = $1',
      params: [sampleToken],
    },
    {
      name: 'Q5: Thong ke bao cao (COUNT theo trang_thai, ngay)',
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
            SELECT date_trunc('day', created_at) AS ngay, trang_thai, count(*) AS so_luong
            FROM applications
            WHERE created_at >= now() - interval '30 days'
            GROUP BY 1, 2 ORDER BY 1 DESC`,
      params: [],
    },
  ]

  const slowQueries: string[] = []

  for (const q of queries) {
    const res = await client.query<{ 'QUERY PLAN': string }>(q.sql, q.params)
    const raw = res.rows[0]['QUERY PLAN']
    const plan = (typeof raw === 'string' ? JSON.parse(raw) : raw) as QueryPlan[]
    const execTime = plan[0]?.['Execution Time'] ?? 0
    const planTime = plan[0]?.['Planning Time'] ?? 0
    const nodeTypes = collectNodeTypes(plan[0]?.Plan).join(', ')
    const flag = execTime > 100 ? '[CHAM]' : '[OK]  '
    console.log(`${flag} ${q.name}`)
    console.log(`       Execution Time : ${execTime.toFixed(2)} ms`)
    console.log(`       Planning Time  : ${planTime.toFixed(2)} ms`)
    console.log(`       Node Types     : ${nodeTypes}`)
    console.log()
    if (execTime > 100) {
      slowQueries.push(`${q.name} -- ${execTime.toFixed(2)} ms`)
    }
  }

  if (slowQueries.length > 0) {
    console.log('=== DE XUAT INDEX (truy van > 100ms) ===')
    for (const s of slowQueries) console.log(`  - ${s} => them index composite phu hop`)
    console.log()
  } else {
    console.log('Tat ca truy van duoi 100 ms -- khong can them index.\n')
  }

  console.log('Don dep du lieu benchmark...')
  await client.query('DELETE FROM approvals WHERE actor_id = ANY($1::uuid[])', [userIds])
  await client.query('DELETE FROM step_instances WHERE assignee_id = ANY($1::uuid[])', [userIds])
  const chunks: string[][] = []
  for (let i = 0; i < appIds.length; i += 1000) chunks.push(appIds.slice(i, i + 1000))
  for (const chunk of chunks) {
    await client.query('DELETE FROM signed_documents WHERE application_id = ANY($1::uuid[])', [chunk])
    await client.query('DELETE FROM applications WHERE id = ANY($1::uuid[])', [chunk])
  }
  await client.query("DELETE FROM users WHERE ma_so LIKE 'BM%'")
  console.log('Don sach hoan tat.')

  client.release()
  await pool.end()
}

run().catch((err) => {
  console.error('Loi benchmark:', err)
  process.exit(1)
})
