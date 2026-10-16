export const NOTIFICATION_TYPES = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'DANGER',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface Notification {
  id: string
  tieuDe: string
  noiDung: string
  loai: NotificationType
  nguoiNhanId: string
  applicationId?: string
  maHoSo?: string
  daDoc: boolean
  luc: string
  /** Đường dẫn nội bộ mở khi bấm vào thông báo. */
  lienKet?: string
}
