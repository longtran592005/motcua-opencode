import { ArrowRight, Download, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ApplicationProgress } from './ApplicationProgress'
import { useRecentApplications } from '../hooks/useApplications'
import { formatDate } from '@/lib/formatters'

/** Danh sách hồ sơ gần đây của sinh viên trên trang chủ. */
export function RecentApplications() {
  const { data, isLoading, isError, refetch } = useRecentApplications(4)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Đơn gần đây của tôi</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
          <Link to="/don-cua-toi">
            Xem tất cả
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onThuLai={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={FileText}
            tieuDe="Bạn chưa có đơn nào"
            moTa="Hãy chọn một dịch vụ ở phía trên để bắt đầu nộp hồ sơ."
          />
        ) : (
          <ul className="space-y-3">
            {data.map((app) => (
              <li key={app.id}>
                <div className="rounded-lg border p-3 transition-colors hover:border-primary/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/don/${app.maHoSo}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {app.maHoSo}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {app.requestType.ten}
                      </p>
                    </div>
                    <StatusBadge trangThai={app.trangThai} />
                  </div>

                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Ngày nộp: {formatDate(app.ngayNop ?? app.ngayTao)}
                  </p>

                  <ApplicationProgress application={app} compact className="mt-3" />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/don/${app.maHoSo}`}>Xem chi tiết</Link>
                    </Button>
                    {app.trangThai === 'COMPLETED' && (
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <Link to={`/don/${app.maHoSo}/van-ban`}>
                          <Download className="size-4" />
                          Tải PDF
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
