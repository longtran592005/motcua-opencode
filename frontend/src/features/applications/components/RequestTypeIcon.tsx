import {
  ArrowLeftRight,
  CalendarX2,
  ClipboardList,
  FileCheck2,
  FileText,
  PauseCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  FileCheck2,
  ClipboardList,
  CalendarX2,
  PauseCircle,
  ArrowLeftRight,
  FileText,
}

const TONES: Record<string, string> = {
  brand: 'bg-secondary text-primary',
  amber: 'bg-warning-soft text-warning',
  violet: 'bg-[hsl(var(--brand-soft))] text-[hsl(var(--brand-dark))]',
  rose: 'bg-destructive-soft text-destructive',
  emerald: 'bg-success-soft text-success',
}

interface RequestTypeIconProps {
  icon: string
  mau?: string
  className?: string
  iconClassName?: string
}

/** Biểu tượng đại diện cho một loại đơn, kèm tông màu theo cấu hình. */
export function RequestTypeIcon({ icon, mau = 'brand', className, iconClassName }: RequestTypeIconProps) {
  const Icon = ICONS[icon] ?? FileText
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        TONES[mau] ?? TONES.brand,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={cn('size-5', iconClassName)} />
    </span>
  )
}
