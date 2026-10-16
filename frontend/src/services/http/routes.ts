import type {
  ApplicationListQuery,
  CreateApplicationPayload,
  LoginPayload,
  Role,
  User,
} from '@/types'
import type { AuthService } from '../contracts/auth'
import type { ApplicationService, SupplementInput } from '../contracts/application'
import type {
  ApproveInput,
  ApprovalService,
  DelegationService,
  OtpService,
} from '../contracts/approval'
import type {
  DocumentListQuery,
  DocumentService,
  TemplateService,
  VerifyService,
} from '../contracts/document'
import type {
  RequestTypeService,
  UserService,
  WorkflowService,
} from '../contracts/catalog'
import type { AuditService, LibraryService, NotificationService } from '../contracts/system'
import type { DocumentTemplate, RequestType, Workflow } from '@/types'
import { createHttpService } from './client'

const q = (v: ApplicationListQuery | DocumentListQuery | undefined) =>
  (v ?? {}) as Record<string, unknown>

export const httpAuthService: AuthService = createHttpService<AuthService>({
  login: { method: 'POST', path: () => '/auth/login', body: (p: LoginPayload) => p },
  quickLogin: {
    method: 'POST',
    path: () => '/auth/quick-login',
    body: (role: Role) => ({ role }),
  },
  me: { method: 'GET', path: () => '/auth/me' },
  logout: { method: 'POST', path: () => '/auth/logout' },
  updateProfile: {
    method: 'PATCH',
    path: () => '/auth/profile',
    body: (patch: Partial<User>) => patch,
  },
})

export const httpApplicationService: ApplicationService = createHttpService<ApplicationService>({
  listMine: { method: 'GET', path: () => '/applications/mine', query: (v: ApplicationListQuery) => q(v) },
  recentMine: { method: 'GET', path: () => '/applications/mine/recent', query: (limit: number) => ({ limit }) },
  statsMine: { method: 'GET', path: () => '/applications/mine/stats' },
  getByCode: { method: 'GET', path: (ma: string) => `/applications/${ma}` },
  createDraft: {
    method: 'POST',
    path: () => '/applications',
    body: (p: CreateApplicationPayload) => p,
  },
  updateDraft: {
    method: 'PUT',
    path: (ma: string) => `/applications/${ma}`,
    body: (ma: string, p: CreateApplicationPayload) => {
      void ma
      return p
    },
  },
  deleteDraft: { method: 'DELETE', path: (ma: string) => `/applications/${ma}` },
  submit: { method: 'POST', path: (ma: string) => `/applications/${ma}/submit` },
  cancel: {
    method: 'POST',
    path: (ma: string) => `/applications/${ma}/cancel`,
    body: (ma: string, lyDo?: string) => {
      void ma
      return { lyDo }
    },
  },
  supplement: {
    method: 'POST',
    path: (ma: string) => `/applications/${ma}/supplement`,
    body: (ma: string, input: SupplementInput) => {
      void ma
      return input
    },
  },
  listForApproval: { method: 'GET', path: () => '/approvals/pending', query: (v: ApplicationListQuery) => q(v) },
  listProcessed: { method: 'GET', path: () => '/approvals/processed', query: (v: ApplicationListQuery) => q(v) },
  statsApproval: { method: 'GET', path: () => '/approvals/stats' },
  listOverdue: { method: 'GET', path: () => '/approvals/overdue', query: (limit: number) => ({ limit }) },
  requestTypes: { method: 'GET', path: () => '/request-types', query: () => ({ hoatDong: true }) },
  allowedRequestTypes: { method: 'GET', path: (userId: string) => `/users/${userId}/request-types` },
  nextApproverRoles: { method: 'GET', path: (ma: string) => `/applications/${ma}/next-approver-roles` },
})

