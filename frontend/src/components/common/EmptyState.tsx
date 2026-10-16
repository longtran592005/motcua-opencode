import type { LucideIcon } from 'lucide-react'
import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  tieuDe: string
  moTa?: string
  /** Nút hành động chính. */
  hanhDong?: { nhan: string; onClick: () => void }
  className?: string
}

/** Trạng thái danh sách rỗng. */
export function EmptyState({
  icon: Icon = Inbox,
  tieuDe,
  moTa,
  hanhDong,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-bold text-brand-heading">{tieuDe}</p>
        {moTa && <p className="mx-auto max-w-md text-sm text-muted-foreground">{moTa}</p>}
      </div>
      {hanhDong && (
        <Button size="sm" onClick={hanhDong.onClick}>
          {hanhDong.nhan}
        </Button>
      )}
    </div>
  )
}

interface ErrorStateProps {
  thongDiep?: string
  onThuLai: () => void
  className?: string
}

/** Trạng thái lỗi kèm nút thử lại. */
export function ErrorState({ thongDiep, onThuLai, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-background text-destructive">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-bold text-destructive">Không tải được dữ liệu</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {thongDiep ?? 'Đã xảy ra lỗi khi kết nối tới máy chủ. Vui lòng thử lại.'}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onThuLai}>
        <RefreshCw className="size-4" />
        Thử lại
      </Button>
    </div>
  )
}
