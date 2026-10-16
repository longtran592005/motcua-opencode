import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services } from '@/services'
import type { Notification } from '@/types'

export const NOTIFICATION_KEYS = {
  mine: ['notifications', 'mine'] as const,
  unread: ['notifications', 'unread'] as const,
}

/** Danh sách thông báo của người dùng hiện tại. */
export function useMyNotifications(enabled = true) {
  return useQuery<Notification[]>({
    queryKey: NOTIFICATION_KEYS.mine,
    queryFn: () => services.notifications.listMine(),
    enabled,
  })
}

/** Số thông báo chưa đọc — dùng cho badge trên chuông. */
export function useUnreadCount(enabled = true) {
  return useQuery<number>({
    queryKey: NOTIFICATION_KEYS.unread,
    queryFn: () => services.notifications.unreadCount(),
    enabled,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => services.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc.')
    },
  })
}

export function useRemoveNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => services.notifications.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Đã xóa thông báo.')
    },
  })
}
