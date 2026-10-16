import type { LoginPayload, Role, Session, User } from '@/types'

/**
 * Xác thực & phiên làm việc.
 * Lỗi nghiệp vụ: UNAUTHORIZED (sai thông tin đăng nhập), FORBIDDEN_SCOPE.
 */
export interface AuthService {
  /** Đăng nhập bằng mã số sinh viên/cán bộ hoặc email. */
  login(payload: LoginPayload): Promise<Session>
  /** Đăng nhập nhanh theo vai trò — chỉ phục vụ trình diễn. */
  quickLogin(role: Role): Promise<Session>
  /** Lấy người dùng của phiên hiện tại. */
  me(): Promise<User>
  logout(): Promise<void>
  /** Cập nhật hồ sơ cá nhân (họ tên, điện thoại, ảnh đại diện). */
  updateProfile(patch: Partial<User>): Promise<User>
}
