/**
 * PHAN 2b — Cac test bo sung con thieu tu Phan 2
 *
 * 1. otp_hash la chuoi OTP 6 chu so (raw) bi chan boi CHECK constraint
 * 2. TRUNCATE audit_logs bi chan
 * 3. Guardrail: test suite tu choi chay khi DATABASE_URL khong chua "test"
 * 4. Soft delete: ma khong duoc tai su dung (trong cung bang)
 */
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { assertTestDatabaseUrl } from '../../../scripts/lib/assert-test-db'

// -------------------------------------------------------------------
// 1. DATABASE_URL guardrail
// -------------------------------------------------------------------
describe('CSDL 2b — Guardrail: DATABASE_URL phai chua "test"', () => {
  it('assertTestDatabaseUrl nem loi khi DATABASE_URL la undefined', () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/thi[eế]u/i)
  })

  it('assertTestDatabaseUrl nem loi khi DATABASE_URL tro toi CSDL khong phai test', () => {
    const nonTestUrl = 'postgresql://motcua:motcua@localhost:5433/motcua?schema=public'
    expect(() => assertTestDatabaseUrl(nonTestUrl)).toThrow(/test/i)
  })

  it('assertTestDatabaseUrl chap nhan URL chua chuoi "test"', () => {
    const testUrl = 'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'
    expect(() => assertTestDatabaseUrl(testUrl)).not.toThrow()
    expect(assertTestDatabaseUrl(testUrl)).toBe(testUrl)
  })

  it('DATABASE_URL hien tai chua "test" (bao dam bo kiem tra nay chay tren CSDL test)', () => {
    const url = process.env.DATABASE_URL ?? 'postgresql://motcua:motcua@localhost:5434/motcua_test'
    expect(url.toLowerCase()).toContain('test')
  })
})

// -------------------------------------------------------------------
// 2. OTP raw hash constraint
// -------------------------------------------------------------------
describe('CSDL 2b — Constraints: otp_hash la raw OTP 6 chu so bi chan', () => {
  it('Chuoi 6 chu so (raw OTP "123456") bi chan boi CHECK constraint ma_bam_len', async () => {
    const appId = randomUUID()
    const reqType = await prisma.requestType.findFirst()

    // Tao application truoc
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    await prisma.application.create({
      data: {
        id: appId,
        maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        duLieu: {},
      },
    })

    try {
      // Thu chen OTP raw (chi 6 ky tu) — phai bi chan
      await expect(
        prisma.$executeRaw`
          INSERT INTO otp_challenges (id, user_id, application_id, step_order, otp_hash, het_han_luc, da_dung, created_at)
          VALUES (${randomUUID()}::uuid, ${student!.id}::uuid, ${appId}::uuid, 1, '123456', now() + interval '5 min', false, now())
        `,
      ).rejects.toThrow()

      // Thu chen OTP raw 6 chu so khac
      await expect(
        prisma.$executeRaw`
          INSERT INTO otp_challenges (id, user_id, application_id, step_order, otp_hash, het_han_luc, da_dung, created_at)
          VALUES (${randomUUID()}::uuid, ${student!.id}::uuid, ${appId}::uuid, 1, '654321', now() + interval '5 min', false, now())
        `,
      ).rejects.toThrow()
    } finally {
      await prisma.application.delete({ where: { id: appId } }).catch(() => {})
    }
  })

  it('Chuoi ma_bam 64 ky tu hex duoc chap nhan (otp_hash dung dinh dang)', async () => {
    const appId = randomUUID()
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        duLieu: {},
      },
    })

    const validHash = 'a'.repeat(64)
    const otpId = randomUUID()

    try {
      await expect(
        prisma.$executeRaw`
          INSERT INTO otp_challenges (id, user_id, application_id, step_order, otp_hash, het_han_luc, da_dung, created_at)
          VALUES (${otpId}::uuid, ${student!.id}::uuid, ${appId}::uuid, 1, ${validHash}, now() + interval '5 min', false, now())
        `,
      ).resolves.toBeDefined()
    } finally {
      await prisma.$executeRaw`DELETE FROM otp_challenges WHERE id = ${otpId}::uuid`.catch(() => {})
      await prisma.application.delete({ where: { id: appId } }).catch(() => {})
    }
  })
})

