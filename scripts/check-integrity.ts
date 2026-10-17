/**
 * Kiểm tra toàn vẹn dữ liệu nghiệp vụ — chạy được trên CSDL bất kỳ.
 *
 *   npx tsx scripts/check-integrity.ts
 *   npx tsx scripts/check-integrity.ts --json
 *
 * Mã thoát 0 khi không có vi phạm; khác 0 khi có.
 * Không sửa dữ liệu.
 */
import pg from 'pg'
import { maskDbUrl } from './lib/assert-test-db'

export interface Violation {
  ma: string
  moTa: string
  soLuong: number
  viDu: unknown[]
}

const CHECKS: Array<{ ma: string; moTa: string; sql: string }> = [
  {
    ma: 'COMPLETED_THIEU_VAN_BAN',
    moTa: 'Đơn đã hoàn thành phải có đúng 1 văn bản',
    sql: `SELECT a.ma_ho_so AS "maHoSo", a.trang_thai AS "trangThai",
                 (SELECT count(*) FROM signed_documents d WHERE d.application_id = a.id AND d.deleted_at IS NULL) AS "soVanBan"
          FROM applications a
          WHERE a.deleted_at IS NULL AND a.trang_thai = 'COMPLETED'
            AND (SELECT count(*) FROM signed_documents d WHERE d.application_id = a.id AND d.deleted_at IS NULL) <> 1`,
  },
  {
    ma: 'COMPLETED_THIEU_APPROVAL_BAT_BUOC',
    moTa: 'Đơn đã hoàn thành phải có bản ghi duyệt APPROVE cho mọi bước bắt buộc',
    sql: `SELECT a.ma_ho_so AS "maHoSo", s.step_order AS "buoc"
          FROM applications a
          JOIN step_instances s ON s.application_id = a.id
          WHERE a.deleted_at IS NULL AND a.trang_thai = 'COMPLETED'
            AND s.trang_thai NOT IN ('SKIPPED')
            AND NOT EXISTS (
              SELECT 1 FROM approvals ap
              WHERE ap.application_id = a.id
                AND ap.buoc_order = s.step_order
                AND ap.hanh_dong = 'APPROVE'
            )`,
  },
  {
    ma: 'PENDING_THIEU_BUOC_HIEN_TAI',
    moTa: 'Đơn đang chờ duyệt phải có step_instance đúng bước hiện tại',
    sql: `SELECT a.ma_ho_so AS "maHoSo", a.current_step_order AS "buoc"
          FROM applications a
          WHERE a.deleted_at IS NULL AND a.trang_thai = 'PENDING_APPROVAL'
            AND NOT EXISTS (
              SELECT 1 FROM step_instances s
              WHERE s.application_id = a.id AND s.step_order = a.current_step_order
            )`,
  },
  {
    ma: 'STEP_PENDING_THIEU_ASSIGNEE',
    moTa: 'Mọi bước đang PENDING phải có người được gán',
    sql: `SELECT a.ma_ho_so AS "maHoSo", s.step_order AS "buoc", s.role
          FROM step_instances s
          JOIN applications a ON a.id = s.application_id
          WHERE a.deleted_at IS NULL AND s.trang_thai = 'PENDING' AND s.assignee_id IS NULL`,
  },
  {
    ma: 'HAI_BUOC_DANG_MO',
    moTa: 'Không được có hai bước cùng đang xử lý (IN_PROGRESS) trên cùng một đơn',
    sql: `SELECT a.ma_ho_so AS "maHoSo", count(*) AS "soBuocMo"
          FROM step_instances s
          JOIN applications a ON a.id = s.application_id
          WHERE a.deleted_at IS NULL AND s.trang_thai = 'IN_PROGRESS'
          GROUP BY a.ma_ho_so
          HAVING count(*) > 1`,
  },
  {
    ma: 'CHU_KY_KHONG_KHOP_OTP',
    moTa: 'Số chữ ký của văn bản phải khớp số bước ký OTP đã duyệt',
    sql: `SELECT a.ma_ho_so AS "maHoSo",
                 (SELECT count(*) FROM signatures sg WHERE sg.application_id = a.id AND sg.phuong_thuc = 'OTP') AS "soChuKy",
                 (SELECT count(*) FROM step_instances s WHERE s.application_id = a.id AND s.mode = 'OTP' AND s.trang_thai = 'APPROVED') AS "soBuocOtp"
          FROM applications a
          JOIN signed_documents d ON d.application_id = a.id AND d.deleted_at IS NULL
          WHERE a.deleted_at IS NULL
            AND (SELECT count(*) FROM signatures sg WHERE sg.application_id = a.id AND sg.phuong_thuc = 'OTP')
              <> (SELECT count(*) FROM step_instances s WHERE s.application_id = a.id AND s.mode = 'OTP' AND s.trang_thai = 'APPROVED')`,
  },
  {
    ma: 'OTP_DA_DUNG_THIEU_APPROVAL',
    moTa: 'OTP đã dùng (consumed) phải gắn với một lần duyệt',
    sql: `SELECT oc.id, a.ma_ho_so AS "maHoSo", oc.step_order AS "buoc"
          FROM otp_challenges oc
          JOIN applications a ON a.id = oc.application_id
          WHERE oc.da_dung = true
            AND NOT EXISTS (
              SELECT 1 FROM approvals ap
              WHERE ap.application_id = oc.application_id
                AND ap.buoc_order = oc.step_order
                AND ap.hanh_dong = 'APPROVE'
            )`,
  },
  {
    ma: 'LUOT_TAI_AM',
    moTa: 'Số lượt tải không được âm (chưa có trần cứng trong schema — chỉ chặn giá trị âm)',
    sql: `SELECT id, ten, luot_tai AS "luotTai"
          FROM library_documents
          WHERE luot_tai < 0`,
  },
  {
    ma: 'BAN_GHI_MO_COI_FK',
    moTa: 'Không được có khóa ngoại trỏ tới bản ghi không tồn tại (kiểm tra các FK quan trọng)',
    sql: `SELECT 'applications.applicant_id' AS "fk", a.ma_ho_so AS "id"
          FROM applications a
          LEFT JOIN users u ON u.id = a.applicant_id
          WHERE u.id IS NULL
          UNION ALL
          SELECT 'students.class_id', s.id::text
          FROM students s
          LEFT JOIN classes c ON c.id = s.class_id
          WHERE c.id IS NULL
          UNION ALL
          SELECT 'step_instances.application_id', s.id::text
          FROM step_instances s
          LEFT JOIN applications a ON a.id = s.application_id
          WHERE a.id IS NULL
          UNION ALL
          SELECT 'approvals.application_id', ap.id::text
          FROM approvals ap
          LEFT JOIN applications a ON a.id = ap.application_id
          WHERE a.id IS NULL`,
  },
]

