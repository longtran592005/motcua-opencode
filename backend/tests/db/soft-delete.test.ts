import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

describe('CSDL — Xóa mềm và toàn vẹn dữ liệu (Soft Delete vs Hard Delete)', () => {
  const createdAppIds: string[] = []

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      await prisma.stepInstance.deleteMany({
        where: { applicationId: { in: createdAppIds } },
      })
      await prisma.application.deleteMany({
        where: { id: { in: createdAppIds } },
      })
    }
  })

  it('Bản ghi có deleted_at không xuất hiện trong các truy vấn chuẩn (deleted_at IS NULL)', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()

    const appId = randomUUID()
    createdAppIds.push(appId)
    const maHoSo = `MC-2026-${Math.floor(100000 + Math.random() * 899999)}`

    // Tạo hồ sơ mới
    await prisma.application.create({
      data: {
        id: appId,
        maHoSo,
        applicantId: student!.id,
        requestTypeId: reqType!.id,
        trangThai: 'SUBMITTED',
        duLieu: {},
      },
    })

    // Trước khi xóa mềm: tìm thấy
    const before = await prisma.application.findFirst({
      where: { id: appId, deletedAt: null },
    })
    expect(before).not.toBeNull()

    // Thực hiện xóa mềm
    await prisma.application.update({
      where: { id: appId },
      data: { deletedAt: new Date() },
    })

    // Sau khi xóa mềm: không còn xuất hiện trong truy vấn chuẩn
    const after = await prisma.application.findFirst({
      where: { id: appId, deletedAt: null },
    })
    expect(after).toBeNull()

    // Nhưng vẫn còn tồn tại vật lý trong bảng
    const raw = await prisma.application.findUnique({
      where: { id: appId },
    })
    expect(raw).not.toBeNull()
    expect(raw?.deletedAt).not.toBeNull()
  })

  it('Khóa ngoại và quan hệ của bản ghi xóa mềm vẫn được bảo toàn nguyên vẹn', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()

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
        ten: 'Duyệt bước 1',
        role: 'CO_VAN',
        mode: 'ONE_CLICK',
        trangThai: 'PENDING',
      },
    })

    // Xóa mềm hồ sơ
    await prisma.application.update({
      where: { id: appId },
      data: { deletedAt: new Date() },
    })

    // Bước xử lý liên kết vẫn trỏ đúng tới application_id, không bị lỗi tham chiếu
    const step = await prisma.stepInstance.findUnique({
      where: { id: stepId },
      include: { application: true },
    })

    expect(step).not.toBeNull()
    expect(step?.application.id).toBe(appId)
    expect(step?.application.deletedAt).not.toBeNull()
  })

  it('Khôi phục bản ghi đã xóa mềm (deleted_at = NULL) -> dữ liệu trở lại bình thường', async () => {
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
        deletedAt: new Date(), // Đang bị xóa mềm
      },
    })

    // Khôi phục
    await prisma.application.update({
      where: { id: appId },
      data: { deletedAt: null },
    })

    // Tìm lại với điều kiện chuẩn
    const restored = await prisma.application.findFirst({
      where: { id: appId, deletedAt: null },
    })
    expect(restored).not.toBeNull()
    expect(restored?.id).toBe(appId)
  })
})