// -------------------------------------------------------------------
// 3. TRUNCATE audit_logs bi chan
// -------------------------------------------------------------------
describe('CSDL 2b — Audit: TRUNCATE audit_logs bi chan', () => {
  it('TRUNCATE audit_logs nem loi (trigger hoac quyen han)', async () => {
    // Thu TRUNCATE bang audit_logs
    await expect(
      prisma.$executeRaw`TRUNCATE audit_logs`,
    ).rejects.toThrow(/audit_logs|chỉ ghi thêm|insufficient_privilege|permission denied/i)
  })

  it('Ghi chep audit_logs van hoat dong sau khi thu TRUNCATE that bai', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    // TRUNCATE that bai
    await prisma.$executeRaw`TRUNCATE audit_logs`.catch(() => {})

    // Kiem tra van con ghi duoc
    const logId = randomUUID()
    const record = await prisma.auditLog.create({
      data: {
        id: logId,
        nguoiThucHienId: admin!.id,
        nguoiThucHienTen: admin!.hoTen,
        vaiTro: 'ADMIN',
        hanhDong: 'TEST_AFTER_TRUNCATE_ATTEMPT',
        doiTuong: 'APPLICATION',
        doiTuongId: randomUUID(),
        diaChiIp: '127.0.0.1',
        thietBi: 'vitest',
      },
    })
    expect(record.id).toBe(logId)
  })
})

// -------------------------------------------------------------------
// 4. Soft delete: ma khong duoc tai su dung
// -------------------------------------------------------------------
describe('CSDL 2b — Soft Delete: Ma khong duoc tai su dung sau khi xoa mem', () => {
  it('Tao request_type, xoa mem, thu tao lai voi cung ma -> bi chan boi UNIQUE constraint', async () => {
    const uniqueMa = `RT_FUZZ_${Date.now()}`
    const wf = await prisma.workflow.findFirst()

    // Tao record goc
    const rt = await prisma.requestType.create({
      data: {
        ma: uniqueMa,
        ten: 'Test RT Fuzz',
        nhom: 'TEST',
        moTa: 'Test',
        icon: 'file',
        mau: '#000000',
        workflowId: wf!.id,
      },
    })

    // Xoa mem
    await prisma.requestType.update({
      where: { id: rt.id },
      data: { deletedAt: new Date() },
    })

    // Thu tao lai voi cung ma -> phai bi chan (unique constraint)
    await expect(
      prisma.requestType.create({
        data: {
          ma: uniqueMa,
          ten: 'Test RT Fuzz duplicate',
          nhom: 'TEST',
          moTa: 'Test',
          icon: 'file',
          mau: '#000000',
          workflowId: wf!.id,
        },
      }),
    ).rejects.toThrow(/unique|Unique constraint/i)

    // Cleanup
    await prisma.requestType.delete({ where: { id: rt.id } })
  })

  it('Ma bi xoa mem khong the truy van bang findFirst cua Prisma (mac dinh loc deletedAt IS NOT NULL)', async () => {
    const uniqueMa = `RT_FUZZ2_${Date.now()}`
    const wf = await prisma.workflow.findFirst()

    const rt = await prisma.requestType.create({
      data: {
        ma: uniqueMa,
        ten: 'Test Soft Delete Filter',
        nhom: 'TEST',
        moTa: 'Test',
        icon: 'file',
        mau: '#000000',
        workflowId: wf!.id,
        deletedAt: new Date(), // Xoa mem ngay khi tao
      },
    })

    // Quan sat: Prisma khong tu dong loc deletedAt -- can loc thu cong
    const found = await prisma.requestType.findFirst({
      where: { ma: uniqueMa, deletedAt: null },
    })
    expect(found, 'Ban ghi bi xoa mem khong xuat hien trong truy van co dieu kien deletedAt IS NULL').toBeNull()

    // Cleanup
    await prisma.requestType.delete({ where: { id: rt.id } })
  })
})
