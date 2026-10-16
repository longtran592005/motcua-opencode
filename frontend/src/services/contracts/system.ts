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

export interface ChatChunk {
  /** 'token' = mảnh nội dung đang chảy; 'nguon' = trích nguồn; 'xong' = kết thúc. */
  loai: 'token' | 'nguon' | 'xong'
  noiDung?: string
  nguon?: ChatSource[]
  goiYForm?: ChatFormSuggestion
  traLoiDayDu?: string
  maLoi?: string
}

/**
 * Trợ lý ảo hỏi đáp thủ tục hành chính.
 * Lỗi nghiệp vụ: NETWORK_ERROR, VALIDATION_ERROR.
 */
export interface ChatService {
  /** Trả lời dạng streaming: lần lượt phát ra các mảnh nội dung rồi tới nguồn trích dẫn. */
  hoi(cauHoi: string): AsyncGenerator<ChatChunk, void, unknown>
  /** Gợi ý câu hỏi nhanh. */
  cauHoiGoiY(): Promise<string[]>
  /** Đánh giá câu trả lời hữu ích / không hữu ích. */
  danhGia(messageId: string, huuIch: boolean): Promise<void>
}
