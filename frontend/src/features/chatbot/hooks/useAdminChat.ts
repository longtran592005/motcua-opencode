import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from '@/services/http/client'
import { toast } from 'sonner'

/** Kiểu dữ liệu tối thiểu cho trang quản trị chatbot. */
export interface HandoffRow {
  id: string
  ma: string
  userId: string
  question: string
  context?: string | null
  status: 'OPEN' | 'ANSWERED' | 'CLOSED'
  answer?: string | null
  createdAt: string
}

export interface KnowledgeRow {
  id: string
  ma: string
  title: string
  sourceType: 'LIBRARY' | 'UPLOAD' | 'FAQ'
  status: 'PROCESSING' | 'READY' | 'FAILED' | 'DISABLED'
  mime?: string | null
  version: number
  errorMessage?: string | null
  createdAt: string
  _count?: { chunks: number }
}

export interface ChatStats {
  hoiTrongTuan: number
  tyLeCoNguon: number
  tyLeKhongTimThay: number
  handoffSo: number
  handoffDaTraLoi: number
  huuIch: number
  khongHuuIch: number
  hoiTheoNgay: Array<{ ngay: string; so: number }>
  khongTimThayGanNhat: Array<{ id: string; cauHoi: string; lucHoi: string }>
  topDocs: Array<{ ten: string; soDuocTrich: number }>
}

const STALE = 15_000

export function useHandoffInbox(trangThai: string) {
  return useQuery({
    queryKey: ['chat-admin', 'handoff-inbox', trangThai],
    queryFn: () => request<HandoffRow[]>(`/chat/handoffs/inbox?trangThai=${trangThai}`),
    refetchInterval: 30_000,
    staleTime: STALE,
  })
}

export function useAnswerHandoff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { ma: string; cauTraLoi: string }) =>
      request(`/chat/handoffs/${input.ma}/answer`, { method: 'POST', body: { cauTraLoi: input.cauTraLoi } }),
    onSuccess: () => {
      toast.success('Đã trả lời câu hỏi')
      void qc.invalidateQueries({ queryKey: ['chat-admin'] })
    },
    onError: () => toast.error('Không gửi được câu trả lời'),
  })
}

export function useHandoffToFaq() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ma: string) => request(`/chat/handoffs/${ma}/to-faq`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Đã thêm câu hỏi + trả lời vào kiến thức FAQ')
      void qc.invalidateQueries({ queryKey: ['chat-admin'] })
    },
    onError: () => toast.error('Không thêm được vào FAQ'),
  })
}

export function useKnowledge() {
  return useQuery({
    queryKey: ['chat-admin', 'knowledge'],
    queryFn: () => request<KnowledgeRow[]>('/chat/knowledge'),
    staleTime: STALE,
  })
}

export function useUpsertKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) => request('/chat/knowledge', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Đã nạp kiến thức — chờ xử lý trong ít phút')
      void qc.invalidateQueries({ queryKey: ['chat-admin', 'knowledge'] })
    },
    onError: () => toast.error('Không nạp được kiến thức'),
  })
}

export function usePatchKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { ma: string; batHieuLuc?: boolean; tieuDe?: string }) =>
      request(`/chat/knowledge/${input.ma}`, {
        method: 'PATCH',
        body: { batHieuLuc: input.batHieuLuc, tieuDe: input.tieuDe },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat-admin', 'knowledge'] })
    },
  })
}

export function useDeleteKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ma: string) => request(`/chat/knowledge/${ma}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Đã xóa tài liệu khỏi kiến thức')
      void qc.invalidateQueries({ queryKey: ['chat-admin', 'knowledge'] })
    },
    onError: () => toast.error('Không xóa được tài liệu'),
  })
}

export function useReindex() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => request('/chat/knowledge/reindex', { method: 'POST' }),
    onSuccess: () => {
      toast.success('Đã lập lại chỉ mục truy xuất')
      void qc.invalidateQueries({ queryKey: ['chat-admin'] })
    },
  })
}

export function useChatStats() {
  return useQuery({
    queryKey: ['chat-admin', 'stats'],
    queryFn: () => request<ChatStats>('/chat/stats'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
