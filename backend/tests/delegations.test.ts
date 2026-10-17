import { afterAll, describe, expect, it } from 'vitest'
import {
  api,
  approverFor,
  bearer,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  currentStepOf,
  idemKey,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'

const createdDelegations: string[] = []

afterAll(async () => {
  if (createdDelegations.length) {
    await prisma.delegation.deleteMany({ where: { id: { in: createdDelegations } } })
  }
  await cleanupTracked()
  await cleanupProvisioned()
})

/** Cố vấn học tập "tự nhiên" của lớp sinh viên, cùng một cố vấn khác để nhận ủy quyền. */
async function covanPair() {
  const [student] = await twoStudents()
  const lop = await prisma.class.findUniqueOrThrow({
    where: { id: (await prisma.student.findUniqueOrThrow({ where: { userId: student.userId } })).classId },
    include: { coVan: true },
  })
  const nguoiUyQuyen = lop.coVan
  if (!nguoiUyQuyen) throw new Error('Lớp của sinh viên mẫu chưa có cố vấn học tập.')
  const nguoiNhan = await prisma.user.findFirst({
    where: { role: 'CO_VAN', trangThai: 'ACTIVE', deletedAt: null, id: { not: nguoiUyQuyen.id } },
    orderBy: { maSo: 'asc' },
  })
  if (!nguoiNhan) throw new Error('Cần ít nhất hai cố vấn học tập trong dữ liệu mẫu.')
  // Mỗi ca kiểm thử bắt đầu từ trạng thái ủy quyền SẠCH cho cặp này.
  await prisma.delegation.deleteMany({
    where: {
      OR: [
        { nguoiUyQuyenId: nguoiUyQuyen.id },
        { nguoiNhanId: nguoiUyQuyen.id },
        { nguoiUyQuyenId: nguoiNhan.id },
        { nguoiNhanId: nguoiNhan.id },
      ],
    },
  })
  return { student, nguoiUyQuyen, nguoiNhan }
}

const ngay = (lech: number) => new Date(Date.now() + lech * 86_400_000).toISOString()

async function taoUyQuyen(
  nguoiUyQuyenId: string,
  nguoiNhanId: string,
  tuNgay: string,
  denNgay: string,
) {
  const session = await login(
    (await prisma.user.findUniqueOrThrow({ where: { id: nguoiUyQuyenId } })).maSo,
  )
  const res = await api()
    .post('/api/v1/delegations')
    .set(bearer(session.token))
    .set('Idempotency-Key', idemKey())
    .send({ nguoiNhanId, vaiTro: 'CO_VAN', tuNgay, denNgay, lyDo: 'Đi công tác tuần này.' })
  if (res.status === 201) createdDelegations.push(res.body.data.id)
  return res
}

describe('Ủy quyền duyệt hồ sơ', () => {
  it('danh sách người có thể nhận ủy quyền theo vai trò', async () => {
    const { nguoiUyQuyen } = await covanPair()
    const session = await login(nguoiUyQuyen.maSo)
    const res = await api()
      .get('/api/v1/delegations/eligible-users')
      .query({ vaiTro: 'CO_VAN' })
      .set(bearer(session.token))
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(1)
    for (const u of res.body.data) expect(u.role).toBe('CO_VAN')
  })

  it('ủy quyền còn hiệu lực thì người nhận được GIAO việc và duyệt được', async () => {
    const { student, nguoiUyQuyen, nguoiNhan } = await covanPair()
    const tao = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(-1), ngay(1))
    expect(tao.status).toBe(201)
    expect(tao.body.data.hieuLuc).toBe(true)
    expect(tao.body.data.vaiTro).toBe('CO_VAN')

    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.assigneeId).toBe(nguoiNhan.id)

    // Người nhận ủy quyền thấy hồ sơ trong hộp thư "Chờ tôi duyệt".
    const sessionNhan = await login(nguoiNhan.maSo)
    const pending = await api()
      .get('/api/v1/approvals/pending')
      .query({ page: 1, pageSize: 50 })
      .set(bearer(sessionNhan.token))
    expect(pending.status).toBe(200)
    expect(pending.body.data.some((a: { maHoSo: string }) => a.maHoSo === draft.maHoSo)).toBe(true)

    const duyet = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionNhan.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt theo ủy quyền.' })
    expect(duyet.status).toBe(200)
    expect(duyet.body.data.trangThai).toBe('COMPLETED')
  })

  it('ủy quyền ĐÃ HẾT HẠN không còn quyền duyệt (dù bước đã giao cho người nhận)', async () => {
    const { student, nguoiUyQuyen, nguoiNhan } = await covanPair()
    const tao = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(-1), ngay(1))
    expect(tao.status).toBe(201)

    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.assigneeId).toBe(nguoiNhan.id)

    // Thời gian trôi qua: ủy quyền hết hiệu lực trong lúc hồ sơ đang chờ.
    await prisma.delegation.update({
      where: { id: tao.body.data.id },
      data: { denNgay: new Date(Date.now() - 60_000) },
    })

    const sessionNhan = await login(nguoiNhan.maSo)
    const duyet = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionNhan.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt khi ủy quyền đã hết hạn.' })
    expect(duyet.status).toBe(403)
    expect(duyet.body.error.code).toBe('FORBIDDEN_SCOPE')
    expect(duyet.body.error.message).toContain('hết hiệu lực')

    // Người ủy quyền (cố vấn tự nhiên của lớp) vẫn duyệt được như thường.
    const sessionUyQuyen = await login(nguoiUyQuyen.maSo)
    const duyetChinhChu = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionUyQuyen.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Tự duyệt sau khi ủy quyền hết hạn.' })
    expect(duyetChinhChu.status).toBe(200)
  })

  it('ủy quyền hết hạn thì KHÔNG được giao việc mới', async () => {
    const { student, nguoiUyQuyen, nguoiNhan } = await covanPair()
    const tao = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(-5), ngay(-1))
    expect(tao.status).toBe(201)

    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.assigneeId).toBe(nguoiUyQuyen.id)
  })

  it('huỷ ủy quyền rồi thì không còn quyền duyệt', async () => {
    const { student, nguoiUyQuyen, nguoiNhan } = await covanPair()
    const tao = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(-1), ngay(1))
    const id = tao.body.data.id as string

    const sessionUyQuyen = await login(nguoiUyQuyen.maSo)
    const huy = await api().delete(`/api/v1/delegations/${id}`).set(bearer(sessionUyQuyen.token))
    expect(huy.status).toBe(204)

    const sau = await api()
      .get('/api/v1/delegations')
      .set(bearer(sessionUyQuyen.token))
    const row = sau.body.data.find((d: { id: string }) => d.id === id)
    expect(row.hieuLuc).toBe(false)

    // Huỷ lần nữa → INVALID_TRANSITION.
    const huyLai = await api().delete(`/api/v1/delegations/${id}`).set(bearer(sessionUyQuyen.token))
    expect(huyLai.status).toBe(409)
    expect(huyLai.body.error.code).toBe('INVALID_TRANSITION')

    // Không còn được giao việc.
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)
    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.assigneeId).toBe(nguoiUyQuyen.id)
  })

  it('từ chối cấu hình ủy quyền sai', async () => {
    const { nguoiUyQuyen, nguoiNhan } = await covanPair()
    const session = await login(nguoiUyQuyen.maSo)

    // Tự ủy quyền cho chính mình.
    const tu = await api()
      .post('/api/v1/delegations')
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({
        nguoiNhanId: nguoiUyQuyen.id,
        vaiTro: 'CO_VAN',
        tuNgay: ngay(-1),
        denNgay: ngay(1),
        lyDo: 'Tự ủy quyền.',
      })
    expect(tu.status).toBe(422)

    // Ngày kết thúc phải sau ngày bắt đầu.
    const saiNgay = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(2), ngay(1))
    expect(saiNgay.status).toBe(422)
    expect(saiNgay.body.error.code).toBe('VALIDATION_ERROR')

    // Vai trò không khớp người nhận.
    const saiVaiTro = await api()
      .post('/api/v1/delegations')
      .set(bearer(session.token))
      .set('Idempotency-Key', idemKey())
      .send({
        nguoiNhanId: nguoiNhan.id,
        vaiTro: 'TRUONG_KHOA',
        tuNgay: ngay(-1),
        denNgay: ngay(1),
        lyDo: 'Sai vai trò.',
      })
    expect(saiVaiTro.status).toBe(422)
  })

  it('ủy quyền được kiểm tra hiệu lực theo NGÀY tại thời điểm duyệt', async () => {
    const { student, nguoiUyQuyen, nguoiNhan } = await covanPair()
    // Ủy quyền chỉ có hiệu lực từ NGÀY MAI ⇒ chưa được giao việc hôm nay.
    const tao = await taoUyQuyen(nguoiUyQuyen.id, nguoiNhan.id, ngay(1), ngay(3))
    expect(tao.status).toBe(201)

    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)

    const { step } = await currentStepOf(draft.maHoSo)
    expect(step!.assigneeId).toBe(nguoiUyQuyen.id)

    // Người nhận chưa có quyền vì ủy quyền chưa tới ngày bắt đầu.
    const sessionNhan = await login(nguoiNhan.maSo)
    const som = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(sessionNhan.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt sớm.' })
    expect(som.status).toBe(403)

    // Và cố vấn tự nhiên duyệt được.
    const { session: chinhChu } = await approverFor(student.userId, 'CO_VAN')
    const duyet = await api()
      .post(`/api/v1/approvals/${draft.maHoSo}/approve`)
      .set(bearer(chinhChu.token))
      .set('Idempotency-Key', idemKey())
      .send({ ghiChu: 'Duyệt đúng người.' })
    expect(duyet.status).toBe(200)
    expect(duyet.body.data.trangThai).toBe('COMPLETED')
  })
})
