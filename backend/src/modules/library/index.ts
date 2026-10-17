import { Router } from 'express'
import { z } from 'zod'
import { authenticateOptional } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'

const listQuery = z.object({
  tuKhoa: z.string().trim().max(200).optional(),
  nhom: z.string().trim().max(200).optional(),
})
const idParam = z.object({ id: z.string().uuid('Mã định danh không hợp lệ.') })

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
}

function libraryDto(d: {
  id: string
  ten: string
  nhom: string
  moTa: string
  loaiTep: string
  kichThuoc: string
  url: string
  luotTai: number
  batBuocVoiLoaiDon: unknown
  updatedAt: Date
}) {
  return {
    id: d.id,
    ten: d.ten,
    nhom: d.nhom,
    moTa: d.moTa,
    loaiTep: d.loaiTep,
    kichThuoc: d.kichThuoc,
    capNhatLuc: d.updatedAt.toISOString(),
    luotTai: d.luotTai,
    url: d.url,
    ...(Array.isArray(d.batBuocVoiLoaiDon)
      ? { batBuocVoiLoaiDon: d.batBuocVoiLoaiDon as string[] }
      : {}),
  }
}

export const libraryRouter: Router = Router()

libraryRouter.get(
  '/',
  authenticateOptional,
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as never as z.infer<typeof listQuery>
    const rows = await prisma.libraryDocument.findMany({
      where: {
        deletedAt: null,
        ...(q.nhom ? { nhom: q.nhom } : {}),
        ...(q.tuKhoa
          ? {
              OR: [
                { ten: { contains: q.tuKhoa, mode: 'insensitive' } },
                { moTa: { contains: q.tuKhoa, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ nhom: 'asc' }, { ten: 'asc' }],
    })
    send(res, rows.map(libraryDto))
  }),
)

libraryRouter.get(
  '/groups',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.libraryDocument.findMany({
      where: { deletedAt: null },
      distinct: ['nhom'],
      select: { nhom: true },
      orderBy: { nhom: 'asc' },
    })
    send(res, rows.map((r) => r.nhom))
  }),
)

libraryRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.libraryDocument.findFirst({ where: { id, deletedAt: null } })
    if (!row) throw AppError.notFound('Không tìm thấy tài liệu.')
    send(res, libraryDto(row))
  }),
)

libraryRouter.post(
  '/:id/download',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const row = await prisma.libraryDocument.findFirst({ where: { id, deletedAt: null } })
    if (!row) throw AppError.notFound('Không tìm thấy tài liệu.')
    await prisma.libraryDocument.update({ where: { id }, data: { luotTai: { increment: 1 } } })
    send(res, {
      ten: row.ten,
      noiDung: '',
      mime: MIME[row.loaiTep] ?? 'application/octet-stream',
      url: row.url,
    })
  }),
)