export async function runIntegrityChecks(
  target: string | pg.Client | pg.PoolClient,
): Promise<Violation[]> {
  const isClient = typeof target !== 'string'
  const client = isClient ? target : new pg.Client({ connectionString: target })
  if (!isClient) {
    await (client as pg.Client).connect()
  }
  const violations: Violation[] = []
  try {
    for (const c of CHECKS) {
      const res = await client.query(c.sql)
      if (res.rowCount && res.rowCount > 0) {
        violations.push({
          ma: c.ma,
          moTa: c.moTa,
          soLuong: res.rowCount,
          viDu: res.rows.slice(0, 5),
        })
      }
    }
  } finally {
    if (!isClient) {
      await (client as pg.Client).end()
    }
  }
  return violations
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write('Thiếu DATABASE_URL.\n')
    process.exit(2)
  }
  if (!url.toLowerCase().includes('test')) {
    process.stderr.write(
      `CẢNH BÁO: đang kiểm tra CSDL không phải môi trường test (${maskDbUrl(url)}). Chỉ đọc, không sửa.\n`,
    )
  }
  const json = process.argv.includes('--json')
  const vs = await runIntegrityChecks(url)
  if (json) {
    process.stdout.write(JSON.stringify({ ok: vs.length === 0, violations: vs }, null, 2) + '\n')
  } else if (vs.length === 0) {
    process.stdout.write('Toàn vẹn dữ liệu: 0 vi phạm.\n')
  } else {
    process.stdout.write(`Phát hiện ${vs.length} nhóm vi phạm:\n`)
    for (const v of vs) {
      process.stdout.write(`- [${v.ma}] ${v.moTa}: ${v.soLuong} bản ghi\n`)
      process.stdout.write(`  Ví dụ: ${JSON.stringify(v.viDu)}\n`)
    }
  }
  process.exit(vs.length ? 1 : 0)
}

const isDirect = process.argv[1]?.includes('check-integrity')
if (isDirect) {
  void main()
}
