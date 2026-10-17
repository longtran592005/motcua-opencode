import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

const backendDir = resolve(__dirname, '../..')
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Kiểm tra Migration và tính lũy đẳng (Migration Idempotency)', () => {
  it('prisma migrate diff: schema.prisma và migration history khớp 100% (zero drift)', () => {
    // So sánh schema datamodel với CSDL thực tế đang chạy
    const output = execFileSync(
      'npx',
      [
        'prisma',
        'migrate',
        'diff',
        '--from-schema-datamodel',
        'prisma/schema.prisma',
        '--to-url',
        databaseUrl,
        '--exit-code',
      ],
      {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
        shell: true,
      },
    )

    expect(output).toContain('No difference detected')
  })

  it('prisma migrate deploy: chạy lại trên CSDL đã cập nhật không gây lỗi (lũy đẳng / no-op)', () => {
    const output = execFileSync(
      'npx',
      ['prisma', 'migrate', 'deploy'],
      {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
        shell: true,
      },
    )

    expect(output).toContain('No pending migrations to apply')
  })

  it('Bảng _prisma_migrations ghi nhận đủ 6 migration hoàn thành và không có rollback', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC`

    expect(rows.length).toBeGreaterThanOrEqual(6)
    for (const r of rows) {
      expect(r.finished_at).not.toBeNull()
      expect(r.rolled_back_at).toBeNull()
    }
  })
})
