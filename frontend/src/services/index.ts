import type { AuthService } from './contracts/auth'
import type { ApplicationService } from './contracts/application'
import type { ApprovalService, DelegationService, OtpService } from './contracts/approval'
import type { DocumentService, TemplateService, VerifyService } from './contracts/document'
import type { AuditService, ChatService, LibraryService, NotificationService } from './contracts/system'
import type { CatalogService, RequestTypeService, UserService, WorkflowService } from './contracts/catalog'
import type { ServiceRegistry } from './http'

import { mockAuthService, restoreSession } from './mock/authService'
import { mockApplicationService } from './mock/applicationService'
import { mockApprovalService, mockDelegationService, mockOtpService } from './mock/approvalService'
import { mockDocumentService, mockTemplateService, mockVerifyService } from './mock/documentService'
import { mockCatalogService, mockRequestTypeService, mockUserService, mockWorkflowService } from './mock/catalogService'
import { mockAuditService, mockChatService, mockLibraryService, mockNotificationService } from './mock/systemService'
import { resetStore } from './mock/store'
import { httpServices } from './http'

/** Bật/tắt dữ liệu giả lập. Mặc định `true` khi chưa cấu hình. */
export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

const mockServices: ServiceRegistry = {
  auth: mockAuthService,
  applications: mockApplicationService,
  approvals: mockApprovalService,
  otp: mockOtpService,
  delegations: mockDelegationService,
  documents: mockDocumentService,
  templates: mockTemplateService,
  verify: mockVerifyService,
  notifications: mockNotificationService,
  audit: mockAuditService,
  library: mockLibraryService,
  chat: mockChatService,
  requestTypes: mockRequestTypeService,
  workflows: mockWorkflowService,
  users: mockUserService,
  catalog: mockCatalogService,
  resetStore,
}

/** Bộ service đang được dùng — component chỉ truy cập qua `services`. */
export const services: ServiceRegistry = USE_MOCK ? mockServices : httpServices

if (USE_MOCK) {
  // Khôi phục phiên đăng nhập của lần tải trước khi dùng dữ liệu giả lập.
  restoreSession()
}

export type {
  AuthService,
  ApplicationService,
  ApprovalService,
  OtpService,
  DelegationService,
  DocumentService,
  TemplateService,
  VerifyService,
  NotificationService,
  AuditService,
  LibraryService,
  ChatService,
  RequestTypeService,
  WorkflowService,
  UserService,
  CatalogService,
  ServiceRegistry,
}
