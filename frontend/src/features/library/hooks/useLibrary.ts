import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { LibraryItem } from '@/types'
import { downloadBlob, downloadStaticFile } from '@/lib/utils'

export const LIBRARY_KEYS = {
  list: (query: { tuKhoa?: string; nhom?: string }) => ['library', 'list', query] as const,
  groups: ['library', 'groups'] as const,
}

/** Danh sách biểu mẫu, văn bản trong thư viện. */
export function useLibraryItems(query: { tuKhoa?: string; nhom?: string }) {
  return useQuery<LibraryItem[]>({
    queryKey: LIBRARY_KEYS.list(query),
    queryFn: () => services.library.list(query),
  })
}

/** Nhóm biểu mẫu dùng cho bộ lọc. */
export function useLibraryGroups() {
  return useQuery<string[]>({
    queryKey: LIBRARY_KEYS.groups,
    queryFn: () => services.library.groups(),
    staleTime: 5 * 60 * 1000,
  })
}

/** Tải một biểu mẫu, quy trình hoặc văn bản trong thư viện về máy. */
export function useDownloadLibraryItem() {
  return useMutation({
    mutationFn: (id: string) => services.library.download(id),
    onSuccess: async (data) => {
      try {
        if (data.url) {
          await downloadStaticFile(data.ten, data.url)
        } else {
          downloadBlob(data.ten, data.noiDung, data.mime)
        }
        toast.success('Đã tải tài liệu về máy.')
      } catch (error) {
        toast.error('Không tải được tài liệu', {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    onError: (error) => {
      toast.error('Không tải được tài liệu', {
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })
}
