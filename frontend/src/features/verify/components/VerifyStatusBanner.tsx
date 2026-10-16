import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/types'

interface VerifyStatusBannerProps {
  trangThai: DocumentStatus
  /** Chữ ký còn hợp lệ hay nội dung đã bị thay đổi. */
  chuKyConHieuLuc?: boolean
  lyDoThuHoi?: string
  className?: string
}

interface TrangThaiHienThi {
  icon: LucideIcon
  nhan: string
  moTa: string
  tone: string
}

/** Khối trạng thái xác thực: hợp lệ / không hợp lệ / đã thu hồi. */
export function VerifyStatusBanner({
  trangThai,
  chuKyConHieuLuc = true,
  lyDoThuHoi,
  className,
}: VerifyStatusBannerProps) {
  const hienThi: TrangThaiHienThi =
    trangThai === 'REVOKED'
      ? {
          icon: ShieldAlert,
          nhan: 'VĂN BẢN ĐÃ THU HỒI',
          moTa: lyDoThuHoi
            ? `Văn bản không còn hiệu lực. Lý do: ${lyDoThuHoi}`
            : 'Văn bản này đã bị cơ quan cấp thu hồi và không còn giá trị sử dụng.',
          tone: 'border-warning/50 bg-warning-soft text-warning',
        }
      : trangThai === 'VALID' && chuKyConHieuLuc
        ? {
            icon: ShieldCheck,
            nhan: 'VĂN BẢN HỢP LỆ',
            moTa: 'Văn bản được cấp bởi Trường Đại học Thái Bình và chữ ký điện tử còn nguyên vẹn.',
            tone: 'border-success/50 bg-success-soft text-success',
          }
        : {
            icon: ShieldX,
            nhan: 'VĂN BẢN KHÔNG HỢP LỆ',
            moTa: 'Nội dung văn bản đã bị thay đổi sau khi ký hoặc dữ liệu không khớp. Vui lòng liên hệ nhà trường để kiểm tra.',
            tone: 'border-destructive/50 bg-destructive-soft text-destructive',
          }

  const Icon = hienThi.icon

  return (
    <div
      role="status"
      className={cn('flex items-center gap-3 rounded-xl border p-4', hienThi.tone, className)}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background/70">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold tracking-wide sm:text-base">{hienThi.nhan}</p>
        <p className="text-xs text-foreground/80 sm:text-sm">{hienThi.moTa}</p>
      </div>
    </div>
  )
}
