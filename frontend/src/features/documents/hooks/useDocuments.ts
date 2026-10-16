import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { DocumentStatus, SignedDocument } from '@/types'
import type { DocumentListQuery } from '@/services/contracts/document'

const KEY = {
  byApplication: (maHoSo: string) => ['documents', 'application', maHoSo] as const,
  issued: (query: DocumentListQuery) => ['documents', 'issued', query] as const,
  report: ['documents', 'report'] as const,
}

/** Văn bản đã cấp cho một hồ sơ. */
export function useDocumentByApplication(maHoSo: string | undefined) {
  return useQuery<SignedDocument>({
    queryKey: KEY.byApplication(maHoSo ?? ''),
    queryFn: () => services.documents.getByApplication(maHoSo as string),
    enabled: Boolean(maHoSo),
  })
}

/** Danh sách văn bản đã cấp (khu quản trị). */
export function useIssuedDocuments(query: DocumentListQuery, enabled = true) {
  return useQuery({
    queryKey: KEY.issued(query),
    queryFn: () => services.documents.listIssued(query),
    enabled,
  })
}

/** Thống kê phục vụ trang báo cáo. */
export function useReportOverview(enabled = true) {
  return useQuery({
    queryKey: KEY.report,
    queryFn: () => services.documents.report(),
    enabled,
  })
}

/** Ghi nhận một lượt tải văn bản. */
export function useLogDownload() {
  return useMutation({
    mutationFn: (id: string) => services.documents.logDownload(id),
  })
}

/** Xuất nội dung văn bản để in hoặc lưu PDF. */
export function useExportDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dinhDang }: { id: string; dinhDang: 'pdf' | 'html' }) =>
      services.documents.exportAs(id, dinhDang),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })
}

/** Thu hồi văn bản đã cấp (bắt buộc nhập lý do). */
export function useRevokeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, lyDo }: { id: string; lyDo: string }) =>
      services.documents.revoke(id, lyDo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toast.success('Đã thu hồi văn bản.')
    },
  })
}

export type { DocumentListQuery, DocumentStatus }
