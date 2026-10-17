import { execSync } from 'node:child_process'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { runIntegrityChecks } from '../../../scripts/check-integrity'

const containerName = 'motcua-postgres-test'
const restoreDbName = 'motcua_test_restore'
const restoreDbUrl = `postgresql://motcua:motcua@localhost:5434/${restoreDbName}?schema=public`
const originalDbUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Chu trình Sao lưu và Phục hồi (Backup & Restore Cycle)', () => {
  afterAll(() => {
    try {
      execSync(
        `docker exec ${containerName} sh -c "dropdb -U motcua --if-exists ${restoreDbName} && rm -f /tmp/backup_cycle.dump"`,
        { stdio: 'ignore' },
      )
    } catch {
      // Bỏ qua lỗi dọn dẹp sau kiểm thử
    }
  })

  it('Sao lưu (pg_dump), phục hồi (pg_restore) vào CSDL mới và xác thực độ khớp 100%', async () => {
    // 1. Dọn dẹp DB tạm nếu còn sót lại và tạo dump
    execSync(
      `docker exec ${containerName} sh -c "dropdb -U motcua --if-exists ${restoreDbName} && pg_dump -U motcua -d motcua_test -Fc -f /tmp/backup_cycle.dump"`,
      { encoding: 'utf8' },
    )

    // 2. Tạo database mới và phục hồi từ file dump
    execSync(
      `docker exec ${containerName} sh -c "createdb -U motcua ${restoreDbName} && pg_restore -U motcua -d ${restoreDbName} /tmp/backup_cycle.dump"`,
      { encoding: 'utf8' },
    )

    // 3. So sánh số lượng bảng và số bản ghi giữa 2 CSDL
    const clientOrig = new pg.Client({ connectionString: originalDbUrl })
    const clientRestored = new pg.Client({ connectionString: restoreDbUrl })

    await clientOrig.connect()
    await clientRestored.connect()

    try {
      const origTables = await clientOrig.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      )
      const restoredTables = await clientRestored.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      )

      expect(restoredTables.rows).toEqual(origTables.rows)

      // So sánh số dòng các bảng nghiệp vụ chính
      const tablesToCheck = ['users', 'applications', 'step_instances', 'approvals', 'workflow_definitions']
      for (const table of tablesToCheck) {
        const countOrig = await clientOrig.query<{ count: string }>(`SELECT count(*) FROM "${table}"`)
        const countRestored = await clientRestored.query<{ count: string }>(`SELECT count(*) FROM "${table}"`)
        expect(
          countRestored.rows[0].count,
          `Số bản ghi bảng ${table} phải khớp sau phục hồi`,
        ).toBe(countOrig.rows[0].count)
      }
    } finally {
      await clientOrig.end()
      await clientRestored.end()
    }

    // 4. Chạy kiểm tra toàn vẹn trên CSDL vừa phục hồi -> 0 vi phạm
    const violations = await runIntegrityChecks(restoreDbUrl)
    expect(violations.length).toBe(0)
  })
})
