import type { ChatChunk, ChatService, LibraryService, NotificationService, AuditService } from '../contracts/system'
import type { CatalogService, CrudService, RequestTypeService, UserService, WorkflowService } from '../contracts/catalog'
import type { ApprovalService, DelegationService, OtpService } from '../contracts/approval'
import type { DocumentService, TemplateService, VerifyService } from '../contracts/document'
import type { ApplicationService } from '../contracts/application'
import type { AuthService } from '../contracts/auth'
import { API_URL, getToken, request } from './client'
import {
  httpApplicationService,
  httpApprovalService,
  httpAuditService,
  httpAuthService,
  httpDelegationService,
  httpDocumentService,
  httpLibraryService,
  httpNotificationService,
  httpOtpService,
  httpRequestTypeService,
  httpTemplateService,
  httpUserService,
  httpVerifyService,
  httpWorkflowService,
} from './routes'

function httpCrud<T extends { id: string }>(base: string): CrudService<T> {
  return {
    list: () => request<T[]>(base),
    create: (input) => request<T>(base, { method: 'POST', body: input }),
    update: (id, patch) => request<T>(`${base}/${id}`, { method: 'PATCH', body: patch }),
    remove: (id) => request<void>(`${base}/${id}`, { method: 'DELETE' }),
  }
}

const httpCatalogService: CatalogService = {
  khoa: httpCrud('/catalog/khoa'),
  phongBan: httpCrud('/catalog/phong-ban'),
  nganh: httpCrud('/catalog/nganh'),
  lop: httpCrud('/catalog/lop'),
  khoaHoc: httpCrud('/catalog/khoa-hoc'),
}

/** Đọc luồng Server-Sent Events cho câu trả lời của trợ lý ảo. */
async function* streamChat(cauHoi: string): AsyncGenerator<ChatChunk, void, unknown> {
  const response = await fetch(`${API_URL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({ cauHoi }),
  })
  if (!response.ok || !response.body) {
    yield { loai: 'xong', maLoi: 'NETWORK_ERROR', traLoiDayDu: '' }
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const data = part.replace(/^data:\s*/, '').trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data) as ChatChunk
      } catch {
        yield { loai: 'token', noiDung: data }
      }
    }
  }
}

const httpChatService: ChatService = {
  hoi: streamChat,
  cauHoiGoiY: () => request<string[]>('/chat/suggestions'),
  danhGia: (messageId, huuIch) =>
    request<void>(`/chat/messages/${messageId}/feedback`, {
      method: 'POST',
      body: { huuIch },
    }),
}

export interface ServiceRegistry {
  auth: AuthService
  applications: ApplicationService
  approvals: ApprovalService
  otp: OtpService
  delegations: DelegationService
  documents: DocumentService
  templates: TemplateService
  verify: VerifyService
  notifications: NotificationService
  audit: AuditService
  library: LibraryService
  chat: ChatService
  requestTypes: RequestTypeService
  workflows: WorkflowService
  users: UserService
  catalog: CatalogService
  resetStore: () => void
}

export const httpServices: ServiceRegistry = {
  auth: httpAuthService,
  applications: httpApplicationService,
  approvals: httpApprovalService,
  otp: httpOtpService,
  delegations: httpDelegationService,
  documents: httpDocumentService,
  templates: httpTemplateService,
  verify: httpVerifyService,
  notifications: httpNotificationService,
  audit: httpAuditService,
  library: httpLibraryService,
  chat: httpChatService,
  requestTypes: httpRequestTypeService,
  workflows: httpWorkflowService,
  users: httpUserService,
  catalog: httpCatalogService,
  resetStore: () => undefined,
}
