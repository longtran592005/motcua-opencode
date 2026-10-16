import { useMutation, useQuery } from '@tanstack/react-query'
import { services } from '@/services'
import type { SignedDocument, VerifyResult } from '@/types'

export const VERIFY_KEYS = {
  byToken: (token: string) => ['verify', 'token', token] as const,
  bySoVanBan: (so: string) => ['verify', 'so-van-ban', so] as const,
  recent: (limit: number) => ['verify', 'recent', limit] as const,
}

/** Tra cứu văn bản theo token trên QR. */
export function useVerifyByToken(token: string | undefined) {
  return useQuery<VerifyResult>({
    queryKey: VERIFY_KEYS.byToken(token ?? ''),
    queryFn: () => services.verify.byToken(token as string),
    enabled: Boolean(token),
    retry: false,
  })
}

/** Tra cứu văn bản theo số văn bản. */
export function useVerifyBySoVanBan(soVanBan: string | undefined) {
  return useQuery<VerifyResult>({
    queryKey: VERIFY_KEYS.bySoVanBan(soVanBan ?? ''),
    queryFn: () => services.verify.bySoVanBan(soVanBan as string),
    enabled: Boolean(soVanBan),
    retry: false,
  })
}

/** Một số văn bản mới cấp để gợi ý tra cứu. */
export function useRecentDocuments(limit = 5) {
  return useQuery<SignedDocument[]>({
    queryKey: VERIFY_KEYS.recent(limit),
    queryFn: () => services.verify.recentDocuments(limit),
  })
}

/** Đối chiếu mã băm của tệp người dùng tải lên với mã băm đã lưu. */
export function useCompareFileHash() {
  return useMutation({
    mutationFn: ({ token, maBam }: { token: string; maBam: string }) =>
      services.verify.compareFileHash(token, maBam),
  })
}
