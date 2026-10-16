import { ChevronRight, FileSignature, QrCode, Send, UserCheck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Send,
    tieuDe: 'Nộp đơn',
    moTa: 'Điền biểu mẫu trực tuyến và nộp hồ sơ kèm giấy tờ.',
  },
  {
    icon: UserCheck,
    tieuDe: 'Duyệt cấp 1',
    moTa: 'Cố vấn học tập kiểm tra và xác nhận hồ sơ.',
  },
  {
    icon: Users,
    tieuDe: 'Duyệt cấp 2',
    moTa: 'Trưởng khoa / Phòng Đào tạo phê duyệt theo quy định.',
  },
  {
    icon: QrCode,
    tieuDe: 'Nhận văn bản có QR',
    moTa: 'Tải văn bản điện tử, tra cứu xác thực bằng mã QR.',
  },
] as const

/** Sơ đồ 4 bước quy trình một cửa, có liên kết giữa các bước. */
export function ProcessDiagram({ className }: { className?: string }) {
  return (
    <ol
      className={cn(
        'grid gap-3 md:grid-cols-4',
        className,
      )}
      aria-label="Quy trình xử lý hồ sơ một cửa"
    >
      {STEPS.map((step, index) => (
        <li key={step.tieuDe} className="relative flex">
          <div className="flex w-full flex-col gap-2 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                Bước {index + 1}
              </span>
            </div>
            <p className="font-bold text-brand-heading">{step.tieuDe}</p>
            <p className="text-xs text-muted-foreground">{step.moTa}</p>
            {index === STEPS.length - 1 && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                <FileSignature className="size-3" aria-hidden="true" />
                Ký điện tử
              </span>
            )}
          </div>
          {index < STEPS.length - 1 && (
            <ChevronRight
              className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground md:block"
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  )
}
