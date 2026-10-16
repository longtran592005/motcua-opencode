import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { CrudService } from '@/services/contracts/catalog'
import type { Khoa, KhoaHoc, Lop, Nganh, PhongBan } from '@/types'

/** Bọc một CrudService thành các hook truy vấn / thao tác cho React Query. */
function createCatalogHooks<T extends { id: string }>(
  key: string,
  service: CrudService<T>,
) {
  const listKey = ['catalog', key] as const

  function useList(enabled = true) {
    return useQuery<T[]>({
      queryKey: listKey,
      queryFn: () => service.list(),
      enabled,
      staleTime: 5 * 60 * 1000,
    })
  }

  function useCreate() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (input: Omit<T, 'id'>) => service.create(input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey })
        toast.success('Đã thêm mới thành công.')
      },
    })
  }

  function useUpdate() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => service.update(id, patch),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey })
        toast.success('Đã cập nhật thành công.')
      },
    })
  }

  function useRemove() {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => service.remove(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey })
        toast.success('Đã xoá thành công.')
      },
    })
  }

  return { useList, useCreate, useUpdate, useRemove, listKey }
}

export const khoaHooks = createCatalogHooks<Khoa>('khoa', services.catalog.khoa)
export const phongBanHooks = createCatalogHooks<PhongBan>('phong-ban', services.catalog.phongBan)
export const nganhHooks = createCatalogHooks<Nganh>('nganh', services.catalog.nganh)
export const lopHooks = createCatalogHooks<Lop>('lop', services.catalog.lop)
export const khoaHocHooks = createCatalogHooks<KhoaHoc>('khoa-hoc', services.catalog.khoaHoc)
