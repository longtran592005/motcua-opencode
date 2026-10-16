import { CalendarClock, CheckCircle2, ClipboardList, Home, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ApplicationProgress } from './ApplicationProgress'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { ROLE_LABELS, type Application } from '@/types'

/** Phiếu hẹn hiển thị sau khi nộp hồ sơ thành công. */
export function SubmissionResult({ application }: { application: Application }) {
  const vaiTroTiepTheo = application.buocHienTai?.role

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-success/40">
        <CardContent className="space-y-5 p-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold text-brand-heading">Nộp hồ sơ thành công</h1>
            <p className="text-sm text-muted-foreground">
              Hồ sơ của bạn đã được tiếp nhận và chuyển tới cấp duyệt đầu tiên.
            </p>
          </div>

          <div className="rounded-lg bg-secondary/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mã hồ sơ
            </p>
            <p className="text-2xl font-extrabold tracking-wide text-primary">
              {application.maHoSo}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vui lòng ghi lại mã hồ sơ để tra cứu tiến độ.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Loại đơn</dt>
                <dd className="text-sm font-semibold">{application.requestType.ten}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Trạng thái</dt>
                <dd className="mt-0.5">
                  <StatusBadge trangThai={application.trangThai} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Ngày nộp</dt>
                <dd className="text-sm font-semibold">
                  {formatDateTime(application.ngayNop ?? application.ngayTao)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Hạn xử lý dự kiến</dt>
                <dd className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarClock className="size-4 text-warning" aria-hidden="true" />
                  {formatDate(application.hanXuLy)}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                Tiến trình duyệt
              </p>
              <ApplicationProgress application={application} />
              {vaiTroTiepTheo && (
                <p className="text-xs text-muted-foreground">
                  Đang chờ <span className="font-semibold">{ROLE_LABELS[vaiTroTiepTheo]}</span> xử lý.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="gap-2">
              <Link to={`/don/${application.maHoSo}`}>
                <Printer className="size-4" />
                Xem phiếu hẹn &amp; theo dõi
              </Link>
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/">
                <Home className="size-4" />
                Về trang chủ
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