export const httpApprovalService: ApprovalService = createHttpService<ApprovalService>({
  approve: {
    method: 'POST',
    path: (input: ApproveInput) => `/approvals/${input.maHoSo}/approve`,
    body: (input: ApproveInput) => ({
      ghiChu: input.ghiChu,
      challengeId: input.challengeId,
      otp: input.otp,
    }),
  },
  reject: {
    method: 'POST',
    path: (ma: string) => `/approvals/${ma}/reject`,
    body: (ma: string, lyDo: string) => {
      void ma
      return { lyDo }
    },
  },
  requestSupplement: {
    method: 'POST',
    path: (ma: string) => `/approvals/${ma}/request-supplement`,
    body: (ma: string, noiDung: string) => {
      void ma
      return { noiDung }
    },
  },
  approveBatch: {
    method: 'POST',
    path: () => '/approvals/batch',
    body: (maHoSoList: string[], ghiChu?: string) => ({ maHoSoList, ghiChu }),
  },
  pendingCount: { method: 'GET', path: () => '/approvals/pending-count' },
})

export const httpOtpService: OtpService = createHttpService<OtpService>({
  gui: { method: 'POST', path: () => '/otp/send', body: (maHoSo: string) => ({ maHoSo }) },
  guiLai: { method: 'POST', path: (id: string) => `/otp/${id}/resend` },
  trangThai: { method: 'GET', path: (id: string) => `/otp/${id}` },
})

export const httpDelegationService: DelegationService = createHttpService<DelegationService>({
  list: { method: 'GET', path: () => '/delegations' },
  create: { method: 'POST', path: () => '/delegations' },
  cancel: { method: 'DELETE', path: (id: string) => `/delegations/${id}` },
  eligibleUsers: {
    method: 'GET',
    path: () => '/delegations/eligible-users',
    query: (vaiTro: Role) => ({ vaiTro }),
  },
})

export const httpDocumentService: DocumentService = createHttpService<DocumentService>({
  getByApplication: { method: 'GET', path: (ma: string) => `/applications/${ma}/document` },
  listIssued: { method: 'GET', path: () => '/documents', query: (v: DocumentListQuery) => q(v) },
  revoke: {
    method: 'POST',
    path: (id: string) => `/documents/${id}/revoke`,
    body: (id: string, lyDo: string) => {
      void id
      return { lyDo }
    },
  },
  logDownload: { method: 'POST', path: (id: string) => `/documents/${id}/download-log` },
  exportAs: {
    method: 'GET',
    path: (id: string) => `/documents/${id}/export`,
    query: (id: string, dinhDang: 'pdf' | 'html') => {
      void id
      return { dinhDang }
    },
  },
  report: { method: 'GET', path: () => '/documents/report' },
  reportRows: { method: 'GET', path: () => '/documents/report/rows' },
})

export const httpTemplateService: TemplateService = createHttpService<TemplateService>({
  list: { method: 'GET', path: () => '/templates' },
  get: { method: 'GET', path: (id: string) => `/templates/${id}` },
  create: {
    method: 'POST',
    path: () => '/templates',
    body: (input: Omit<DocumentTemplate, 'id' | 'capNhatLuc'>) => input,
  },
  update: {
    method: 'PATCH',
    path: (id: string) => `/templates/${id}`,
    body: (id: string, patch: Partial<DocumentTemplate>) => {
      void id
      return patch
    },
  },
  remove: { method: 'DELETE', path: (id: string) => `/templates/${id}` },
  renderPreview: {
    method: 'POST',
    path: (id: string) => `/templates/${id}/render`,
    body: (id: string, values: Record<string, string>) => {
      void id
      return { values }
    },
  },
})

export const httpVerifyService: VerifyService = createHttpService<VerifyService>({
  byToken: { method: 'GET', path: (token: string) => `/public/verify/token/${token}` },
  bySoVanBan: { method: 'GET', path: (so: string) => `/public/verify/so-van-ban/${encodeURIComponent(so)}` },
  compareFileHash: {
    method: 'POST',
    path: (token: string) => `/public/verify/token/${token}/compare`,
    body: (token: string, maBamNguoiDung: string) => {
      void token
      return { maBamNguoiDung }
    },
  },
  recentDocuments: {
    method: 'GET',
    path: () => '/public/verify/recent',
    query: (limit: number) => ({ limit }),
  },
})

