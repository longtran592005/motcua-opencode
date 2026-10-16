import type {
  Application,
  ApplicationDetail,
  ApplicationListQuery,
  ApplicationStatus,
  Attachment,
  CreateApplicationPayload,
  Paginated,
  RequestType,
  Role,
} from '@/types'

export interface MyStats {
  nhap: number
  dangXuLy: number
  canBoSung: number
  hoanThanh: number
  tong: number
}

export interface ApprovalStats {
  choToiDuyet: number
  sapHetHan: number
  quaHan: number
  daXuLyTuanNay: number
  theoTrangThai: { trangThai: ApplicationStatus; nhan: string; soLuong: number }[]
  theoLoaiDon: { ten: string; soLuong: number }[]
  theoKhoa: { ten: string; soLuong: number }[]
  xuHuong7Ngay: { ngay: string; nop: number; duyet: number }[]
}

export interface SupplementInput {
  duLieu?: Record<string, unknown>
  tepDinhKem?: Attachment[]
  ghiChu?: string
}

/**
 * Hồ sơ một cửa — cả phía sinh viên và phía người xử lý.
 * Lỗi nghiệp vụ: NOT_FOUND, FORBIDDEN_SCOPE, INVALID_TRANSITION, MISSING_ATTACHMENT.
 */
export interface ApplicationService {
  /* ------------------------------ Sinh viên ------------------------------ */
  listMine(query: ApplicationListQuery): Promise<Paginated<Application>>
  recentMine(limit?: number): Promise<Application[]>
  statsMine(): Promise<MyStats>
  getByCode(maHoSo: string): Promise<ApplicationDetail>
  /** Tạo bản nháp mới (chưa sinh mã hồ sơ chính thức ở bản thật). */
  createDraft(payload: CreateApplicationPayload): Promise<Application>
  updateDraft(maHoSo: string, payload: CreateApplicationPayload): Promise<Application>
  deleteDraft(maHoSo: string): Promise<void>
  /** Nộp hồ sơ: kiểm tra giấy tờ bắt buộc và đưa vào bước duyệt đầu tiên. */
  submit(maHoSo: string): Promise<Application>
  cancel(maHoSo: string, lyDo?: string): Promise<Application>
  /** Bổ sung hồ sơ đang ở trạng thái Cần bổ sung. */
  supplement(maHoSo: string, input: SupplementInput): Promise<Application>

  /* --------------------------- Người phê duyệt --------------------------- */
  listForApproval(query: ApplicationListQuery): Promise<Paginated<Application>>
  listProcessed(query: ApplicationListQuery): Promise<Paginated<Application>>
  statsApproval(): Promise<ApprovalStats>
  /** Danh sách hồ sơ quá hạn để cảnh báo trên trang tổng quan. */
  listOverdue(limit?: number): Promise<Application[]>

  /* ------------------------------- Dùng chung ---------------------------- */
  requestTypes(): Promise<RequestType[]>
  /** Các loại đơn được phép nộp cho một vai trò/đơn vị cụ thể. */
  allowedRequestTypes(userId: string): Promise<RequestType[]>
  /** Người phụ trách bước tiếp theo, phục vụ hiển thị "chờ ai duyệt". */
  nextApproverRoles(maHoSo: string): Promise<Role[]>
}
