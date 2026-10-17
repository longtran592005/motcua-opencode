/**
 * PHAN 2b — Transaction Rollback Tests (mid-stream rollback)
 *
 * Gia lap loi xay ra giua chuyen trang thai va ghi approval.
 * Kiem tra: khong co du lieu nua voi (half-baked) con sot lai.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { DEFAULT_TEST_DATABASE_URL } from '../../../scripts/lib/assert-test-db'

const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL

describe('CSDL 2b — Transaction Rollback: Khong de lai du lieu nua voi', () => {
  let pool: pg.Pool
  const createdAppIds: string[] = []

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 })
  })

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      await prisma.stepInstance.deleteMany({ where: { applicationId: { in: createdAppIds } } })
      await prisma.approval.deleteMany({ where: { applicationId: { in: createdAppIds } } })
      await prisma.application.deleteMany({ where: { id: { in: createdAppIds } } })
    }
    await pool.end()
  })

  it('Rollback sau chuyen trang_thai nhung truoc ghi approval: ca hai hoac khong cai nao', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const staff = await prisma.user.findFirst({ where: { role: 'CO_VAN' } })
    const reqType = await prisma.requestType.findFirst()
    const appId = randomUUID()
    createdAppIds.push(appId)
    const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: 1,
        duLieu: {},
      },
    })

    await prisma.stepInstance.create({
      data: {
        id: randomUUID(),
        applicationId: appId,
        stepOrder: 1,
        ten: 'Buoc ky',
        role: 'CO_VAN',
        mode: 'ONE_CLICK',
        trangThai: 'PENDING',
        assigneeId: staff!.id,
      },
    })

    // Gia lap: transaction chuyen trang_thai THANH CONG nhung ghi approval LOI
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // B1: Chuyen trang thai sang COMPLETED
      await client.query(
        "UPDATE applications SET trang_thai = 'COMPLETED', updated_at = now() WHERE id = $1",
        [appId],
      )

      // B2: Gia lap loi truoc khi ghi approval (table khong ton tai)
      await client
        .query('INSERT INTO bang_khong_ton_tai (x) VALUES (1)')
        .catch(() => {
          // Loi mong muon — rollback
        })

      // Do co loi -> rollback
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    // Ket qua: trang_thai PHAI con la PENDING_APPROVAL (rollback)
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { trangThai: true },
    })
    expect(app?.trangThai, 'Transaction rollback: trang_thai khong duoc chuyen').toBe(
      'PENDING_APPROVAL',
    )

    // Ket qua: khong co approval nao duoc tao
    const approvals = await prisma.approval.count({ where: { applicationId: appId } })
    expect(approvals, 'Khong co approval sau rollback').toBe(0)
  })

  it('Rollback sau ghi approval nhung truoc chuyen trang_thai: ca hai hoac khong cai nao', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const staff = await prisma.user.findFirst({ where: { role: 'CO_VAN' } })
    const reqType = await prisma.requestType.findFirst()
    const appId = randomUUID()
    createdAppIds.push(appId)
    const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: 1,
        duLieu: {},
      },
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // B1: Ghi approval
      await client.query(
        `INSERT INTO approvals (id, application_id, actor_id, buoc_order, hanh_dong, vai_tro, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'APPROVE', 'CO_VAN', now())`,
        [randomUUID(), appId, staff!.id],
      )

      // B2: Gia lap loi truoc khi cap nhat trang_thai
      await client
        .query('INSERT INTO bang_khong_ton_tai (x) VALUES (1)')
        .catch(() => {})

      // Loi -> rollback
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    // Ket qua: khong co approval nao sot lai
    const approvals = await prisma.approval.count({ where: { applicationId: appId } })
    expect(approvals, 'Khong co approval sau rollback').toBe(0)

    // Trang thai van con la PENDING_APPROVAL
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { trangThai: true },
    })
    expect(app?.trangThai, 'Trang thai khong thay doi sau rollback').toBe('PENDING_APPROVAL')
  })

  it('Transaction thanh cong toan ven: ca hai thay doi deu duoc luu', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const staff = await prisma.user.findFirst({ where: { role: 'CO_VAN' } })
    const reqType = await prisma.requestType.findFirst()
    const appId = randomUUID()
    createdAppIds.push(appId)
    const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: 1,
        duLieu: {},
      },
    })

    const approvalId = randomUUID()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      await client.query(
        `INSERT INTO approvals (id, application_id, actor_id, buoc_order, hanh_dong, vai_tro, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'APPROVE', 'CO_VAN', now())`,
        [approvalId, appId, staff!.id],
      )

      await client.query(
        "UPDATE applications SET trang_thai = 'COMPLETED', updated_at = now() WHERE id = $1",
        [appId],
      )

      await client.query('COMMIT')
    } finally {
      client.release()
    }

    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { trangThai: true },
    })
    expect(app?.trangThai).toBe('COMPLETED')

    const approval = await prisma.approval.findUnique({ where: { id: approvalId } })
    expect(approval).not.toBeNull()
  })
})
