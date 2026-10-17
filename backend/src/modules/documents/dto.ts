import type { Prisma } from '@prisma/client'
import { maskName, maskMssv, scrubText } from '../../lib/mask'
import { signaturePayloadOf, verifySignature } from '../../lib/signature'

export const signedDocumentInclude = {
  application: { select: { id: true, maHoSo: true, applicantId: true, duLieu: true } },
  signatures: { orderBy: { buocOrder: 'asc' } },
  downloads: {
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { nguoiTai: { select: { hoTen: true } } },
  },
} satisfies Prisma.SignedDocumentInclude

export type SignedDocumentRow = Prisma.SignedDocumentGetPayload<{
  include: typeof signedDocumentInclude
}>

export interface SnapshotSinhVien {
  hoTen: string
  mssv: string
  lop: string
  khoa: string
  nganh: string
  khoaHoc: string
}

/**
 * Ánh xạ văn bản sang đúng khuôn frontend.
 * `mask = true` bắt buộc cho MỌI API công khai (quyết định A3).
 */
export function signedDocumentDto(
  doc: SignedDocumentRow,
  opts: { mask: boolean; includeDownloads?: boolean },
) {
  const snapshot = (doc.sinhVienSnapshot ?? {}) as Partial<SnapshotSinhVien>
  const sinhVien: SnapshotSinhVien = {
    hoTen: snapshot.hoTen ?? '',
    mssv: snapshot.mssv ?? '',
    lop: snapshot.lop ?? '',
    khoa: snapshot.khoa ?? '',
    nganh: snapshot.nganh ?? '',
    khoaHoc: snapshot.khoaHoc ?? '',
  }

  // Kiểm chứng lại từng chữ ký trên nội dung HIỆN TẠI của hồ sơ:
  // nội dung đổi sau khi ký ⇒ `hopLeThucTe = false`.
  const appState = { maHoSo: doc.application.maHoSo, duLieu: doc.application.duLieu }
  const chuKy = doc.signatures.map((s) => {
    const kq = verifySignature({
      provider: s.provider,
      maBam: s.maBam,
      maChuKy: s.maChuKy,
      payload: signaturePayloadOf(appState, {
        buocOrder: s.buocOrder,
        tenBuoc: s.tenBuoc,
        nguoiKyId: s.nguoiKyId,
        vaiTro: s.vaiTro,
        phuongThuc: s.phuongThuc,
        thoiDiemKy: s.thoiDiemKy,
      }),
    })
    return {
      id: s.id,
      applicationId: s.applicationId,
      ...(s.vanBanId ? { vanBanId: s.vanBanId } : {}),
      buocOrder: s.buocOrder,
      tenBuoc: s.tenBuoc,
      nguoiKyId: s.nguoiKyId,
      hoTen: s.hoTen,
      chucVu: s.chucVu ?? '',
      vaiTro: s.vaiTro,
      phuongThuc: s.phuongThuc,
      thoiDiemKy: s.thoiDiemKy.toISOString(),
      maBam: s.maBam,
      maChuKy: s.maChuKy,
      hopLe: s.hopLe,
      hopLeThucTe: kq.hopLe,
      ...(s.provider ? { provider: s.provider } : {}),
      ...(kq.lyDo ?? s.lyDoKhongHopLe ? { lyDoKhongHopLe: kq.lyDo ?? s.lyDoKhongHopLe! } : {}),
    }
  })

  // "Còn hiệu lực" = cờ đã lưu VÀ mọi chữ ký kiểm chứng được vẫn hợp lệ
  // (bản ghi cũ chưa có thông tin nhà cung cấp trả về `null` ⇒ không kết luận là sai).
  const chuKyConHieuLuc =
    doc.chuKyConHieuLuc && chuKy.every((c) => c.hopLeThucTe !== false)

  return {
    id: doc.id,
    soVanBan: doc.soVanBan,
    // Che cả trích yếu và nội dung văn bản: họ tên/MSSV có thể xuất hiện trong phần chữ.
    trichYeu: opts.mask ? scrubText(doc.trichYeu, [sinhVien.hoTen, sinhVien.mssv]) : doc.trichYeu,
    loaiVanBan: doc.loaiVanBan,
    templateId: doc.templateId ?? '',
    applicationId: doc.applicationId,
    maHoSo: doc.application.maHoSo,
    sinhVien: opts.mask
      ? { ...sinhVien, hoTen: maskName(sinhVien.hoTen), mssv: maskMssv(sinhVien.mssv) }
      : sinhVien,
    noiDung: opts.mask ? scrubText(doc.noiDung, [sinhVien.hoTen, sinhVien.mssv]) : doc.noiDung,
    ngayCap: doc.ngayCap.toISOString(),
    tokenXacThuc: doc.tokenXacThuc,
    maBamSha256: doc.maBamSha256,
    chuKy,
    trangThai: doc.trangThai,
    chuKyConHieuLuc,
    ...(doc.lyDoThuHoi ? { lyDoThuHoi: doc.lyDoThuHoi } : {}),
    ...(doc.ngayThuHoi ? { ngayThuHoi: doc.ngayThuHoi.toISOString() } : {}),
    luotTai: opts.includeDownloads === false
      ? []
      : doc.downloads.map((d) => ({
          id: d.id,
          luc: d.createdAt.toISOString(),
          nguoiTai: d.nguoiTai?.hoTen ?? d.nguoiTaiTen,
          diaChiIp: d.diaChiIp,
        })),
  }
}
