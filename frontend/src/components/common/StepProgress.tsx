import { Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepProgressStep {
  order: number
  ten: string
  roleLabel: string
}

interface StepProgressProps {
  steps: StepProgressStep[]
  /** Số bước đã được duyệt. */
  buocDaDuyet: number
  /** Bước đang chờ duyệt (nếu có). */
  dangChoOrder?: number | null
  /** Thu gọn cho danh sách: chỉ hiện chấm và tên ngắn. */
  compact?: boolean
  className?: string
}

/**
 * Tiến trình duyệt liên thông: Cố vấn học tập → Trưởng khoa → Phòng Đào tạo.
 * Bước đã duyệt hiển thị dấu tích, bước đang chờ hiển thị biểu tượng đồng hồ.
 */
export function StepProgress({
  steps,
  buocDaDuyet,
  dangChoOrder,
  compact = false,
  className,
}: StepProgressProps) {
  return (
    <ol
      className={cn('flex w-full items-stretch gap-1', className)}
      aria-label="Tiến trình phê duyệt hồ sơ"
    >
      {steps.map((step, index) => {
        const daDuyet = step.order <= buocDaDuyet
        const dangCho = dangChoOrder === step.order && !daDuyet
        return (
          <li key={step.order} className="flex min-w-0 flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
                  daDuyet && 'border-success/40 bg-success-soft text-success',
                  dangCho && 'border-warning/50 bg-warning-soft text-warning',
                  !daDuyet && !dangCho && 'border-border bg-muted text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]',
                    daDuyet && 'bg-success text-success-foreground',
                    dangCho && 'bg-warning text-warning-foreground',
                    !daDuyet && !dangCho && 'bg-muted-foreground/30 text-foreground',
                  )}
                  aria-hidden="true"
                >
                  {daDuyet ? <Check className="size-3" /> : dangCho ? <Clock className="size-3" /> : step.order}
                </span>
                <span className="truncate">
                  {compact ? step.roleLabel : step.ten}
                </span>
              </div>
              {!compact && (
                <span className="truncate pl-0.5 text-[11px] text-muted-foreground">
                  {step.roleLabel}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <span
                className={cn(
                  'h-0.5 w-3 shrink-0 rounded-full',
                  daDuyet ? 'bg-success/60' : 'bg-border',
                )}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
