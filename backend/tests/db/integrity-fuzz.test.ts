/**
 * PHAN 2b — Integrity Fuzz Tests (kiem tra tung quy tac trong check-integrity.ts)
 *
 * Voi moi quy tac: chen vi pham vao CSDL (trong transaction rollback),
 * xac nhan script phat hien va tra ve exit code != 0.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runIntegrityChecks } from '../../../scripts/check-integrity'
import { DEFAULT_TEST_DATABASE_URL } from '../../../scripts/lib/assert-test-db'

const DATABASE_URL =
  process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

/**
 * Tao du lieu vi pham trong SAVEPOINT, sau do rollback.
 * Tra ve so luong vi pham tim thay voi ma cu the.
 */
async function withViolation(
  pool: pg.Pool,
  setup: (client: pg.PoolClient) => Promise<void>,
  violationCode: string,
): Promise<number> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await setup(client)
    const violations = await runIntegrityChecks(client)
    const found = violations.filter((v) => v.ma === violationCode)
    await client.query('ROLLBACK')
    return found.length > 0 ? found[0].soLuong : 0
  } finally {
    await client.query('ROLLBACK').catch(() => {})
    client.release()
  }
}

describe('CSDL 2b — Integrity Fuzz: Moi quy tac phat hien dung vi pham', () => {
  let pool: pg.Pool
  let studentId: string
  let reqTypeId: string
  let staffId: string

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 })
    const student = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE role = 'SINH_VIEN' LIMIT 1",
    )
    const reqType = await pool.query<{ id: string }>('SELECT id FROM request_types LIMIT 1')
    const staff = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE role = 'CO_VAN' LIMIT 1",
    )
    studentId = student.rows[0]?.id ?? ''
    reqTypeId = reqType.rows[0]?.id ?? ''
    staffId = staff.rows[0]?.id ?? ''
    expect(studentId).toBeTruthy()
    expect(reqTypeId).toBeTruthy()
    expect(staffId).toBeTruthy()
  })

  afterAll(async () => {
    await pool.end()
  })

  // -------------------------------------------------------------------
  // QUY TAC 1: COMPLETED_THIEU_VAN_BAN
  // -------------------------------------------------------------------
  it('COMPLETED_THIEU_VAN_BAN: don COMPLETED khong co van ban -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'COMPLETED','{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        // KHONG tao signed_document -> vi pham
      },
      'COMPLETED_THIEU_VAN_BAN',
    )
    expect(found, 'Phai phat hien COMPLETED_THIEU_VAN_BAN').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 2: COMPLETED_THIEU_APPROVAL_BAT_BUOC
  // -------------------------------------------------------------------
  it('COMPLETED_THIEU_APPROVAL_BAT_BUOC: buoc APPROVED nhung khong co approval record -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'COMPLETED','{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        // Tao step_instance APPROVED nhung KHONG co approval -> vi pham
        await client.query(
          `INSERT INTO step_instances (id, application_id, step_order, ten, role, mode, trang_thai, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,1,'Buoc ky','CO_VAN','ONE_CLICK','APPROVED',now(),now())`,
          [randomUUID(), appId],
        )
        // Tao 1 signed_document de qua kiem tra COMPLETED_THIEU_VAN_BAN
        const tok = 'a'.repeat(64)
        const sha = 'b'.repeat(64)
        await client.query(
          `INSERT INTO signed_documents (id, application_id, so_van_ban, trich_yeu, loai_van_ban, noi_dung, sinh_vien_snapshot, token_xac_thuc, ma_bam_sha256, trang_thai, ngay_cap, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,'VB-FUZZ-A','trich yeu','GIAY_XAC_NHAN','noi dung','{}', $3,$4,'VALID',now(),now(),now())`,
          [randomUUID(), appId, tok, sha],
        )
      },
      'COMPLETED_THIEU_APPROVAL_BAT_BUOC',
    )
    expect(found, 'Phai phat hien COMPLETED_THIEU_APPROVAL_BAT_BUOC').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 3: PENDING_THIEU_BUOC_HIEN_TAI
  // -------------------------------------------------------------------
  it('PENDING_THIEU_BUOC_HIEN_TAI: don PENDING_APPROVAL nhung step_instance bi xoa -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, current_step_order, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'PENDING_APPROVAL',1,'{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        // KHONG tao step_instance buoc 1 -> vi pham
      },
      'PENDING_THIEU_BUOC_HIEN_TAI',
    )
    expect(found, 'Phai phat hien PENDING_THIEU_BUOC_HIEN_TAI').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 4: STEP_PENDING_THIEU_ASSIGNEE
  // -------------------------------------------------------------------
  it('STEP_PENDING_THIEU_ASSIGNEE: step PENDING ma khong co assignee_id -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, current_step_order, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'PENDING_APPROVAL',1,'{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        // step_instance PENDING nhung assignee_id = NULL -> vi pham
        await client.query(
          `INSERT INTO step_instances (id, application_id, step_order, ten, role, mode, trang_thai, assignee_id, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,1,'Buoc 1','CO_VAN','ONE_CLICK','PENDING',NULL,now(),now())`,
          [randomUUID(), appId],
        )
      },
      'STEP_PENDING_THIEU_ASSIGNEE',
    )
    expect(found, 'Phai phat hien STEP_PENDING_THIEU_ASSIGNEE').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 5: HAI_BUOC_DANG_MO
  // -------------------------------------------------------------------
  it('HAI_BUOC_DANG_MO: 2 step_instance IN_PROGRESS cung 1 don -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, current_step_order, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'PENDING_APPROVAL',1,'{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        // 2 step IN_PROGRESS cung 1 don -> vi pham
        for (const order of [1, 2]) {
          await client.query(
            `INSERT INTO step_instances (id, application_id, step_order, ten, role, mode, trang_thai, assignee_id, created_at, updated_at)
             VALUES ($1::uuid,$2::uuid,$3,'Buoc','CO_VAN','ONE_CLICK','IN_PROGRESS',$4::uuid,now(),now())`,
            [randomUUID(), appId, order, staffId],
          )
        }
      },
      'HAI_BUOC_DANG_MO',
    )
    expect(found, 'Phai phat hien HAI_BUOC_DANG_MO').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 6: OTP_DA_DUNG_THIEU_APPROVAL
  // -------------------------------------------------------------------
  it('OTP_DA_DUNG_THIEU_APPROVAL: otp_challenge da_dung=true nhung khong co approval -> phat hien', async () => {
    const appId = randomUUID()
    const found = await withViolation(
      pool,
      async (client) => {
        const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`
        await client.query(
          `INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,'PENDING_APPROVAL','{}',now(),now())`,
          [appId, maHoSo, studentId, reqTypeId],
        )
        const otpHash = 'c'.repeat(64)
        await client.query(
          `INSERT INTO otp_challenges (id, user_id, application_id, step_order, otp_hash, het_han_luc, da_dung, created_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,1,$4,now()+interval '5 min',true,now())`,
          [randomUUID(), studentId, appId, otpHash],
        )
        // KHONG tao approval -> vi pham
      },
      'OTP_DA_DUNG_THIEU_APPROVAL',
    )
    expect(found, 'Phai phat hien OTP_DA_DUNG_THIEU_APPROVAL').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // QUY TAC 7: LUOT_TAI_AM
  // -------------------------------------------------------------------
  it('LUOT_TAI_AM: library_document co luot_tai < 0 -> phat hien', async () => {
    const found = await withViolation(
      pool,
      async (client) => {
        await client.query(
          `INSERT INTO library_documents (id, ten, nhom, mo_ta, loai_tep, kich_thuoc, url, luot_tai, created_at, updated_at)
           VALUES ($1::uuid,'Doc BM Fuzz','BIEU_MAU','Mo ta','PDF','1024','/files/fuzz.pdf',-1,now(),now())`,
          [randomUUID()],
        )
      },
      'LUOT_TAI_AM',
    )
    expect(found, 'Phai phat hien LUOT_TAI_AM').toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------
  // KIEM TRA: mo ta ro rang khi script chay tren CSDL sach
  // -------------------------------------------------------------------
  it('Tren CSDL sach: runIntegrityChecks tra ve 0 vi pham', async () => {
    const violations = await runIntegrityChecks(DATABASE_URL)
    expect(violations.length, 'CSDL sach khong co vi pham').toBe(0)
  })
})
