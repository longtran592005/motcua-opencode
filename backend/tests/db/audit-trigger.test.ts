import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

describe('CSDL — Tính bất biến của bảng Audit Log (Audit Log Immutability)', () => {
  it('Cho phép INSERT bản ghi mới vào audit_logs', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    expect(admin).not.toBeNull()

    const newId = randomUUID()
    const record = await prisma.auditLog.create({
      data: {
        id: newId,
        nguoiThucHienId: admin!.id,
        nguoiThucHienTen: admin!.hoTen,
        vaiTro: 'ADMIN',
        hanhDong: 'TEST_INSERT_AUDIT_LOG',
        doiTuong: 'APPLICATION',
        doiTuongId: randomUUID(),
        diaChiIp: '127.0.0.1',
        thietBi: 'vitest',
      },
    })

    expect(record.id).toBe(newId)
    expect(record.hanhDong).toBe('TEST_INSERT_AUDIT_LOG')
  })

  it('DB Trigger chặn lệnh UPDATE trên audit_logs và ném exception', async () => {
    const log = await prisma.auditLog.findFirst()
    expect(log).not.toBeNull()

    await expect(
      prisma.$executeRaw`
        UPDATE audit_logs
        SET hanh_dong = 'MALICIOUS_TAMPER'
        WHERE id = ${log!.id}::uuid
      `,
    ).rejects.toThrow(/audit_logs là bảng chỉ ghi thêm|insufficient_privilege/)
  })

  it('DB Trigger chặn lệnh DELETE trên audit_logs và ném exception', async () => {
    const log = await prisma.auditLog.findFirst()
    expect(log).not.toBeNull()

    await expect(
      prisma.$executeRaw`
        DELETE FROM audit_logs
        WHERE id = ${log!.id}::uuid
      `,
    ).rejects.toThrow(/audit_logs là bảng chỉ ghi thêm|insufficient_privilege/)
  })
})
