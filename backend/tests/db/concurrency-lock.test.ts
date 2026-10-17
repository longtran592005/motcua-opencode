import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Khóa hàng, điều khiển tranh chấp và Deadlock (Concurrency & Locking)', () => {
  let pool: pg.Pool
  const createdAppIds: string[] = []

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 10 })
  })

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      await prisma.stepInstance.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      })
      await prisma.application.deleteMany({
        where: { id: { in: createdAppIds } },
      })
    }
    await pool.end()
  })

  it('Hai cán bộ cùng claim 1 bước hồ sơ đồng thời: duy nhất 1 người thành công', async () => {
    // Tạo 1 hồ sơ và 1 bước chưa có người nhận (assignee_id = NULL)
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const staff1 = await prisma.user.findFirst({ where: { role: 'CO_VAN' } })
    const staff2 = await prisma.user.findFirst({ where: { role: 'TRUONG_KHOA' } })
    const reqType = await prisma.requestType.findFirst()

    expect(student).not.toBeNull()
    expect(staff1).not.toBeNull()
    expect(staff2).not.toBeNull()
    expect(reqType).not.toBeNull()

    const appId = randomUUID()
    createdAppIds.push(appId)
    const stepId = randomUUID()

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: 1,
        duLieu: {},
      },
    })

    await prisma.stepInstance.create({
      data: {
        id: stepId,
        applicationId: appId,
        stepOrder: 1,
        ten: 'Tiếp nhận',
        role: 'CO_VAN',
        mode: 'ONE_CLICK',
        trangThai: 'PENDING',
        assigneeId: null, // Chưa ai nhận
      },
    })

    // Hai transaction đồng thời dùng atomic conditional update (hoặc FOR UPDATE)
    const claimStep = async (staffId: string) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Khóa bi quan và kiểm tra
        const selectRes = await client.query<{ id: string; assignee_id: string | null }>(
          'SELECT id, assignee_id FROM step_instances WHERE id = $1 FOR UPDATE',
          [stepId],
        )
        if (selectRes.rows[0].assignee_id !== null) {
          await client.query('ROLLBACK')
          return { claimed: false, reason: 'ALREADY_CLAIMED' }
        }

        // Nhận việc
        await client.query(
          "UPDATE step_instances SET assignee_id = $1, trang_thai = 'IN_PROGRESS' WHERE id = $2",
          [staffId, stepId],
        )
        await client.query('COMMIT')
        return { claimed: true, reason: null }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        return { claimed: false, error: err }
      } finally {
        client.release()
      }
    }

    const [res1, res2] = await Promise.all([claimStep(staff1!.id), claimStep(staff2!.id)])

    const successCount = [res1.claimed, res2.claimed].filter(Boolean).length
    expect(successCount, 'Đúng 1 người claim thành công').toBe(1)
  })

  it('Hai yêu cầu chuyển trạng thái đơn đồng thời: 1 thành công, 1 thất bại, không rơi vào trạng thái trung gian', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()

    const appId = randomUUID()
    createdAppIds.push(appId)
    await prisma.application.create({
      data: {
        id: appId,
        maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'SUBMITTED',
        duLieu: {},
      },
    })

    // Hai giao dịch cố gắng chuyển từ SUBMITTED sang trạng thái khác
    const transition = async (newStatus: string) => {
      const client = await pool.connect()
      try {
        const res = await client.query(
          "UPDATE applications SET trang_thai = $1 WHERE id = $2 AND trang_thai = 'SUBMITTED' RETURNING id",
          [newStatus, appId],
        )
        return res.rowCount ?? 0
      } finally {
        client.release()
      }
    }

    const [t1, t2] = await Promise.all([
      transition('PENDING_APPROVAL'),
      transition('CANCELLED'),
    ])

    expect(t1 + t2, 'Chỉ 1 chuyển đổi được áp dụng').toBe(1)

    // Trạng thái cuối cùng là một giá trị rõ ràng, không bị lẫn lộn
    const finalApp = await prisma.application.findUnique({
      where: { id: appId },
      select: { trangThai: true },
    })
    expect(['PENDING_APPROVAL', 'CANCELLED']).toContain(finalApp?.trangThai)
  })

  it('Deadlock test: DB phát hiện chu trình khóa chéo và giải phóng trong < 2 giây', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()

    const appA = randomUUID()
    const appB = randomUUID()
    createdAppIds.push(appA, appB)

    await prisma.application.createMany({
      data: [
        {
          id: appA,
          maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
          applicantId: student!.id,
          requestTypeId: reqType!.id,
          trangThai: 'DRAFT',
          duLieu: {},
        },
        {
          id: appB,
          maHoSo: `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`,
          applicantId: student!.id,
          requestTypeId: reqType!.id,
          trangThai: 'DRAFT',
          duLieu: {},
        },
      ],
    })

    const client1 = await pool.connect()
    const client2 = await pool.connect()

    const startTime = Date.now()
    let error1: unknown = null
    let error2: unknown = null

    try {
      // Đặt deadlock_timeout ngắn cho phiên kiểm thử
      await client1.query("SET deadlock_timeout = '200ms'")
      await client2.query("SET deadlock_timeout = '200ms'")

      await client1.query('BEGIN')
      await client2.query('BEGIN')

      // Client 1 khóa row A
      await client1.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [appA])
      // Client 2 khóa row B
      await client2.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [appB])

      // Bắt đầu khóa chéo đồng thời
      const p1 = client1
        .query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [appB])
        .then(() => client1.query('COMMIT'))
        .catch((err) => {
          error1 = err
          return client1.query('ROLLBACK')
        })

      const p2 = client2
        .query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [appA])
        .then(() => client2.query('COMMIT'))
        .catch((err) => {
          error2 = err
          return client2.query('ROLLBACK')
        })

      await Promise.all([p1, p2])
    } finally {
      client1.release()
      client2.release()
    }

    const duration = Date.now() - startTime

    // Giải phóng trong dưới 2 giây
    expect(duration).toBeLessThan(2000)

    // Một trong hai client phải nhận lỗi deadlock_detected (code 40P01)
    const hasDeadlock =
      (error1 as { code?: string })?.code === '40P01' ||
      (error2 as { code?: string })?.code === '40P01'

    expect(hasDeadlock).toBe(true)
  })
})
