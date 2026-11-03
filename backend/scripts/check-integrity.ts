import pg from 'pg'
import { prisma } from '../src/lib/prisma'

type Queryable = {
  query: (text: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export type IntegrityViolation = {
  ma: string
  moTa: string
  soLuong: number
}

const RULES: Array<[string, string, string]> = [
  [
    'COMPLETED_THIEU_VAN_BAN',
    'Hồ sơ COMPLETED phải có văn bản',
    `SELECT count(*)::int AS count FROM applications a
     WHERE a.trang_thai = 'COMPLETED'
       AND NOT EXISTS (SELECT 1 FROM signed_documents d WHERE d.application_id = a.id)`,
  ],
  [
    'COMPLETED_THIEU_APPROVAL_BAT_BUOC',
    'Bước APPROVED phải có approval',
    `SELECT count(*)::int AS count FROM step_instances si
     JOIN applications a ON a.id = si.application_id
     WHERE a.trang_thai = 'COMPLETED' AND si.trang_thai = 'APPROVED'
       AND NOT EXISTS (
         SELECT 1 FROM approvals ap
         WHERE ap.step_instance_id = si.id AND ap.hanh_dong = 'APPROVE'
       )`,
  ],
  [
    'PENDING_THIEU_BUOC_HIEN_TAI',
    'Hồ sơ chờ duyệt phải có bước hiện tại',
    `SELECT count(*)::int AS count FROM applications a
     WHERE a.trang_thai IN ('SUBMITTED', 'PENDING_APPROVAL')
       AND NOT EXISTS (
         SELECT 1 FROM step_instances si
         WHERE si.application_id = a.id AND si.step_order = a.current_step_order
       )`,
  ],
  [
    'STEP_PENDING_THIEU_ASSIGNEE',
    'Bước đang mở phải có người phụ trách',
    `SELECT count(*)::int AS count FROM step_instances si
     JOIN applications a ON a.id = si.application_id
     WHERE a.trang_thai IN ('SUBMITTED', 'PENDING_APPROVAL')
       AND si.step_order = a.current_step_order
       AND si.trang_thai IN ('PENDING', 'IN_PROGRESS')
       AND si.assignee_id IS NULL`,
  ],
  [
    'HAI_BUOC_DANG_MO',
    'Một hồ sơ không được có hai bước đang mở',
    `SELECT count(*)::int AS count FROM (
       SELECT application_id FROM step_instances
       WHERE trang_thai = 'IN_PROGRESS'
       GROUP BY application_id HAVING count(*) > 1
     ) x`,
  ],
  [
    'OTP_DA_DUNG_THIEU_APPROVAL',
    'OTP đã dùng phải có approval tương ứng',
    `SELECT count(*)::int AS count FROM otp_challenges o
     WHERE o.da_dung = true
       AND NOT EXISTS (
         SELECT 1 FROM approvals a
         WHERE a.application_id = o.application_id
           AND a.buoc_order = o.step_order
           AND a.hanh_dong = 'APPROVE'
       )`,
  ],
  [
    'LUOT_TAI_AM',
    'Lượt tải tài liệu không được âm',
    `SELECT count(*)::int AS count FROM library_documents WHERE luot_tai < 0`,
  ],
]

export async function runIntegrityChecks(source: string | Queryable): Promise<IntegrityViolation[]> {
  let client: Queryable
  let owned = false
  if (typeof source === 'string') {
    client = new pg.Pool({ connectionString: source })
    owned = true
  } else {
    client = source
  }

  try {
    const violations: IntegrityViolation[] = []
    for (const [ma, moTa, sql] of RULES) {
      const result = await client.query(sql)
      const soLuong = Number(result.rows[0]?.count ?? 0)
      if (soLuong > 0) violations.push({ ma, moTa, soLuong })
    }
    return violations
  } finally {
    if (owned) await (client as pg.Pool).end()
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const violations = await runIntegrityChecks(process.env.DATABASE_URL ?? '')
  if (violations.length === 0) {
    console.log('PASS\tintegrity\t0 violations')
  } else {
    for (const violation of violations) {
      console.error(`FAIL\t${violation.ma}\t${violation.soLuong}\t${violation.moTa}`)
    }
    process.exitCode = 1
  }
  await prisma.$disconnect()
}
