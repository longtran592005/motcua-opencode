/**
 * Job SLA (Giai đoạn 4).
 *
 * Quét các bước đang mở và thực hiện ba việc, mỗi việc đánh dấu một mốc thời
 * gian riêng nên chỉ chạy MỘT LẦN cho mỗi bước:
 *   1. `nhacLuc`      — nhắc TRƯỚC hạn (`nhacTruocGio` giờ trước `slaDueAt`);
 *   2. `daQuaHan`     — đánh dấu QUÁ HẠN khi đã qua `slaDueAt`;
 *   3. `leoThangLuc`  — LEO THANG lên vai trò `escalateTo` sau `leoThangSauGio`
 *      giờ kể từ hạn. Sau khi leo thang, vai trò cấp trên mới có quyền duyệt
 *      bước đó (xem `xacDinhThamQuyen` trong `engine.ts`).
 *
 * Hàm thuần khiết theo tham số `now` để bài kiểm thử gọi trực tiếp, không cần
 * chờ đồng hồ thật.
 */
import { recordAudit } from '../../lib/audit'
import { logger } from '../../lib/logger'
import { notifyRole, pushNotification } from '../../lib/notify'
import { prisma } from '../../lib/prisma'

export interface SlaRunResult {
  daNhac: number
  daQuaHan: number
  daLeoThang: number
}

const GIO_MS = 3_600_000
/** Giới hạn số bước xử lý mỗi lượt quét để job không giữ giao dịch quá lâu. */
const TOI_DA_MOI_LUOT = 2000

export async function runSlaJob(now: Date = new Date()): Promise<SlaRunResult> {
  const ketQua: SlaRunResult = { daNhac: 0, daQuaHan: 0, daLeoThang: 0 }

  const steps = await prisma.stepInstance.findMany({
    where: {
      trangThai: { in: ['PENDING', 'IN_PROGRESS'] },
      slaDueAt: { not: null },
      application: {
        deletedAt: null,
        trangThai: { in: ['SUBMITTED', 'PENDING_APPROVAL'] },
      },
    },
    include: {
      application: { select: { id: true, maHoSo: true, applicantId: true } },
    },
    orderBy: { slaDueAt: 'asc' },
    take: TOI_DA_MOI_LUOT,
  })

  for (const step of steps) {
    const han = step.slaDueAt
    if (!han) continue
    const app = step.application

    /* ------------------------- 1. Nhắc trước hạn ------------------------- */
    const mocNhac = new Date(han.getTime() - step.nhacTruocGio * GIO_MS)
    if (!step.nhacLuc && now >= mocNhac && now < han) {
      const conLaiGio = Math.max(1, Math.round((han.getTime() - now.getTime()) / GIO_MS))
      const payload = {
        tieuDe: 'Hồ sơ sắp tới hạn xử lý',
        noiDung: `Hồ sơ ${app.maHoSo} — bước "${step.ten}" còn khoảng ${conLaiGio} giờ là tới hạn xử lý.`,
        loai: 'WARNING' as const,
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: `/quan-ly/don/${app.maHoSo}`,
      }
      if (step.assigneeId) {
        await pushNotification({ nguoiNhanId: step.assigneeId, ...payload })
      } else {
        await notifyRole(step.role, payload)
      }
      await prisma.stepInstance.update({ where: { id: step.id }, data: { nhacLuc: now } })
      await recordAudit({
        nguoiThucHien: null,
        hanhDong: 'SLA_REMIND',
        doiTuong: 'Bước xử lý',
        doiTuongId: step.id,
        giaTriTruoc: 'Chưa nhắc',
        giaTriSau: `Đã nhắc trước hạn (${step.nhacTruocGio} giờ)`,
      })
      ketQua.daNhac += 1
    }

    /* --------------------------- 2. Quá hạn ----------------------------- */
    if (!step.daQuaHan && now >= han) {
      const treGio = Math.round((now.getTime() - han.getTime()) / GIO_MS)
      const payload = {
        tieuDe: 'Hồ sơ đã quá hạn xử lý',
        noiDung: `Hồ sơ ${app.maHoSo} — bước "${step.ten}" đã quá hạn ${treGio} giờ.`,
        loai: 'DANGER' as const,
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: `/quan-ly/don/${app.maHoSo}`,
      }
      if (step.assigneeId) {
        await pushNotification({ nguoiNhanId: step.assigneeId, ...payload })
      } else {
        await notifyRole(step.role, payload)
      }
      await prisma.stepInstance.update({ where: { id: step.id }, data: { daQuaHan: true } })
      await recordAudit({
        nguoiThucHien: null,
        hanhDong: 'SLA_OVERDUE',
        doiTuong: 'Bước xử lý',
        doiTuongId: step.id,
        giaTriTruoc: 'Trong hạn',
        giaTriSau: `Quá hạn ${treGio} giờ`,
      })
      ketQua.daQuaHan += 1
    }

    /* --------------------------- 3. Leo thang --------------------------- */
    const mocLeoThang = new Date(han.getTime() + step.leoThangSauGio * GIO_MS)
    if (step.escalateTo && !step.leoThangLuc && now >= mocLeoThang) {
      const payload = {
        tieuDe: 'Hồ sơ quá hạn cần bạn xử lý',
        noiDung: `Hồ sơ ${app.maHoSo} — bước "${step.ten}" quá hạn ${Math.round(
          (now.getTime() - han.getTime()) / GIO_MS,
        )} giờ nên đã được chuyển lên cấp ${step.escalateTo}.`,
        loai: 'DANGER' as const,
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: `/quan-ly/don/${app.maHoSo}`,
      }
      await notifyRole(step.escalateTo, payload)
      await prisma.stepInstance.update({ where: { id: step.id }, data: { leoThangLuc: now } })
      await recordAudit({
        nguoiThucHien: null,
        hanhDong: 'SLA_ESCALATE',
        doiTuong: 'Bước xử lý',
        doiTuongId: step.id,
        giaTriTruoc: step.role,
        giaTriSau: `Chuyển lên ${step.escalateTo}`,
      })
      ketQua.daLeoThang += 1
    }
  }

  return ketQua
}

/** Bọc job nền: nuốt lỗi và chỉ ghi log, không làm sập tiến trình. */
export async function runSlaJobSafe(now: Date = new Date()): Promise<SlaRunResult | null> {
  try {
    return await runSlaJob(now)
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'Job SLA thất bại')
    return null
  }
}
