import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type {
  Application,
  ApplicationDetail,
  ApplicationListQuery,
  CreateApplicationPayload,
  RequestType,
} from '@/types'
import type { SupplementInput } from '@/services/contracts/application'

export const APPLICATION_KEYS = {
  requestTypes: ['request-types'] as const,
  mine: (query: ApplicationListQuery) => ['applications', 'mine', query] as const,
  recent: (limit: number) => ['applications', 'recent', limit] as const,
  statsMine: ['applications', 'stats-mine'] as const,
  detail: (maHoSo: string) => ['applications', 'detail', maHoSo] as const,
}

/** Danh sách loại đơn đang hoạt động (dùng cho form và bộ lọc). */
export function useRequestTypes() {
  return useQuery<RequestType[]>({
    queryKey: APPLICATION_KEYS.requestTypes,
    queryFn: () => services.applications.requestTypes(),
    staleTime: 5 * 60 * 1000,
  })
}

/** Lấy một loại đơn theo id hoặc mã (ví dụ `rt_gxn` hoặc `GXN`). */
export function useRequestType(idHoacMa: string | undefined) {
  const { data: danhSach } = useRequestTypes()
  return useQuery<RequestType | null>({
    queryKey: ['request-type', idHoacMa],
    queryFn: async () => {
      if (!idHoacMa) return null
      try {
        return await services.requestTypes.get(idHoacMa)
      } catch {
        const all = await services.applications.requestTypes()
        return all.find((r) => r.ma === idHoacMa || r.id === idHoacMa) ?? null
      }
    },
    enabled: Boolean(idHoacMa),
    initialData: () => {
      const found = danhSach?.find((r) => r.id === idHoacMa || r.ma === idHoacMa)
      return found ?? undefined
    },
    initialDataUpdatedAt: 0,
  })
}


/** Danh sách hồ sơ của sinh viên đang đăng nhập. */
export function useMyApplications(query: ApplicationListQuery) {
  return useQuery({
    queryKey: APPLICATION_KEYS.mine(query),
    queryFn: () => services.applications.listMine(query),
  })
}

/** Một vài hồ sơ gần đây của sinh viên. */
export function useRecentApplications(limit = 4) {
  return useQuery<Application[]>({
    queryKey: APPLICATION_KEYS.recent(limit),
    queryFn: () => services.applications.recentMine(limit),
  })
}

/** Thống kê nhanh hồ sơ của sinh viên. */
export function useMyStats() {
  return useQuery({
    queryKey: APPLICATION_KEYS.statsMine,
    queryFn: () => services.applications.statsMine(),
  })
}

/** Chi tiết một hồ sơ theo mã. */
export function useApplicationDetail(maHoSo: string | undefined) {
  return useQuery<ApplicationDetail>({
    queryKey: APPLICATION_KEYS.detail(maHoSo ?? ''),
    queryFn: () => services.applications.getByCode(maHoSo as string),
    enabled: Boolean(maHoSo),
  })
}

function invalidateMine(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['applications'] })
  queryClient.invalidateQueries({ queryKey: ['approval-stats'] })
}

/** Tạo bản nháp mới. */
export function useCreateDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateApplicationPayload) => services.applications.createDraft(payload),
    onSuccess: () => invalidateMine(queryClient),
  })
}

/** Cập nhật bản nháp đã có. */
export function useUpdateDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSo, payload }: { maHoSo: string; payload: CreateApplicationPayload }) =>
      services.applications.updateDraft(maHoSo, payload),
    onSuccess: () => invalidateMine(queryClient),
  })
}

/** Nộp hồ sơ, đưa vào bước duyệt đầu tiên. */
export function useSubmitApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (maHoSo: string) => services.applications.submit(maHoSo),
    onSuccess: () => {
      invalidateMine(queryClient)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Đã nộp hồ sơ thành công.')
    },
  })
}

/** Rút hồ sơ khi chưa có cấp nào phê duyệt. */
export function useCancelApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSo, lyDo }: { maHoSo: string; lyDo?: string }) =>
      services.applications.cancel(maHoSo, lyDo),
    onSuccess: () => {
      invalidateMine(queryClient)
      toast.success('Đã rút hồ sơ.')
    },
  })
}

/** Bổ sung hồ sơ đang ở trạng thái Cần bổ sung. */
export function useSupplementApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ maHoSo, input }: { maHoSo: string; input: SupplementInput }) =>
      services.applications.supplement(maHoSo, input),
    onSuccess: (_data, variables) => {
      invalidateMine(queryClient)
      queryClient.invalidateQueries({ queryKey: APPLICATION_KEYS.detail(variables.maHoSo) })
      toast.success('Đã gửi bổ sung, hồ sơ trở lại bước đang xử lý.')
    },
  })
}
