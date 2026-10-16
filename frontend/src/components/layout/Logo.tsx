import { GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SCHOOL } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface LogoProps {
  /** Đường dẫn khi bấm vào logo. */
  to?: string
  /** Nền tối (dùng trên header xanh) hay nền sáng. */
  onDark?: boolean
  /** Chỉ hiển thị biểu tượng, ẩn tên trường (dùng cho sidebar thu gọn). */
  compact?: boolean
  className?: string
}

/** Khối nhận diện thương hiệu của Trường Đại học Thái Bình. */
export function Logo({ to = '/', onDark = false, compact = false, className }: LogoProps) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm',
        )}
        aria-hidden="true"
      >
        <GraduationCap className="size-6" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span
            className={cn(
              'block text-[11px] font-semibold uppercase tracking-wide',
              onDark ? 'text-white/75' : 'text-muted-foreground',
            )}
          >
            {SCHOOL.tenVietTat}
          </span>
          <span
            className={cn(
              'block truncate text-sm font-extrabold uppercase',
              onDark ? 'text-white' : 'text-brand-heading',
            )}
          >
            {SCHOOL.portal}
          </span>
        </span>
      )}
    </>
  )

  if (!to) return <span className={cn('flex items-center gap-2.5', className)}>{content}</span>

  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label={SCHOOL.ten}>
      {content}
    </Link>
  )
}
