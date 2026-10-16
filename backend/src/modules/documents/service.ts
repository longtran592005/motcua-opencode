import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { scopeWhere, type ScopeUser } from '../../lib/scope'
import { recordAudit } from '../../lib/audit'
import { pushNotification } from '../../lib/notify'
import type { Ctx } from '../applications/service'
import { loadApplicationForUser } from '../applications/service'
import { signedDocumentDto, signedDocumentInclude } from './dto'

export const documentListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tuKhoa: z.string().trim().max(200).optional(),
  trangThai: z.enum(['VALID', 'REVOKED', 'INVALID', 'ALL']).optional(),
  loaiVanBan: z.string().max(200).optional(),
  khoa: z.string().max(200).optional(),
  tuNgay: z.string().max(40).optional(),
  denNgay: z.string().max(40).optional(),
})

type ListQuery = z.infer<typeof documentListQuery>

/** Tìm văn bản theo UUID nội bộ hoặc số văn bản công khai. */
export async function loadDocument(idOrSo: string) {
  const doc = await prisma.signedDocument.findFirst({
    where: {
      ...(isUuid(idOrSo) ? { id: idOrSo } : { soVanBan: idOrSo }),
      deletedAt: null,
    },
    include: signedDocumentInclude,
  })
  if (!doc) throw AppError.notFound('Không tìm thấy văn bản.')
  return doc
}

export async function getByApplication(user: ScopeUser, maHoSo: string) {
  const app = await loadApplicationForUser(maHoSo, user)
  const doc = await prisma.signedDocument.findFirst({
    where: { applicationId: app.id, deletedAt: null },
    include: signedDocumentInclude,
  })
  if (!doc) throw AppError.notFound('Hồ sơ chưa được cấp văn bản.')
  return signedDocumentDto(doc, { mask: false })
}

export async function listIssued(
  user: ScopeUser,
  query: ListQuery,
  opts: { mask?: boolean } = {},
) {
  const where: Prisma.SignedDocumentWhereInput = {
    deletedAt: null,
    application: scopeWhere(user) as Prisma.ApplicationWhereInput,
  }
  if (query.trangThai && query.trangThai !== 'ALL') where.trangThai = query.trangThai
  if (query.loaiVanBan) where.loaiVanBan = query.loaiVanBan
  if (query.tuKhoa) {
    where.OR = [
      { soVanBan: { contains: query.tuKhoa, mode: 'insensitive' } },
      { trichYeu: { contains: query.tuKhoa, mode: 'insensitive' } },
    ]
  }
  if (query.tuNgay || query.denNgay) {
    where.ngayCap = {
      ...(query.tuNgay ? { gte: new Date(query.tuNgay) } : {}),
      ...(query.denNgay ? { lte: new Date(query.denNgay) } : {}),
    }
  }

  const [total, rows] = await Promise.all([
    prisma.signedDocument.count({ where }),
    prisma.signedDocument.findMany({
      where,
      include: signedDocumentInclude,
      orderBy: { ngayCap: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ])

  return {
    items: rows.map((r) =>
      signedDocumentDto(r, { mask: opts.mask ?? false, includeDownloads: false }),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

/** Thu hồi văn bản: đổi trạng thái, vô hiệu hoá chữ ký, thông báo cho sinh viên. */
export async function revoke(ctx: Ctx, idOrSo: string, lyDo: string) {
  const doc = await loadDocument(idOrSo)
  if (doc.trangThai === 'REVOKED') {
    throw AppError.invalidTransition('Văn bản đã bị thu hồi trước đó.')
  }
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.signedDocument.update({
      where: { id: doc.id },
      data: {
        trangThai: 'REVOKED',
        lyDoThuHoi: lyDo,
        ngayThuHoi: now,
        chuKyConHieuLuc: false,
      },
    })
    await tx.signature.updateMany({
      where: { vanBanId: doc.id },
      data: { hopLe: false, lyDoKhongHopLe: `Văn bản bị thu hồi: ${lyDo}` },
    })
    await tx.approval.create({
      data: {
        applicationId: doc.applicationId,
        buocOrder: 0,
        hanhDong: 'REVOKE_DOCUMENT',
        actorId: ctx.user.id,
        vaiTro: ctx.user.role,
        chucVu: ctx.user.chucVu,
        lyDo,
      },
    })
  })

  await pushNotification({
    nguoiNhanId: doc.application.applicantId,
    tieuDe: 'Văn bản đã bị thu hồi',
    noiDung: `Văn bản số ${doc.soVanBan} đã bị thu hồi. Lý do: ${lyDo}`,
    loai: 'DANGER',
    applicationId: doc.applicationId,
    maHoSo: doc.application.maHoSo,
    lienKet: `/xac-thuc/${doc.tokenXacThuc}`,
  })

  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'REVOKE_DOCUMENT',
    doiTuong: 'Văn bản đã cấp',
    doiTuongId: doc.soVanBan,
    giaTriTruoc: 'Hợp lệ',
    giaTriSau: 'Đã thu hồi',
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })

  return signedDocumentDto(await loadDocument(doc.id), { mask: false })
}

/** Ghi nhận một lượt tải văn bản (mọi lượt tải đều được lưu vết). */
export async function logDownload(ctx: Ctx, idOrSo: string, mucDich = 'download') {
  const doc = await loadDocument(idOrSo)
  if (doc.trangThai === 'REVOKED') {
    throw new AppError('DOCUMENT_REVOKED', 'Văn bản đã bị thu hồi, không thể tải về.')
  }
  await prisma.documentDownload.create({
    data: {
      documentId: doc.id,
      nguoiTaiId: ctx.user.id,
      nguoiTaiTen: ctx.user.hoTen,
      diaChiIp: ctx.ip,
      userAgent: ctx.userAgent.slice(0, 300),
      mucDich,
    },
  })
  await recordAudit({
    nguoiThucHien: ctx.user,
    hanhDong: 'DOWNLOAD_DOCUMENT',
    doiTuong: 'Văn bản đã cấp',
    doiTuongId: doc.soVanBan,
    diaChiIp: ctx.ip,
    thietBi: ctx.userAgent,
  })
  return signedDocumentDto(await loadDocument(doc.id), { mask: false })
}
