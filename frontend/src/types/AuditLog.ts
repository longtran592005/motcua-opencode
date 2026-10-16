import type { Role } from './Role'

export interface AuditLog {
  id: string
  luc: string
  nguoiThucHienId: string
  nguoiThucHienTen: string
  vaiTro: Role
  /** Mã hành động, ví dụ APPROVE_APPLICATION. */
  hanhDong: string
  doiTuong: string
  doiTuongId: string
  giaTriTruoc?: string
  giaTriSau?: string
  diaChiIp: string
  thietBi: string
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  CREATE_APPLICATION: 'Tạo hồ sơ',
  SUBMIT_APPLICATION: 'Nộp hồ sơ',
  APPROVE_APPLICATION: 'Duyệt hồ sơ',
  REJECT_APPLICATION: 'Từ chối hồ sơ',
  REQUEST_SUPPLEMENT: 'Yêu cầu bổ sung',
  SUPPLEMENT_APPLICATION: 'Bổ sung hồ sơ',
  CANCEL_APPLICATION: 'Rút hồ sơ',
  ISSUE_DOCUMENT: 'Cấp văn bản',
  REVOKE_DOCUMENT: 'Thu hồi văn bản',
  UPDATE_REQUEST_TYPE: 'Cập nhật loại đơn',
  UPDATE_WORKFLOW: 'Cập nhật luồng duyệt',
  UPDATE_TEMPLATE: 'Cập nhật mẫu văn bản',
  UPDATE_USER: 'Cập nhật người dùng',
  DELEGATE_APPROVAL: 'Ủy quyền duyệt',
  DOWNLOAD_DOCUMENT: 'Tải văn bản',
}
