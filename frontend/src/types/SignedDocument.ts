import type { Signature } from './Signature'

export const DOCUMENT_STATUSES = ['VALID', 'REVOKED', 'INVALID'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  VALID: 'Hợp lệ',
  REVOKED: 'Đã thu hồi',
  INVALID: 'Không hợp lệ',
}

export interface DocumentDownloadLog {
  id: string
  luc: string
  nguoiTai: string
  diaChiIp: string
}

export interface SignedDocument {
  id: string
  soVanBan: string
  trichYeu: string
  loaiVanBan: string
  templateId: string
  applicationId: string
  maHoSo: string
  sinhVien: {
    hoTen: string
    mssv: string
    lop: string
    khoa: string
    nganh: string
    khoaHoc: string
  }
  noiDung: string
  ngayCap: string
  /** Token dùng cho đường dẫn /xac-thuc/:token. */
  tokenXacThuc: string
  maBamSha256: string
  chuKy: Signature[]
  trangThai: DocumentStatus
  /** Chữ ký còn hợp lệ hay nội dung đã bị thay đổi sau khi ký. */
  chuKyConHieuLuc: boolean
  lyDoThuHoi?: string
  ngayThuHoi?: string
  luotTai: DocumentDownloadLog[]
}

export interface VerifyResult {
  trangThai: DocumentStatus
  vanBan: SignedDocument
  /** Kết quả đối chiếu mã băm khi người dùng tải tệp lên. */
  ketQuaDoiChieu?: {
    maBamNguoiDung: string
    trungKhop: boolean
    luc: string
  }
}

export interface DocumentTemplate {
  id: string
  ma: string
  ten: string
  loaiVanBan: string
  /** Nội dung có biến dạng {{ho_ten}}, {{mssv}}, {{so_van_ban}}... */
  noiDung: string
  hoatDong: boolean
  capNhatLuc: string
}

export interface LibraryItem {
  id: string
  ten: string
  nhom: string
  moTa: string
  loaiTep: 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls'
  kichThuoc: string
  capNhatLuc: string
  luotTai: number
  /** Đường dẫn tệp trong `public/` (tệp thật do nhà trường ban hành). */
  url: string
  batBuocVoiLoaiDon?: string[]
}
