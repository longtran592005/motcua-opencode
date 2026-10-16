import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

interface PageHeaderProps {
  tieuDe: string
  moTa?: string
  crumbs?: Crumb[]
  /** Nút hành động bên phải. */
  actions?: ReactNode
  className?: string
}

/** Tiêu đề trang có breadcrumb, dùng chung cho mọi khu vực. */
export function PageHeader({ tieuDe, moTa, crumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {crumb.to ? (
                <Link to={crumb.to} className="font-medium hover:text-primary hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium">{crumb.label}</span>
              )}
              {index < crumbs.length - 1 && <ChevronRight className="size-3" aria-hidden="true" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight text-brand-heading sm:text-2xl">
            {tieuDe}
          </h1>
          {moTa && <p className="max-w-3xl text-sm text-muted-foreground">{moTa}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
