import type {
  Application,
  ApplicationDetail,
  AuditLog,
  DocumentTemplate,
  Khoa,
  KhoaHoc,
  Lop,
  Nganh,
  Notification,
  NotificationType,
  PhongBan,
  RequestType,
  Role,
  Signature,
  SignedDocument,
  User,
  Workflow,
} from '@/types'
import { clone, nowIso } from './helpers'
import { APPLICATION_LIST, SIGNATURE_LIST } from './data/applications'
import { AUDIT_LOG_LIST } from './data/auditLogs'
import { DOCUMENT_LIST } from './data/documents'
import { LIBRARY_LIST } from './data/library'
import { NOTIFICATION_LIST } from './data/notifications'
import {
  KHOA_HOC_LIST,
  KHOA_LIST,
  LOP_LIST,
  NGANH_LIST,
  PHONG_BAN_LIST,
} from './data/org'
import { REQUEST_TYPE_LIST } from './data/requestTypes'
import { TEMPLATE_LIST } from './data/templates'
import { USER_LIST } from './data/users'
import { WORKFLOW_LIST } from './data/workflows'
import type { LibraryItem } from '@/types'

export interface Delegation {
  id: string
  nguoiUyQuyenId: string
  nguoiUyQuyenTen: string
  nguoiNhanId: string
  nguoiNhanTen: string
  vaiTro: Role
  tuNgay: string
  denNgay: string
  lyDo: string
  hieuLuc: boolean
  taoLuc: string
}

function buildDelegations(): Delegation[] {
  const now = Date.now()
  const d = (offset: number) => new Date(now + offset * 86_400_000).toISOString()
  return [
    {
      id: 'uq001',
      nguoiUyQuyenId: 'tk001',
      nguoiUyQuyenTen: 'Lê Quang Huy',
      nguoiNhanId: 'tk006',
      nguoiNhanTen: 'Trần Đức Long',
      vaiTro: 'TRUONG_KHOA',
      tuNgay: d(-3),
      denNgay: d(4),
      lyDo: 'Tham dự hội thảo khoa học tại Hà Nội, ủy quyền phê duyệt hồ sơ cấp khoa.',
      hieuLuc: true,
      taoLuc: d(-4),
    },
    {
      id: 'uq002',
      nguoiUyQuyenId: 'pdt001',
      nguoiUyQuyenTen: 'Phạm Thu Hà',
      nguoiNhanId: 'pdt002',
      nguoiNhanTen: 'Ngô Văn Dũng',
      vaiTro: 'PHONG_DAO_TAO',
      tuNgay: d(-10),
      denNgay: d(-6),
      lyDo: 'Nghỉ phép, ủy quyền ký số phát hành văn bản.',
      hieuLuc: false,
      taoLuc: d(-12),
    },
  ]
}

/** Kho dữ liệu trong bộ nhớ — mọi thay đổi chỉ tồn tại trong phiên làm việc. */
export const db = {
  users: clone(USER_LIST),
  applications: clone(APPLICATION_LIST),
  signatures: clone(SIGNATURE_LIST),
  documents: clone(DOCUMENT_LIST),
  notifications: clone(NOTIFICATION_LIST),
  auditLogs: clone(AUDIT_LOG_LIST),
  library: clone(LIBRARY_LIST) as LibraryItem[],
  requestTypes: clone(REQUEST_TYPE_LIST),
  workflows: clone(WORKFLOW_LIST),
  templates: clone(TEMPLATE_LIST),
  khoa: clone(KHOA_LIST) as Khoa[],
  phongBan: clone(PHONG_BAN_LIST) as PhongBan[],
  nganh: clone(NGANH_LIST) as Nganh[],
  lop: clone(LOP_LIST) as Lop[],
  khoaHoc: clone(KHOA_HOC_LIST) as KhoaHoc[],
  delegations: buildDelegations(),
  currentUser: null as User | null,
  seq: { application: 200, document: 200, notification: 900, audit: 900, signature: 900, entity: 100 },
}

export function nextSeq(key: keyof typeof db.seq): number {
  db.seq[key] += 1
  return db.seq[key]
}

export function findApplication(maHoSo: string): Application | undefined {
  return db.applications.find(
    (a) => a.maHoSo === maHoSo || a.id === maHoSo,
  )
}

export function findRequestTypeById(id: string): RequestType | undefined {
  return db.requestTypes.find((r) => r.id === id)
}

export function findWorkflowById(id: string): Workflow | undefined {
  return db.workflows.find((w) => w.id === id)
}

