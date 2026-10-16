import { BadgeCheck, ShieldCheck, ShieldX } from 'lucide-react'
import type { Signature } from '@/types'
import { SIGNATURE_METHOD_LABELS } from '@/types'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface SignatureStampProps {
  chuKy: Signature
  /** Thu gọn cho khối chữ ký nhiều cấp trên văn bản A4. */
  compact?: boolean
  className?: string
}

/**
 * Khung hiển thị một chữ ký điện tử đã thu thập trên văn bản:
 * người ký, chức vụ, thời điểm, phương thức và mã chữ ký rút gọn.
 */
export function SignatureStamp({ chuKy, compact = false, className }: SignatureStampProps) {
  const hopLe = chuKy.hopLe
  return (
    <div
      className={cn(
        'rounded-md border bg-white px-3 py-2 font-sans',
        hopLe ? 'border-brand/50' : 'border-destructive/50',
        compact && 'px-2.5 py-1.5',
        className,
      )}
      aria-label={`Chữ ký điện tử của ${chuKy.hoTen}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full',
            hopLe ? 'bg-secondary text-primary' : 'bg-destructive-soft text-destructive',
          )}
          aria-hidden="true"
        >
          {hopLe ? <ShieldCheck className="size-3.5" /> : <ShieldX className="size-3.5" />}
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-[12px] font-bold leading-tight text-brand-heading">
            Đã ký điện tử bởi: {chuKy.hoTen}
          </p>
          <p className="text-[11px] leading-tight text-foreground">{chuKy.chucVu}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            Thời gian ký: {formatDateTime(chuKy.thoiDiemKy)}
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            Phương thức: {SIGNATURE_METHOD_LABELS[chuKy.phuongThuc]}
          </p>
          <p className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
            <BadgeCheck className="size-3 text-primary" aria-hidden="true" />
            Mã chữ ký: <span className="font-mono font-semibold">{chuKy.maChuKy}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
