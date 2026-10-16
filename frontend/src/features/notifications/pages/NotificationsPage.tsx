import { Bell, CheckCheck, Info, Trash2, TriangleAlert, CircleCheck, CircleX } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
  useRemoveNotification,
} from '@/hooks/useNotifications'
import { formatRelative } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Notification, NotificationType } from '@/types'

const TYPE_META: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  INFO: { icon: Info, tone: 'bg-secondary text-primary' },
  SUCCESS: { icon: CircleCheck, tone: 'bg-success-soft text-success' },
  WARNING: { icon: TriangleAlert, tone: 'bg-warning-soft text-warning' },
  DANGER: { icon: CircleX, tone: 'bg-destructive-soft text-destructive' },
}

/** Trang danh sách thông báo của người dùng. */
export function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useMyNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const remove = useRemoveNotification()

  const items = data ?? []
  const chuaDoc = items.filter((n) => !n.daDoc).length

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo' }]}
        tieuDe="Thông báo"
        moTa={chuaDoc > 0 ? `Bạn có ${chuaDoc} thông báo chưa đọc.` : 'Tất cả thông báo đã đọc.'}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || chuaDoc === 0}
          >
            <CheckCheck className="size-4" />
            Đọc tất cả
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="p-4">
              <ErrorState onThuLai={() => void refetch()} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Bell}
                tieuDe="Chưa có thông báo nào"
                moTa="Thông báo về tiến trình xử lý hồ sơ sẽ hiển thị tại đây."
              />
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((item: Notification) => {
                const meta = TYPE_META[item.loai]
                const Icon = meta.icon
                return (
                  <li
                    key={item.id}
                    className={cn('flex items-start gap-3 p-4', !item.daDoc && 'bg-secondary/40')}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg',
                        meta.tone,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-heading">{item.tieuDe}</p>
                        {!item.daDoc && (
                          <span className="size-2 rounded-full bg-primary" aria-label="Chưa đọc" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.noiDung}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatRelative(item.luc)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          onClick={() => !item.daDoc && markRead.mutate(item.id)}
                        >
                          <Link to={item.lienKet ?? '/'}>
                            {item.maHoSo ? `Xem hồ sơ ${item.maHoSo}` : 'Xem chi tiết'}
                          </Link>
                        </Button>
                        {!item.daDoc && (
                          <Button variant="ghost" size="sm" onClick={() => markRead.mutate(item.id)}>
                            Đánh dấu đã đọc
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(item.id)}
                      aria-label="Xoá thông báo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