export function findUser(id: string): User | undefined {
  return db.users.find((u) => u.id === id)
}

export function findTemplateById(id: string): DocumentTemplate | undefined {
  return db.templates.find((t) => t.id === id)
}

export function signaturesOf(appId: string): Signature[] {
  return db.signatures
    .filter((s) => s.applicationId === appId)
    .sort((a, b) => a.buocOrder - b.buocOrder)
}

export function documentOfApplication(appId: string): SignedDocument | undefined {
  return db.documents.find((d) => d.applicationId === appId)
}

/** Hồ sơ nằm trong phạm vi hiển thị của người dùng. */
export function inScope(app: Application, user: User): boolean {
  switch (user.role) {
    case 'SINH_VIEN':
      return app.sinhVienId === user.id
    case 'CO_VAN':
      return app.sinhVien.coVanId === user.id
    case 'TRUONG_KHOA': {
      const sv = findUser(app.sinhVienId)
      return !!sv && sv.donViId === user.donViId
    }
    case 'PHONG_DAO_TAO':
    case 'ADMIN':
      return true
    default:
      return false
  }
}

export function scopeApplications(user: User): Application[] {
  return db.applications.filter((a) => inScope(a, user))
}

/** Hồ sơ đang chờ chính người dùng xử lý. */
export function pendingForUser(user: User): Application[] {
  return scopeApplications(user).filter((a) => isWaitingAt(a, user))
}

/** Hồ sơ đang nằm ở bước của vai trò người dùng (kể cả đơn vừa nộp chờ cấp 1 tiếp nhận). */
export function isWaitingAt(app: Application, user: User): boolean {
  if (!app.buocHienTai) return false
  if (
    app.trangThai !== 'PENDING_APPROVAL' &&
    !(app.trangThai === 'SUBMITTED' && app.buocHienTai.order === 1)
  ) {
    return false
  }
  return user.role === 'ADMIN' || app.buocHienTai.role === user.role
}

export function buildDetail(app: Application): ApplicationDetail {
  const requestTypeFull = findRequestTypeById(app.requestTypeId)!
  const workflow = findWorkflowById(app.workflowId)!
  return { ...app, requestTypeFull, workflow }
}

export function addAudit(entry: {
  nguoiThucHien: User
  hanhDong: string
  doiTuong: string
  doiTuongId: string
  giaTriTruoc?: string
  giaTriSau?: string
}): void {
  const log: AuditLog = {
    id: `log_${nextSeq('audit')}`,
    luc: nowIso(),
    nguoiThucHienId: entry.nguoiThucHien.id,
    nguoiThucHienTen: entry.nguoiThucHien.hoTen,
    vaiTro: entry.nguoiThucHien.role,
    hanhDong: entry.hanhDong,
    doiTuong: entry.doiTuong,
    doiTuongId: entry.doiTuongId,
    giaTriTruoc: entry.giaTriTruoc,
    giaTriSau: entry.giaTriSau,
    diaChiIp: '113.161.72.18',
    thietBi: 'Chrome 133 / Windows 11',
  }
  db.auditLogs.unshift(log)
}

export function pushNotification(entry: {
  nguoiNhanId: string
  tieuDe: string
  noiDung: string
  loai: NotificationType
  applicationId?: string
  maHoSo?: string
  lienKet?: string
}): Notification {
  const notification: Notification = {
    id: `tb_${nextSeq('notification')}`,
    daDoc: false,
    luc: nowIso(),
    ...entry,
  }
  db.notifications.unshift(notification)
  return notification
}

/** Thông báo tới tất cả người dùng giữ một vai trò (trừ người vừa thao tác). */
export function notifyRole(
  role: Role,
  payload: Omit<Parameters<typeof pushNotification>[0], 'nguoiNhanId'>,
  exceptUserId?: string,
): void {
  db.users
    .filter((u) => u.role === role && u.id !== exceptUserId)
    .forEach((u) => pushNotification({ ...payload, nguoiNhanId: u.id }))
}

export function resetStore(): void {
  db.applications = clone(APPLICATION_LIST)
  db.signatures = clone(SIGNATURE_LIST)
  db.documents = clone(DOCUMENT_LIST)
  db.notifications = clone(NOTIFICATION_LIST)
  db.auditLogs = clone(AUDIT_LOG_LIST)
  db.users = clone(USER_LIST)
  db.seq = { application: 200, document: 200, notification: 900, audit: 900, signature: 900, entity: 100 }
}
