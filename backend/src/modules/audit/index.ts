import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'

/** Nhãn hành động — khớp AUDIT_ACTION_LABELS trong frontend. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  CREATE_APPLICATION: 'Tạo hồ sơ',
  SUBMIT_APPLICATION: 'Nộp hồ sơ',
  APPROVE_APPLICATION: 'Duyệt hồ sơ',
  REJECT_APPLICATION: 'Từ chối hồ sơ',
  REQUEST_SUPPLEMENT: 'Yêu cầu bổ sung',
  SUPPLEMENT_APPLICATION: 'Bổ sung hồ sơ',
  CANCEL_APPLICATION: 'Rút hồ sơ',
  DELETE_APPLICATION: 'Xóa hồ sơ nháp',
  ISSUE_DOCUMENT: 'Cấp văn bản',
  REVOKE_DOCUMENT: 'Thu hồi văn bản',
  DOWNLOAD_DOCUMENT: 'Tải văn bản',
  UPDATE_REQUEST_TYPE: 'Cập nhật loại đơn',
  UPDATE_WORKFLOW: 'Cập nhật luồng duyệt',
  UPDATE_TEMPLATE: 'Cập nhật mẫu văn bản',
  UPDATE_USER: 'Cập nhật người dùng',
  DELEGATE_APPROVAL: 'Ủy quyền duyệt',
  REFRESH_REUSE_DETECTED: 'Phát hiện dùng lại phiên',
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  tuKhoa: z.string().trim().max(200).optional(),
  nguoiThucHienId: z.string().max(200).optional(),
  hanhDong: z.string().max(100).optional(),
  tuNgay: z.string().max(40).optional(),
  denNgay: z.string().max(40).optional(),
})

const idParam = z.object({ id: z.string().min(1).max(200) })

function auditDto(a: {
  id: string
  luc: Date
  nguoiThucHienId: string | null
  nguoiThucHienTen: string
  vaiTro: string
  hanhDong: string
  doiTuong: string
  doiTuongId: string
  giaTriTruoc: string | null
  giaTriSau: string | null
  diaChiIp: string
  thietBi: string
}) {
  return {
    id: a.id,
    luc: a.luc.toISOString(),
    nguoiThucHienId: a.nguoiThucHienId ?? '',
    nguoiThucHienTen: a.nguoiThucHienTen,
    vaiTro: a.vaiTro,
    hanhDong: a.hanhDong,
    doiTuong: a.doiTuong,
    doiTuongId: a.doiTuongId,
    ...(a.giaTriTruoc ? { giaTriTruoc: a.giaTriTruoc } : {}),
    ...(a.giaTriSau ? { giaTriSau: a.giaTriSau } : {}),
    diaChiIp: a.diaChiIp,
    thietBi: a.thietBi,
  }
}

export const auditRouter: Router = Router()

auditRouter.use(authenticate, requireRole('ADMIN', 'PHONG_DAO_TAO'))

auditRouter.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuery>
    const where: Prisma.AuditLogWhereInput = {}
    if (q.nguoiThucHienId) where.nguoiThucHienId = q.nguoiThucHienId
    if (q.hanhDong) where.hanhDong = q.hanhDong
    if (q.tuKhoa) {
      where.OR = [
        { nguoiThucHienTen: { contains: q.tuKhoa, mode: 'insensitive' } },
        { doiTuongId: { contains: q.tuKhoa, mode: 'insensitive' } },
        { doiTuong: { contains: q.tuKhoa, mode: 'insensitive' } },
      ]
    }
    if (q.tuNgay || q.denNgay) {
      where.luc = {
        ...(q.tuNgay ? { gte: new Date(q.tuNgay) } : {}),
        ...(q.denNgay ? { lte: new Date(q.denNgay) } : {}),
      }
    }

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { luc: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ])
    sendPage(res, rows.map(auditDto), { page: q.page, pageSize: q.pageSize, total })
  }),
)

auditRouter.get(
  '/actions',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.auditLog.findMany({ distinct: ['hanhDong'], select: { hanhDong: true } })
    send(
      res,
      rows
        .map((r) => ({ ma: r.hanhDong, nhan: AUDIT_ACTION_LABELS[r.hanhDong] ?? r.hanhDong }))
        .sort((a, b) => a.ma.localeCompare(b.ma)),
    )
  }),
)

auditRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.auditLog.findUnique({ where: { id } })
    if (!row) throw AppError.notFound('Không tìm thấy bản ghi nhật ký.')
    send(res, auditDto(row))
  }),
)
