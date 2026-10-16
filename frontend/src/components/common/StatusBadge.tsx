import { STATUS_BADGE_CLASSES, STATUS_LABELS, type ApplicationStatus } from '@/types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  trangThai: ApplicationStatus
  className?: string
  /** Hiện dấu chấm màu phía trước nhãn. */
  showDot?: boolean
}

export function StatusBadge({ trangThai, className, showDot = true }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold',
        STATUS_BADGE_CLASSES[trangThai],
        className,
      )}
      aria-label={`Trạng thái: ${STATUS_LABELS[trangThai]}`}
    >
      {showDot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {STATUS_LABELS[trangThai]}
    </span>
  )
}
