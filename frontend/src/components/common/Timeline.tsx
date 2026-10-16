import { CheckCircle2, CircleDashed, FileText, Send, Undo2, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ApprovalAction } from '@/types'
import { APPROVAL_ACTION_LABELS } from '@/types'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  SUBMIT: { icon: Send, tone: 'bg-primary text-primary-foreground' },
  APPROVE: { icon: CheckCircle2, tone: 'bg-success text-success-foreground' },
  REJECT: { icon: XCircle, tone: 'bg-destructive text-destructive-foreground' },
  REQUEST_SUPPLEMENT: { icon: FileText, tone: 'bg-warning text-warning-foreground' },
  SUPPLEMENT: { icon: Undo2, tone: 'bg-primary text-primary-foreground' },
  CANCEL: { icon: XCircle, tone: 'bg-status-cancelled text-white' },
  ISSUE_DOCUMENT: { icon: FileText, tone: 'bg-brand-heading text-white' },
  REVOKE_DOCUMENT: { icon: XCircle, tone: 'bg-destructive text-destructive-foreground' },
}

interface TimelineProps {
  items: ApprovalAction[]
  className?: string
}

/** Lịch sử xử lý hồ sơ dạng dòng thời gian dọc. */
export function Timeline({ items, className }: TimelineProps) {
  if (!items.length) {
    return (
      <p className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <CircleDashed className="size-4" />
        Chưa có hoạt động nào được ghi nhận.
      </p>
    )
  }

  const sorted = [...items].sort((a, b) => a.luc.localeCompare(b.luc))

  return (
    <ol className={cn('relative space-y-5 pl-1', className)}>
      {sorted.map((item, index) => {
        const meta = ICONS[item.hanhDong] ?? {
          icon: CircleDashed,
          tone: 'bg-muted text-muted-foreground',
        }
        const Icon = meta.icon
        const isLast = index === sorted.length - 1
        return (
          <li key={item.id} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  meta.tone,
                )}
                aria-hidden="true"
              >
                <Icon className="size-4" />
              </span>
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-bold">{APPROVAL_ACTION_LABELS[item.hanhDong]}</p>
                {item.buocOrder > 0 && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    Cấp {item.buocOrder}
                  </span>
                )}
                {item.phuongThuc && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {item.phuongThuc === 'OTP' ? 'Ký OTP' : 'Duyệt điện tử'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.nguoiThucHienTen}
                {item.chucVu ? ` — ${item.chucVu}` : ''} · {formatDateTime(item.luc)}
              </p>
              {item.ghiChu && (
                <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
                  {item.ghiChu}
                </p>
              )}
              {item.lyDo && (
                <p className="mt-1.5 rounded-md border border-warning/40 bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
                  <span className="font-semibold">Lý do: </span>
                  {item.lyDo}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
