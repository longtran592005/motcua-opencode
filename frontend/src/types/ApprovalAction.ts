import type { Role } from './Role'

/** Hành động trong lịch sử xử lý hồ sơ. */
export const APPROVAL_ACTION_TYPES = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'REQUEST_SUPPLEMENT',
  'SUPPLEMENT',
  'CANCEL',
  'ISSUE_DOCUMENT',
  'REVOKE_DOCUMENT',
] as const

export type ApprovalActionType = (typeof APPROVAL_ACTION_TYPES)[number]

export const APPROVAL_ACTION_LABELS: Record<ApprovalActionType, string> = {
  SUBMIT: 'Nộp hồ sơ',
  APPROVE: 'Duyệt hồ sơ',
  REJECT: 'Từ chối hồ sơ',
  REQUEST_SUPPLEMENT: 'Yêu cầu bổ sung',
  SUPPLEMENT: 'Bổ sung hồ sơ',
  CANCEL: 'Rút hồ sơ',
  ISSUE_DOCUMENT: 'Cấp văn bản',
  REVOKE_DOCUMENT: 'Thu hồi văn bản',
}

export interface ApprovalAction {
  id: string
  applicationId: string
  /** 0 = do sinh viên thực hiện (nộp, bổ sung, rút). */
  buocOrder: number
  hanhDong: ApprovalActionType
  nguoiThucHienId: string
  nguoiThucHienTen: string
  chucVu?: string
  vaiTro: Role
  ghiChu?: string
  lyDo?: string
  /** Phương thức ký của lần duyệt này. */
  phuongThuc?: 'ONE_CLICK' | 'OTP'
  luc: string
  signatureId?: string
}
