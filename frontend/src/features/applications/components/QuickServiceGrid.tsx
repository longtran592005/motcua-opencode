import { ArrowRight, FileText, Library, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RequestTypeIcon } from './RequestTypeIcon'
import { useRequestTypes } from '../hooks/useApplications'
import { formatCurrency } from '@/lib/formatters'

const TIEN_ICH = [
  {
    to: '/don-cua-toi',
    label: 'Theo dõi đơn',
    moTa: 'Xem trạng thái và tiến trình xử lý',
    icon: FileText,
  },
  {
    to: '/xac-thuc',
    label: 'Xác thực văn bản',
    moTa: 'Kiểm tra văn bản đã cấp bằng mã QR',
    icon: ShieldCheck,
  },
  {
    to: '/thu-vien-bieu-mau',
    label: 'Biểu mẫu & tài liệu',
    moTa: 'Biểu mẫu, quy trình và văn bản hành chính',
    icon: Library,
  },
]

/** Lưới "Dịch vụ Một cửa" gồm các loại đơn và tiện ích tra cứu. */
export function QuickServiceGrid() {
  const { data, isLoading } = useRequestTypes()

  return (
    <section className="space-y-4" aria-labelledby="dich-vu-mot-cua">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="dich-vu-mot-cua" className="section-title text-lg font-extrabold text-brand-heading">
            Dịch vụ Một cửa
          </h2>
          <p className="text-sm text-muted-foreground">
            Chọn loại hồ sơ bạn cần nộp để bắt đầu.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)
          : (data ?? []).map((rt) => (
              <Link key={rt.id} to={`/don/moi/${rt.id}`} className="group">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-card">
                  <CardContent className="flex h-full items-start gap-3 p-4">
                    <RequestTypeIcon icon={rt.icon} mau={rt.mau} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-brand-heading group-hover:text-primary">
                        {rt.ten}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {rt.moTa}
                      </p>
                      <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                        Xử lý trong {rt.soNgayXuLy} ngày
                        {rt.lePhi > 0 ? ` · Lệ phí ${formatCurrency(rt.lePhi)}` : ' · Miễn phí'}
                      </p>
                    </div>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </CardContent>
                </Card>
              </Link>
            ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TIEN_ICH.map((item) => (
          <Link key={item.label} to={item.to} className="group">
            <Card className="h-full border-dashed bg-secondary/40 transition-colors group-hover:border-primary/50">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-brand-heading group-hover:text-primary">
                    {item.label}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{item.moTa}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
