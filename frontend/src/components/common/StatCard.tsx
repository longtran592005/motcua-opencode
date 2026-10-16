import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StatCardProps {
  nhan: string
  giaTri: number | string
  icon: LucideIcon
  moTa?: string
  /** Tông màu của biểu tượng. */
  tone?: 'brand' | 'success' | 'warning' | 'destructive' | 'muted'
  dangTai?: boolean
  className?: string
}

const TONES: Record<string, string> = {
  brand: 'bg-secondary text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  destructive: 'bg-destructive-soft text-destructive',
  muted: 'bg-muted text-muted-foreground',
}

export function StatCard({
  nhan,
  giaTri,
  icon: Icon,
  moTa,
  tone = 'brand',
  dangTai,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {nhan}
          </p>
          {dangTai ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-extrabold leading-none text-brand-heading">
              {giaTri}
            </p>
          )}
          {moTa && <p className="mt-1 text-xs text-muted-foreground">{moTa}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
