import { ArrowRight, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMyApplications } from '../hooks/useApplications'
import { formatDate } from '@/lib/formatters'

/** Cảnh báo nổi bật khi sinh viên có hồ sơ cần bổ sung. */
export function SupplementAlert() {
  const { data } = useMyApplications({ trangThai: 'NEED_SUPPLEMENT', pageSize: 5 })
  const items = data?.items ?? []

  if (items.length === 0) return null

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning-soft p-4 sm:flex-row sm:items-center"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning text-warning-foreground">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-warning">
          Bạn có {items.length} hồ sơ cần bổ sung thông tin
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-foreground/80">
          {items.map((app) => (
            <li key={app.id} className="truncate">
              <span className="font-semibold">{app.maHoSo}</span> · {app.requestType.ten} · yêu cầu
              ngày {formatDate(app.yeuCauBoSung?.luc ?? app.ngayCapNhat)}
            </li>
          ))}
        </ul>
      </div>
      <Button asChild className="shrink-0 gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90">
        <Link to={`/don/${items[0].maHoSo}`}>
          Bổ sung ngay
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}
