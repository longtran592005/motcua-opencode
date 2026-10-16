import type { ApplicationDetail, Role, User } from '@/types'
import type { Delegation } from './delegation'

export interface OtpChallenge {
  challengeId: string
  /** Hạn sử dụng mã OTP (ISO). */
  hetHanLuc: string
  /** Số giây còn lại của mã. */
  conLaiGiay: number
  /** Số giây phải chờ trước khi được gửi lại. */
  choGuiLaiGiay: number
  /** Số lần nhập sai còn lại trước khi bị khoá tạm. */
  soLanConLai: number
  /** Thời điểm hết khoá tạm (ISO) nếu đang bị khoá. */
  khoaDenLuc?: string
}

export interface ApproveInput {
  maHoSo: string
  ghiChu?: string
  /** Bắt buộc khi bước duyệt ở chế độ Ký OTP. */
  challengeId?: string
  otp?: string
}

export interface BatchApproveResult {
  thanhCong: string[]
  thatBai: { maHoSo: string; maLoi: string; lyDo: string }[]
}

/**
 * Ký OTP cho bước phê duyệt.
 * Lỗi nghiệp vụ: OTP_INVALID, OTP_EXPIRED, OTP_LOCKED, FORBIDDEN_SCOPE.
 */
export interface OtpService {
  /** Gửi mã OTP tới số điện thoại/email của người ký. */
  gui(maHoSo: string): Promise<OtpChallenge>
  /** Gửi lại mã; bị chặn 30 giây giữa hai lần gửi. */
  guiLai(challengeId: string): Promise<OtpChallenge>
  /** Trạng thái hiện tại của một phiên OTP (để đếm ngược khi mở lại hộp thoại). */
  trangThai(challengeId: string): Promise<OtpChallenge>
}

/**
 * Phê duyệt hồ sơ theo luồng nhiều cấp.
 * Lỗi nghiệp vụ: FORBIDDEN_SCOPE, INVALID_TRANSITION, ALREADY_PROCESSED,
 * VALIDATION_ERROR, OTP_INVALID, OTP_EXPIRED, OTP_LOCKED.
 */
export interface ApprovalService {
  /**
   * Duyệt hồ sơ ở bước hiện tại.
   * - Bước "Một chạm": không cần OTP.
   * - Bước "Ký OTP": bắt buộc `challengeId` + `otp`.
   * Tự động chuyển bước hoặc phát hành văn bản nếu là bước cuối.
   */
  approve(input: ApproveInput): Promise<ApplicationDetail>
  /** Từ chối hồ sơ — bắt buộc có lý do. */
  reject(maHoSo: string, lyDo: string): Promise<ApplicationDetail>
  /** Yêu cầu bổ sung — bắt buộc có nội dung, hồ sơ quay về sinh viên. */
  requestSupplement(maHoSo: string, noiDung: string): Promise<ApplicationDetail>
  /** Duyệt hàng loạt cho các bước "Một chạm". */
  approveBatch(maHoSoList: string[], ghiChu?: string): Promise<BatchApproveResult>
  /** Số hồ sơ đang chờ người dùng hiện tại (dùng cho badge trên menu). */
  pendingCount(): Promise<number>
}

/**
 * Ủy quyền duyệt tạm thời.
 * Lỗi nghiệp vụ: VALIDATION_ERROR, FORBIDDEN_SCOPE.
 */
export interface DelegationService {
  list(): Promise<Delegation[]>
  create(input: {
    nguoiNhanId: string
    vaiTro: Role
    tuNgay: string
    denNgay: string
    lyDo: string
  }): Promise<Delegation>
  cancel(id: string): Promise<void>
  /** Danh sách người có thể nhận ủy quyền theo vai trò. */
  eligibleUsers(vaiTro: Role): Promise<User[]>
}