export const httpNotificationService: NotificationService = createHttpService<NotificationService>({
  listMine: { method: 'GET', path: () => '/notifications' },
  unreadCount: { method: 'GET', path: () => '/notifications/unread-count' },
  markRead: { method: 'POST', path: (id: string) => `/notifications/${id}/read` },
  markAllRead: { method: 'POST', path: () => '/notifications/read-all' },
  remove: { method: 'DELETE', path: (id: string) => `/notifications/${id}` },
})

export const httpAuditService: AuditService = createHttpService<AuditService>({
  list: { method: 'GET', path: () => '/audit-logs', query: (v: Record<string, unknown>) => v },
  get: { method: 'GET', path: (id: string) => `/audit-logs/${id}` },
  actions: { method: 'GET', path: () => '/audit-logs/actions' },
})

export const httpLibraryService: LibraryService = createHttpService<LibraryService>({
  list: {
    method: 'GET',
    path: () => '/library',
    query: (v: { tuKhoa?: string; nhom?: string }) => v,
  },
  groups: { method: 'GET', path: () => '/library/groups' },
  get: { method: 'GET', path: (id: string) => `/library/${id}` },
  download: { method: 'POST', path: (id: string) => `/library/${id}/download` },
})

export const httpRequestTypeService: RequestTypeService = createHttpService<RequestTypeService>({
  list: { method: 'GET', path: () => '/request-types' },
  listActive: { method: 'GET', path: () => '/request-types', query: () => ({ hoatDong: true }) },
  get: { method: 'GET', path: (id: string) => `/request-types/${id}` },
  create: {
    method: 'POST',
    path: () => '/request-types',
    body: (input: Omit<RequestType, 'id'>) => input,
  },
  update: {
    method: 'PATCH',
    path: (id: string) => `/request-types/${id}`,
    body: (id: string, patch: Partial<RequestType>) => {
      void id
      return patch
    },
  },
  remove: { method: 'DELETE', path: (id: string) => `/request-types/${id}` },
  stats: { method: 'GET', path: () => '/request-types/stats' },
})

export const httpWorkflowService: WorkflowService = createHttpService<WorkflowService>({
  list: { method: 'GET', path: () => '/workflows' },
  get: { method: 'GET', path: (id: string) => `/workflows/${id}` },
  create: {
    method: 'POST',
    path: () => '/workflows',
    body: (input: Omit<Workflow, 'id'>) => input,
  },
  update: {
    method: 'PATCH',
    path: (id: string) => `/workflows/${id}`,
    body: (id: string, patch: Partial<Workflow>) => {
      void id
      return patch
    },
  },
  remove: { method: 'DELETE', path: (id: string) => `/workflows/${id}` },
  validate: {
    method: 'POST',
    path: () => '/workflows/validate',
    body: (workflow: Pick<Workflow, 'steps'>) => workflow,
  },
})

export const httpUserService: UserService = createHttpService<UserService>({
  list: { method: 'GET', path: () => '/users', query: (v: Record<string, unknown>) => v ?? {} },
  get: { method: 'GET', path: (id: string) => `/users/${id}` },
  create: { method: 'POST', path: () => '/users', body: (input: Omit<User, 'id'>) => input },
  update: {
    method: 'PATCH',
    path: (id: string) => `/users/${id}`,
    body: (id: string, patch: Partial<User>) => {
      void id
      return patch
    },
  },
  remove: { method: 'DELETE', path: (id: string) => `/users/${id}` },
  resetPassword: { method: 'POST', path: (id: string) => `/users/${id}/reset-password` },
  advisors: { method: 'GET', path: () => '/users/advisors' },
})
