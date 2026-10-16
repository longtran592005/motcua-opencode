import type {
  DocumentStatus,
  DocumentTemplate,
  Paginated,
  SignedDocument,
  VerifyResult,
} from '@/types'

export interface DocumentListQuery {
  page?: number
  pageSize?: number
  tuKhoa?: string
  trangThai?: DocumentStatus | 'ALL'
  loaiVanBan?: string
  khoa?: string
  tuNgay?: string
  denNgay?: string
}

export interface ReportRow {
  ten: string
  soLuong: number
  tyLe: number
}

export interface AvgStepDuration {
  buoc: string
  vaiTro: string
  gioTrungBinh: number
  soHoSo: number
}

export interface ReportOverview {
  tongHoSo: number
  hoanThanh: number
  dangXuLy: number
  tuChoi: number
  quaHan: number
  tyLeDungHan: number
  thoiGianXuLyTrungBinhGio: number
  theoLoaiDon: ReportRow[]
  theoKhoa: ReportRow[]
  theoTrangThai: ReportRow[]
  thoiGianTungBuoc: AvgStepDuration[]
  theoThang: { thang: string; nop: number; hoanThanh: number }[]
}

/**
 * Văn bản đã cấp và xác thực.
 * Lỗi nghiệp vụ: NOT_FOUND, DOCUMENT_REVOKED, VALIDATION_ERROR, FORBIDDEN_SCOPE.
 */
export interface DocumentService {
  /** Văn bản của một hồ sơ (dùng cho trang xem trước A4). */
  getByApplication(maHoSo: string): Promise<SignedDocument>
  /** Danh sách văn bản đã cấp (trang quản trị). */
  listIssued(query: DocumentListQuery): Promise<Paginated<SignedDocument>>
  /** Thu hồi văn bản — bắt buộc nhập lý do. */
  revoke(id: string, lyDo: string): Promise<SignedDocument>
  /** Ghi nhận một lượt tải văn bản (phục vụ lịch sử tải). */
  logDownload(id: string): Promise<SignedDocument>
  /** Xuất nội dung văn bản để tải/in. */
  exportAs(id: string, dinhDang: 'pdf' | 'html'): Promise<{ ten: string; noiDung: string; mime: string }>
  /** Thống kê phục vụ trang Báo cáo. */
  report(): Promise<ReportOverview>
  reportRows(): Promise<{
    theoLoaiDon: ReportRow[]
    theoKhoa: ReportRow[]
    theoTrangThai: ReportRow[]
    thoiGianTungBuoc: AvgStepDuration[]
  }>
}

/**
 * Quản lý mẫu văn bản có biến {{...}}.
 * Lỗi nghiệp vụ: NOT_FOUND, VALIDATION_ERROR.
 */
export interface TemplateService {
  list(): Promise<DocumentTemplate[]>
  get(id: string): Promise<DocumentTemplate>
  create(input: Omit<DocumentTemplate, 'id' | 'capNhatLuc'>): Promise<DocumentTemplate>
  update(id: string, patch: Partial<DocumentTemplate>): Promise<DocumentTemplate>
  remove(id: string): Promise<void>
  /** Kết xuất nội dung mẫu với bộ giá trị cho trước (phục vụ xem trước A4). */
  renderPreview(id: string, values: Record<string, string>): Promise<string>
}

/**
 * Tra cứu & xác thực văn bản điện tử (trang công khai).
 * Lỗi nghiệp vụ: NOT_FOUND, DOCUMENT_REVOKED.
 */
export interface VerifyService {
  byToken(token: string): Promise<VerifyResult>
  bySoVanBan(soVanBan: string): Promise<VerifyResult>
  /** Tải tệp PDF lên, tính mã băm và đối chiếu với mã băm đã lưu. */
  compareFileHash(token: string, maBamNguoiDung: string): Promise<VerifyResult>
  /** Một số văn bản mới cấp để gợi ý tra cứu. */
  recentDocuments(limit?: number): Promise<SignedDocument[]>
}
