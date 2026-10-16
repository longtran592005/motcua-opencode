import { Bell, CheckCheck, Info, TriangleAlert, CircleCheck, CircleX } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
  useUnreadCount,
} from '@/hooks/useNotifications'
import { formatRelative } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/types'

const TYPE_META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  INFO: { icon: Info, tone: 'text-primary' },
  SUCCESS: { icon: CircleCheck, tone: 'text-success' },
  WARNING: { icon: TriangleAlert, tone: 'text-warning' },
  DANGER: { icon: CircleX, tone: 'text-destructive' },
}

interface NotificationBellProps {
  /** Chế độ hiển thị trên nền sáng (trang sinh viên) hay nền tối (header quản trị). */
  variant?: 'light' | 'compact'
}

/** Chuông thông báo kèm badge số chưa đọc và danh sách xổ xuống. */
export function NotificationBell({ variant = 'light' }: NotificationBellProps) {
  const navigate = useNavigate()
  const { data, isLoading } = useMyNotifications()
  const { data: unread = 0 } = useUnreadCount()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const items = (data ?? []).slice(0, 8)

  function handleOpen(item: Notification) {
    if (!item.daDoc) markRead.mutate(item.id)
    navigate(item.lienKet ?? '/thong-bao')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        >
          <Bell className={cn('size-5', variant === 'compact' && 'size-4')} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-bold">Thông báo</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unread === 0}
          >
            <CheckCheck className="size-3.5" />
            Đọc tất cả
          </Button>
        </div>

        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Bạn chưa có thông báo nào.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => {
                const meta = TYPE_META[item.loai]
                const Icon = meta.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(item)}
                      className={cn(
                        'flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent',
                        !item.daDoc && 'bg-secondary/60',
                      )}
                    >
                      <Icon className={cn('mt-0.5 size-4 shrink-0', meta.tone)} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-semibold">{item.tieuDe}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {item.noiDung}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {formatRelative(item.luc)}
                        </span>
                      </span>
                      {!item.daDoc && (
                        <span
                          className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                          aria-label="Chưa đọc"
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link to="/thong-bao">Xem tất cả thông báo</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
