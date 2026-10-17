import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

const backendDir = resolve(__dirname, '../..')
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Kiểm tra tính lũy đẳng và chất lượng dữ liệu Seed', () => {
  it('Chạy seed lần 2 thành công mà không gây lỗi khóa trùng hay vi phạm ràng buộc', () => {
    // Chạy seed.ts thông qua tsx
    const output = execFileSync(
      'npx',
      ['tsx', 'prisma/seed.ts'],
      {
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NODE_ENV: 'test',
        },
        encoding: 'utf8',
        shell: true,
      },
    )

    // Seed chạy thành công không ném ngoại lệ
    expect(output).toBeDefined()
  })

  it('Số lượng bản ghi tối thiểu thỏa mãn yêu cầu nghiệp vụ', async () => {
    const [rolesCount, usersCount, workflowsCount, requestTypesCount, academicYearsCount] =
      await Promise.all([
        prisma.user.groupBy({ by: ['role'] }),
        prisma.user.count(),
        prisma.workflow.count({
          where: { steps: { some: {} } },
        }),
        prisma.requestType.count(),
        prisma.academicYear.count(),
      ])

    // >= 5 roles
    expect(rolesCount.length).toBeGreaterThanOrEqual(5)
    // >= 6 users mẫu
    expect(usersCount).toBeGreaterThanOrEqual(6)
    // >= 2 workflows hoàn chỉnh các bước
    expect(workflowsCount).toBeGreaterThanOrEqual(2)
    // >= 5 request types
    expect(requestTypesCount).toBeGreaterThanOrEqual(5)
    // >= 1 calendar / năm học
    expect(academicYearsCount).toBeGreaterThanOrEqual(1)
  })

  it('Không có foreign key mồ côi qua các quan hệ chính', async () => {
    const orphanChecks = await prisma.$queryRaw<Array<{ rel: string; orphan_count: bigint }>>`
      SELECT 'applications -> applicant' AS rel, count(*)::bigint AS orphan_count
      FROM applications a LEFT JOIN users u ON a.applicant_id = u.id WHERE u.id IS NULL
      UNION ALL
      SELECT 'applications -> request_type', count(*)::bigint
      FROM applications a LEFT JOIN request_types r ON a.request_type_id = r.id WHERE r.id IS NULL
      UNION ALL
      SELECT 'step_instances -> application', count(*)::bigint
      FROM step_instances s LEFT JOIN applications a ON s.application_id = a.id WHERE a.id IS NULL
      UNION ALL
      SELECT 'approvals -> application', count(*)::bigint
      FROM approvals ap LEFT JOIN applications a ON ap.application_id = a.id WHERE a.id IS NULL
      UNION ALL
      SELECT 'students -> user', count(*)::bigint
      FROM students s LEFT JOIN users u ON s.user_id = u.id WHERE u.id IS NULL
      UNION ALL
      SELECT 'students -> class', count(*)::bigint
      FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE c.id IS NULL
      UNION ALL
      SELECT 'classes -> major', count(*)::bigint
      FROM classes c LEFT JOIN majors m ON c.major_id = m.id WHERE m.id IS NULL
      UNION ALL
      SELECT 'classes -> academic_year', count(*)::bigint
      FROM classes c LEFT JOIN academic_years ay ON c.academic_year_id = ay.id WHERE ay.id IS NULL
    `

    for (const check of orphanChecks) {
      expect(Number(check.orphan_count), `Mồ côi trên quan hệ ${check.rel}`).toBe(0)
    }
  })

  it('Seed từ chối chạy khi NODE_ENV=production', () => {
    let failed = false
    let output = ''
    try {
      output = execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NODE_ENV: 'production',
        },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      })
    } catch (err: unknown) {
      failed = true
      const errorOutput =
        (err as { stderr?: string; stdout?: string }).stderr ||
        (err as { stderr?: string; stdout?: string }).stdout ||
        ''
      expect(errorOutput).toContain('TỪ CHỐI CHẠY SEED: NODE_ENV=production')
    }
    expect(failed).toBe(true)
  })

  it('Mọi mật khẩu mẫu đều được băm bằng bcrypt, không chứa mật khẩu dạng plaintext', async () => {
    const users = await prisma.user.findMany({
      select: { id: true, maSo: true, passwordHash: true },
    })

    expect(users.length).toBeGreaterThan(0)
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}$/)
      expect(u.passwordHash).not.toContain('demo1234')
      expect(u.passwordHash).not.toContain('123456')
    }
  })
})
