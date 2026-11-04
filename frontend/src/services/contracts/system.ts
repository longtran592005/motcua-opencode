import type { AuditLog, LibraryItem, Notification, Paginated } from '@/types'

/**
 * Thông báo trong hệ thống.
 * Lỗi nghiệp vụ: NOT_FOUND, FORBIDDEN_SCOPE.
 */
export interface NotificationService {
  listMine(): Promise<Notification[]>
  unreadCount(): Promise<number>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
  remove(id: string): Promise<void>
}

/**
 * Nhật ký hệ thống (chỉ đọc).
 * Lỗi nghiệp vụ: FORBIDDEN_SCOPE.
 */
export interface AuditService {
  list(query: {
    page?: number
    pageSize?: number
    tuKhoa?: string
    nguoiThucHienId?: string
    hanhDong?: string
    tuNgay?: string
    denNgay?: string
  }): Promise<Paginated<AuditLog>>
  get(id: string): Promise<AuditLog>
  /** Danh sách hành động đã xuất hiện, dùng cho bộ lọc. */
  actions(): Promise<{ ma: string; nhan: string }[]>
}

/**
 * Thư viện biểu mẫu và văn bản.
 * Lỗi nghiệp vụ: NOT_FOUND.
 */
export interface LibraryService {
  list(query?: { tuKhoa?: string; nhom?: string }): Promise<LibraryItem[]>
  groups(): Promise<string[]>
  get(id: string): Promise<LibraryItem>
  /**
   * Ghi nhận lượt tải và trả về thông tin tệp để trình duyệt tải về.
   * `url` là đường dẫn tệp tĩnh (backend nên trả về liên kết tải trực tiếp hoặc link có chữ ký);
   * nếu không có `url`, frontend sẽ tải `noiDung` dưới dạng văn bản.
   */
  download(id: string): Promise<{ ten: string; noiDung: string; mime: string; url?: string }>
}

export interface ChatSource {
  tenFile: string
  trang: number
  trichDoan: string
}

export interface ChatFormSuggestion {
  requestTypeId: string
  ten: string
}

/** Hành động do SERVER dựng (mô hình không tự sinh). */
export interface ChatAction {
  id: string
  kieu: 'OPEN_FORM' | 'DOWNLOAD_FORM' | 'OPEN_APPLICATION' | 'DRAFT_PROPOSAL' | 'OFFER_HANDOFF'
  ten?: string
  maLoiDon?: string
  tenLoaiDon?: string
  duongDan?: string
  maHoSo?: string
  cacTruong?: Array<{ ten: string; nhan: string; giaTriGoiY: string; batBuoc?: boolean }>
  canhBao?: string[]
  expiresAt?: string
  daDung?: boolean
}

export interface ChatChunk {
  /** 'token' = mảnh nội dung đang chảy; 'nguon' = trích nguồn; 'xong' = kết thúc. */
  loai: 'token' | 'nguon' | 'xong'
  noiDung?: string
  nguon?: ChatSource[]
  goiYForm?: ChatFormSuggestion
  traLoiDayDu?: string
  maLoi?: string
  /* Bổ sung giai đoạn chatbot (tương thích ngược — thiếu vẫn bình thường). */
  hanhDong?: ChatAction[]
  cheDo?: 'LLM' | 'SEARCH_ONLY'
  sessionId?: string
  messageId?: string
}

/** Kết quả xác nhận tạo bản nháp từ hành động DRAFT_PROPOSAL. */
export interface ChatDraftResult {
  maHoSo: string
  duongDan: string
  trangThai?: string
}

/** Câu hỏi đã chuyển lên cán bộ (handoff). */
export interface ChatHandoffItem {
  id: string
  ma: string
  question: string
  context?: string | null
  status: 'OPEN' | 'ANSWERED' | 'CLOSED'
  answer?: string | null
  createdAt: string
}

/**
 * Trợ lý ảo hỏi đáp thủ tục hành chính.
 * Lỗi nghiệp vụ: NETWORK_ERROR, VALIDATION_ERROR, RATE_LIMITED.
 */
export interface ChatService {
  /** Trả lời dạng streaming: lần lượt phát ra các mảnh nội dung rồi tới nguồn trích dẫn. */
  hoi(cauHoi: string, sessionId?: string): AsyncGenerator<ChatChunk, void, unknown>
  /** Gợi ý câu hỏi nhanh. */
  cauHoiGoiY(): Promise<string[]>
  /** Đánh giá câu trả lời hữu ích / không hữu ích. */
  danhGia(messageId: string, huuIch: boolean): Promise<void>
  /** (Mới) Xác nhận tạo bản nháp từ hành động DRAFT_PROPOSAL. */
  taoBanNhap?(actionId: string): Promise<ChatDraftResult>
  /** (Mới) Gửi câu hỏi mở hiện tại cho cán bộ Phòng Đào tạo. */
  guiCanBo?(sessionId?: string, cauHoi?: string): Promise<{ ma: string; trangThai: string }>
  /** (Mới) Danh sách câu hỏi đã gửi của người dùng + câu trả lời cán bộ. */
  cauHoiDaGui?(): Promise<ChatHandoffItem[]>
}
