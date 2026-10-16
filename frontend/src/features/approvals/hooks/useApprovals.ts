import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { ApplicationListQuery, Role, User } from '@/types'
import type { ApproveInput } from '@/services/contracts/approval'

export const APPROVAL_KEYS = {
  pending: (query: ApplicationListQuery) => ['approvals', 'pending', query] as const,
  processed: (query: ApplicationListQuery) => ['approvals', 'processed', query] as const,
  stats: ['approvals', 'stats'] as const,
  overdue: (limit: number) => ['approvals', 'overdue', limit] as const,
  pendingCount: ['pending-count'] as const,
  delegations: ['delegations'] as const,
  eligible: (role: Role) => ['delegations', 'eligible', role] as const,
}

/** Danh sách hồ sơ đang chờ người dùng hiện tại xử lý. */
export function usePendingApplications(query: ApplicationListQuery) {
  return useQuery({
    queryKey: APPROVAL_KEYS.pending(query),
    queryFn: () => services.applications.listForApproval(query),
  })
}

/** Lịch sử hồ sơ đã xử lý bởi người dùng hiện tại. */
export function useProcessedApplications(query: ApplicationListQuery) {
  return useQuery({
    queryKey: APPROVAL_KEYS.processed(query),
    queryFn: () => services.applications.listProcessed(query),
  })
}

/** Thống kê phục vụ trang tổng quan khu quản trị. */
export function useApprovalStats() {
  return useQuery({
    queryKey: APPROVAL_KEYS.stats,
    queryFn: () => services.applications.statsApproval(),
  })
}

/** Danh sách hồ sơ quá hạn hoặc sắp hết hạn. */
export function useOverdueApplications(limit = 5) {
  return useQuery({
    queryKey: APPROVAL_KEYS.overdue(limit),
    queryFn: () => services.applications.listOverdue(limit),
  })
}

function invalidateApprovals(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['approvals'] })
  queryClient.invalidateQueries({ queryKey: ['applications'] })
  queryClient.invalidateQueries({ queryKey: ['pending-count'] })
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
}

/** Duyệt hồ sơ ở bước hiện tại (một chạm hoặc ký OTP). */
export function useApproveApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveInput) => services.approvals.approve(input),
    onSuccess: () => invalidateApprovals(queryClient),
  })
}

/** Từ chối hồ sơ kèm lý do bắt buộc. */
export function useRejectApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSo, lyDo }: { maHoSo: string; lyDo: string }) =>
      services.approvals.reject(maHoSo, lyDo),
    onSuccess: () => invalidateApprovals(queryClient),
  })
}

/** Yêu cầu sinh viên bổ sung hồ sơ. */
export function useRequestSupplement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSo, noiDung }: { maHoSo: string; noiDung: string }) =>
      services.approvals.requestSupplement(maHoSo, noiDung),
    onSuccess: () => invalidateApprovals(queryClient),
  })
}

/** Duyệt hàng loạt cho các bước "Một chạm". */
export function useApproveBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSoList, ghiChu }: { maHoSoList: string[]; ghiChu?: string }) =>
      services.approvals.approveBatch(maHoSoList, ghiChu),
    onSuccess: (ketQua) => {
      invalidateApprovals(queryClient)
      if (ketQua.thatBai.length === 0) {
        toast.success(`Đã duyệt ${ketQua.thanhCong.length} hồ sơ.`)
      } else {
        toast.warning(
          `Duyệt ${ketQua.thanhCong.length} hồ sơ, ${ketQua.thatBai.length} hồ sơ không thể duyệt.`,
        )
      }
    },
  })
}

/* ------------------------------- Ủy quyền ------------------------------- */

export function useDelegations() {
  return useQuery({
    queryKey: APPROVAL_KEYS.delegations,
    queryFn: () => services.delegations.list(),
  })
}

export function useEligibleUsers(vaiTro: Role, enabled = true) {
  return useQuery<User[]>({
    queryKey: APPROVAL_KEYS.eligible(vaiTro),
    queryFn: () => services.delegations.eligibleUsers(vaiTro),
    enabled,
  })
}

export function useCreateDelegation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      nguoiNhanId: string
      vaiTro: Role
      tuNgay: string
      denNgay: string
      lyDo: string
    }) => services.delegations.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.delegations })
      toast.success('Đã tạo ủy quyền duyệt.')
    },
  })
}

export function useCancelDelegation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.delegations.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.delegations })
      toast.success('Đã huỷ ủy quyền.')
    },
  })
}

export type { Delegation } from '@/services/contracts/delegation'
