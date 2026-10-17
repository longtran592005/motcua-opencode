import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'

describe('CSDL — Ràng buộc toàn vẹn và quy tắc CHECK (Constraints & Checks)', () => {
  it('Chặn mã hồ sơ sai định dạng MC-YYYY-NNNNNN', async () => {
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()
    expect(student).not.toBeNull()
    expect(reqType).not.toBeNull()

    // Định dạng sai: HS-2026-000001
    await expect(
      prisma.$executeRaw`
        INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, 'HS-2026-000001', ${student!.id}::uuid, ${reqType!.id}::uuid, 'SUBMITTED', '{}'::jsonb, now(), now())
      `,
    ).rejects.toThrow()

    // Định dạng sai: MC-26-0001 (năm không đủ 4 số, stt không đủ 6 số)
    await expect(
      prisma.$executeRaw`
        INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, 'MC-26-0001', ${student!.id}::uuid, ${reqType!.id}::uuid, 'SUBMITTED', '{}'::jsonb, now(), now())
      `,
    ).rejects.toThrow()
  })

  it('Chặn mã nghiệp vụ bị gán nhầm chuỗi định dạng UUID', async () => {
    const fakeUuid = randomUUID()

    // Chặn mã khoa là UUID
    await expect(
      prisma.$executeRaw`
        INSERT INTO faculties (id, ma, ten, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${fakeUuid}, 'Khoa Test', now(), now())
      `,
    ).rejects.toThrow()

    // Chặn mã hồ sơ là UUID
    const student = await prisma.user.findFirst({ where: { role: 'SINH_VIEN' } })
    const reqType = await prisma.requestType.findFirst()
    await expect(
      prisma.$executeRaw`
        INSERT INTO applications (id, ma_ho_so, applicant_id, request_type_id, trang_thai, du_lieu, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${fakeUuid}, ${student!.id}::uuid, ${reqType!.id}::uuid, 'SUBMITTED', '{}'::jsonb, now(), now())
      `,
    ).rejects.toThrow()
  })

  it('Chặn giá trị không phải UUID ở khóa chính', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO faculties (id, ma, ten, created_at, updated_at)
        VALUES ('not-a-valid-uuid', 'K_TEST_INVALID', 'Khoa Test', now(), now())
      `,
    ).rejects.toThrow()
  })

  it('Chặn token xác thực văn bản ngắn hơn 32 ký tự', async () => {
    const validSha256 = 'a'.repeat(64)
    const shortToken = 'token_ngan_duoi_32_ky_tu'

    await expect(
      prisma.$executeRaw`
        INSERT INTO signed_documents (id, application_id, so_van_ban, trich_yeu, loai_van_ban, noi_dung, sinh_vien_snapshot, token_xac_thuc, ma_bam_sha256, trang_thai, ngay_cap, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, 'VB-TEST-01', 'Trích yếu', 'GIAY_XAC_NHAN', 'Nội dung', '{}'::jsonb, ${shortToken}, ${validSha256}, 'VALID', now(), now(), now())
      `,
    ).rejects.toThrow(/signed_documents_token_len/)
  })

  it('Chặn mã băm SHA-256 không đủ 64 ký tự hex', async () => {
    const longToken = 'a'.repeat(32)
    const invalidSha = 'not_a_valid_64_char_sha256_hash'

    await expect(
      prisma.$executeRaw`
        INSERT INTO signed_documents (id, application_id, so_van_ban, trich_yeu, loai_van_ban, noi_dung, sinh_vien_snapshot, token_xac_thuc, ma_bam_sha256, trang_thai, ngay_cap, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, 'VB-TEST-02', 'Trích yếu', 'GIAY_XAC_NHAN', 'Nội dung', '{}'::jsonb, ${longToken}, ${invalidSha}, 'VALID', now(), now(), now())
      `,
    ).rejects.toThrow(/signed_documents_sha256/)
  })

  it('Chặn khoảng thời gian không hợp lệ (den_ngay < tu_ngay) trong bảng delegations', async () => {
    const [userA, userB] = await prisma.user.findMany({ take: 2 })
    expect(userA).toBeDefined()
    expect(userB).toBeDefined()

    const tuNgay = new Date('2026-05-10T00:00:00Z')
    const denNgay = new Date('2026-05-01T00:00:00Z') // Trước ngày bắt đầu

    await expect(
      prisma.$executeRaw`
        INSERT INTO delegations (id, nguoi_uy_quyen_id, nguoi_nhan_id, vai_tro, tu_ngay, den_ngay, ly_do, hieu_luc, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, ${userA.id}::uuid, ${userB.id}::uuid, 'CO_VAN', ${tuNgay}, ${denNgay}, 'Lý do công tác', true, now(), now())
      `,
    ).rejects.toThrow(/delegations_date_order/)
  })

  it('Chặn thời gian xử lý SLA âm (sla_hours < 0)', async () => {
    const wf = await prisma.workflow.findFirst()
    expect(wf).not.toBeNull()

    await expect(
      prisma.$executeRaw`
        INSERT INTO workflow_steps (id, workflow_id, "order", ten, role, mode, sla_hours, created_at)
        VALUES (${randomUUID()}::uuid, ${wf!.id}::uuid, 99, 'Bước test SLA âm', 'CO_VAN', 'ONE_CLICK', -5, now())
      `,
    ).rejects.toThrow(/workflow_steps_sla_nonneg/)
  })

  it('Chặn vi phạm NOT NULL trên các trường bắt buộc', async () => {
    // Thiếu email và password_hash
    await expect(
      prisma.$executeRaw`
        INSERT INTO users (id, ma_so, ho_ten, role, created_at, updated_at)
        VALUES (${randomUUID()}::uuid, 'MS_TEST_NN', 'User No Email', 'SINH_VIEN', now(), now())
      `,
    ).rejects.toThrow()
  })

  it('ON DELETE RESTRICT: Không cho phép xóa User khi đang có hồ sơ liên kết', async () => {
    const app = await prisma.application.findFirst({ select: { applicantId: true } })
    expect(app).not.toBeNull()

    await expect(
      prisma.user.delete({ where: { id: app!.applicantId } }),
    ).rejects.toThrow()
  })

  it('ON DELETE RESTRICT: Không cho phép xóa RequestType khi đang có hồ sơ liên kết', async () => {
    const app = await prisma.application.findFirst({ select: { requestTypeId: true } })
    expect(app).not.toBeNull()

    await expect(
      prisma.requestType.delete({ where: { id: app!.requestTypeId } }),
    ).rejects.toThrow()
  })
})
