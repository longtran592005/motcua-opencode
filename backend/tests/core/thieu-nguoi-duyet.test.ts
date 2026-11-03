import { afterEach, describe, expect, it } from 'vitest'
import {
  api,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  idemKey,
  login,
  prisma,
  twoStudents,
} from '../helpers'

describe('Thiếu người duyệt', () => {
  let studentSession: Awaited<ReturnType<typeof login>> | undefined
  let studentUserId: string | undefined

  afterEach(async () => {
    await cleanupTracked()
    await cleanupProvisioned()
    studentSession = undefined
    studentUserId = undefined
  })

  async function createStudentDraft(steps: Array<{ role: 'CO_VAN' | 'TRUONG_KHOA' | 'PHONG_DAO_TAO' }>) {
    const [student] = await twoStudents()
    studentSession = await login(student.user.maSo)
    studentUserId = student.user.id
    const flow = await createFlow(steps.map((step) => ({ ...step, mode: 'ONE_CLICK' as const })))
    return createDraft(studentSession, flow.requestType.id)
  }

  it('Không có cố vấn học tập: từ chối nộp với lỗi nghiệp vụ rõ ràng', async () => {
    const draft = await createStudentDraft([{ role: 'CO_VAN' }])
    const student = await prisma.student.findUniqueOrThrow({ where: { userId: studentUserId! } })
    const cls = await prisma.class.findUniqueOrThrow({ where: { id: student.classId } })
    await prisma.class.update({ where: { id: cls.id }, data: { coVanId: null } })
    try {
      const response = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/submit`)
        .set(bearer(studentSession!.token))
        .set('Idempotency-Key', idemKey())
      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('Cố vấn học tập')
    } finally {
      await prisma.class.update({ where: { id: cls.id }, data: { coVanId: cls.coVanId } })
    }
  })

  it('Không có trưởng khoa: từ chối nộp trước khi hồ sơ tới bước trưởng khoa', async () => {
    const draft = await createStudentDraft([{ role: 'CO_VAN' }, { role: 'TRUONG_KHOA' }])
    const student = await prisma.student.findUniqueOrThrow({ where: { userId: studentUserId! } })
    const cls = await prisma.class.findUniqueOrThrow({ where: { id: student.classId } })
    const faculty = await prisma.faculty.findUniqueOrThrow({ where: { id: cls.facultyId } })
    await prisma.faculty.update({ where: { id: faculty.id }, data: { truongKhoaId: null } })
    try {
      const response = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/submit`)
        .set(bearer(studentSession!.token))
        .set('Idempotency-Key', idemKey())
      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('Trưởng khoa')
    } finally {
      await prisma.faculty.update({
        where: { id: faculty.id },
        data: { truongKhoaId: faculty.truongKhoaId },
      })
    }
  })

  it('Không có Phòng Đào tạo: từ chối nộp ngay từ đầu', async () => {
    const draft = await createStudentDraft([{ role: 'PHONG_DAO_TAO' }])
    const staff = await prisma.user.findMany({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null },
      select: { id: true, trangThai: true },
    })
    await prisma.user.updateMany({
      where: { role: 'PHONG_DAO_TAO', deletedAt: null },
      data: { trangThai: 'LOCKED' },
    })
    try {
      const response = await api()
        .post(`/api/v1/applications/${draft.maHoSo}/submit`)
        .set(bearer(studentSession!.token))
        .set('Idempotency-Key', idemKey())
      expect(response.status).toBe(422)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('Phòng Đào tạo')
    } finally {
      for (const user of staff) {
        await prisma.user.update({ where: { id: user.id }, data: { trangThai: user.trangThai } })
      }
    }
  })
})
