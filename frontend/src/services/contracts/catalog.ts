import type {
  Khoa,
  KhoaHoc,
  Lop,
  Nganh,
  Paginated,
  PhongBan,
  RequestType,
  Role,
  User,
  UserStatus,
  Workflow,
} from '@/types'

/** Khuôn chung cho các danh mục đơn giản. */
export interface CrudService<T> {
  list(): Promise<T[]>
  create(input: Omit<T, 'id'>): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  remove(id: string): Promise<void>
}

/**
 * Quản lý loại đơn và biểu mẫu động.
 * Lỗi nghiệp vụ: NOT_FOUND, VALIDATION_ERROR, FORBIDDEN_SCOPE.
 */
export interface RequestTypeService {
  list(): Promise<RequestType[]>
  listActive(): Promise<RequestType[]>
  get(id: string): Promise<RequestType>
  create(input: Omit<RequestType, 'id'>): Promise<RequestType>
  update(id: string, patch: Partial<RequestType>): Promise<RequestType>
  remove(id: string): Promise<void>
  /** Số lượt nộp theo từng loại đơn. */
  stats(): Promise<{ requestTypeId: string; ten: string; ma: string; soLuong: number }[]>
}

/**
 * Quản lý luồng duyệt nhiều cấp.
 * Lỗi nghiệp vụ: NOT_FOUND, VALIDATION_ERROR, INVALID_TRANSITION.
 */
export interface WorkflowService {
  list(): Promise<Workflow[]>
  get(id: string): Promise<Workflow>
  create(input: Omit<Workflow, 'id'>): Promise<Workflow>
  update(id: string, patch: Partial<Workflow>): Promise<Workflow>
  remove(id: string): Promise<void>
  /** Kiểm tra tính hợp lệ của luồng: có bước, thứ tự liên tục, có ít nhất một bước OTP. */
  validate(workflow: Pick<Workflow, 'steps'>): Promise<{ hopLe: boolean; canhBao: string[] }>
}

/**
 * Quản lý người dùng và vai trò.
 * Lỗi nghiệp vụ: NOT_FOUND, VALIDATION_ERROR, FORBIDDEN_SCOPE.
 */
export interface UserService {
  list(query?: {
    page?: number
    pageSize?: number
    tuKhoa?: string
    vaiTro?: Role | 'ALL'
    trangThai?: UserStatus | 'ALL'
    donViId?: string
  }): Promise<Paginated<User>>
  get(id: string): Promise<User>
  create(input: Omit<User, 'id'>): Promise<User>
  update(id: string, patch: Partial<User>): Promise<User>
  remove(id: string): Promise<void>
  /** Đặt lại mật khẩu về mặc định, trả về mật khẩu tạm. */
  resetPassword(id: string): Promise<{ matKhauTam: string }>
  /** Danh sách cố vấn học tập để gán cho lớp. */
  advisors(): Promise<User[]>
}

/**
 * Danh mục dùng chung: Khoa, Phòng ban, Ngành, Lớp, Khóa học.
 * Lỗi nghiệp vụ: NOT_FOUND, VALIDATION_ERROR.
 */
export interface CatalogService {
  khoa: CrudService<Khoa>
  phongBan: CrudService<PhongBan>
  nganh: CrudService<Nganh>
  lop: CrudService<Lop>
  khoaHoc: CrudService<KhoaHoc>
}
