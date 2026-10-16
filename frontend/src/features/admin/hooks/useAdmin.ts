import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { AuditLog, DocumentTemplate, Paginated, RequestType, Role, User, UserStatus, Workflow } from '@/types'

export const ADMIN_KEYS = {
  requestTypes: ['admin', 'request-types'] as const,
  requestTypeStats: ['admin', 'request-type-stats'] as const,
  workflows: ['admin', 'workflows'] as const,
  templates: ['admin', 'templates'] as const,
  users: (query: {
    page?: number
    tuKhoa?: string
    vaiTro?: Role | 'ALL'
    trangThai?: UserStatus | 'ALL'
    donViId?: string
  }) => ['admin', 'users', query] as const,
  advisors: ['admin', 'advisors'] as const,
  audit: (query: Record<string, unknown>) => ['admin', 'audit', query] as const,
  auditActions: ['admin', 'audit-actions'] as const,
}

/* ----------------------------- Loại đơn ----------------------------- */

export function useAdminRequestTypes() {
  return useQuery<RequestType[]>({
    queryKey: ADMIN_KEYS.requestTypes,
    queryFn: () => services.requestTypes.list(),
  })
}

export function useRequestTypeStats() {
  return useQuery({
    queryKey: ADMIN_KEYS.requestTypeStats,
    queryFn: () => services.requestTypes.stats(),
  })
}

export function useSaveRequestType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string
      input: Omit<RequestType, 'id'> | Partial<RequestType>
    }) => (id ? services.requestTypes.update(id, input) : services.requestTypes.create(input as Omit<RequestType, 'id'>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.requestTypes })
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.requestTypeStats })
      toast.success('Đã lưu loại đơn.')
    },
  })
}

export function useRemoveRequestType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.requestTypes.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.requestTypes })
      queryClient.invalidateQueries({ queryKey: ['request-types'] })
      toast.success('Đã xoá loại đơn.')
    },
  })
}

/* ------------------------------ Luồng duyệt ------------------------------ */

export function useAdminWorkflows() {
  return useQuery<Workflow[]>({
    queryKey: ADMIN_KEYS.workflows,
    queryFn: () => services.workflows.list(),
  })
}

export function useSaveWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string
      input: Omit<Workflow, 'id'> | Partial<Workflow>
    }) => (id ? services.workflows.update(id, input) : services.workflows.create(input as Omit<Workflow, 'id'>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.workflows })
      toast.success('Đã lưu luồng duyệt.')
    },
  })
}

export function useRemoveWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.workflows.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.workflows })
      toast.success('Đã xoá luồng duyệt.')
    },
  })
}

/* ------------------------------ Mẫu văn bản ------------------------------ */

export function useAdminTemplates() {
  return useQuery<DocumentTemplate[]>({
    queryKey: ADMIN_KEYS.templates,
    queryFn: () => services.templates.list(),
  })
}

export function useSaveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string
      input: Omit<DocumentTemplate, 'id' | 'capNhatLuc'> | Partial<DocumentTemplate>
    }) =>
      id
        ? services.templates.update(id, input)
        : services.templates.create(input as Omit<DocumentTemplate, 'id' | 'capNhatLuc'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.templates })
      toast.success('Đã lưu mẫu văn bản.')
    },
  })
}

export function useRemoveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.templates.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.templates })
      toast.success('Đã xoá mẫu văn bản.')
    },
  })
}

/* ------------------------------ Người dùng ------------------------------ */

export function useAdminUsers(query: {
  page?: number
  pageSize?: number
  tuKhoa?: string
  vaiTro?: Role | 'ALL'
  trangThai?: UserStatus | 'ALL'
  donViId?: string
}) {
  return useQuery<Paginated<User>>({
    queryKey: ADMIN_KEYS.users(query),
    queryFn: () => services.users.list(query),
  })
}

export function useAdvisors() {
  return useQuery<User[]>({
    queryKey: ADMIN_KEYS.advisors,
    queryFn: () => services.users.advisors(),
  })
}

export function useSaveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string
      input: Omit<User, 'id'> | Partial<User>
    }) => (id ? services.users.update(id, input) : services.users.create(input as Omit<User, 'id'>)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Đã lưu người dùng.')
    },
  })
}

export function useRemoveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.users.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Đã xoá người dùng.')
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: string) => services.users.resetPassword(id),
    onSuccess: (ketQua) => {
      toast.success('Đã đặt lại mật khẩu.', { description: `Mật khẩu tạm: ${ketQua.matKhauTam}` })
    },
  })
}

/* ------------------------------ Nhật ký ------------------------------ */

export function useAuditLogs(query: {
  page?: number
  pageSize?: number
  tuKhoa?: string
  nguoiThucHienId?: string
  hanhDong?: string
  tuNgay?: string
  denNgay?: string
}) {
  return useQuery<Paginated<AuditLog>>({
    queryKey: ADMIN_KEYS.audit(query),
    queryFn: () => services.audit.list(query),
  })
}

export function useAuditActions() {
  return useQuery<{ ma: string; nhan: string }[]>({
    queryKey: ADMIN_KEYS.auditActions,
    queryFn: () => services.audit.actions(),
    staleTime: 5 * 60 * 1000,
  })
}
