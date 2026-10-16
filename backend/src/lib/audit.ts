import type { Prisma, Role } from '@prisma/client'
import { prisma } from './prisma'

/** Ghi nhật ký hệ thống (bảng append-only). Không bao giờ ghi ra bí mật. */
export interface AuditInput {
  nguoiThucHien: { id: string; hoTen: string; role: Role } | null
  hanhDong: string
  doiTuong: string
  doiTuongId: string
  giaTriTruoc?: string
  giaTriSau?: string
  diaChiIp?: string
  thietBi?: string
}

type Client = Prisma.TransactionClient | typeof prisma

export async function recordAudit(input: AuditInput, client: Client = prisma): Promise<void> {
  await client.auditLog.create({
    data: {
      nguoiThucHienId: input.nguoiThucHien?.id ?? null,
      nguoiThucHienTen: input.nguoiThucHien?.hoTen ?? 'Hệ thống',
      vaiTro: input.nguoiThucHien?.role ?? 'ADMIN',
      hanhDong: input.hanhDong,
      doiTuong: input.doiTuong,
      doiTuongId: input.doiTuongId,
      giaTriTruoc: input.giaTriTruoc ?? null,
      giaTriSau: input.giaTriSau ?? null,
      diaChiIp: input.diaChiIp ?? '0.0.0.0',
      thietBi: input.thietBi ?? 'không xác định',
    },
  })
}
