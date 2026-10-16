import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCheck, ClipboardList, Clock3, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ApprovalCharts } from '../components/ApprovalCharts'
import { useApprovalStats, useOverdueApplications } from '../hooks/useApprovals'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, slaText } from '@/lib/formatters'
import { ROLE_LABELS } from '@/types'

/** Trang tổng quan khu vực phê duyệt dành cho cán bộ xử lý. */
export function OverviewPage() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useApprovalStats()
  const { data: quaHan, isLoading: dangTaiQuaHan } = useOverdueApplications(6)

  return (
    <div className="space-y-6">
      <PageHeader
        tieuDe={`Xin chào, ${user?.hoTen ?? ''}`}
        moTa={`${user ? ROLE_LABELS[user.role] : ''}${user?.donViTen ? ` · ${user.donViTen}` : ''} — tổng quan hồ sơ cần xử lý.`}
        actions={
          <Button asChild className="gap-2">
            <Link to="/quan-ly/cho-duyet">
              <ClipboardList className="size-4" />
              Vào hàng chờ duyệt
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          nhan="Chờ tôi duyệt"
          giaTri={stats?.choToiDuyet ?? 0}
          icon={ClipboardList}
          tone="brand"
          dangTai={isLoading}
        />
        <StatCard
          nhan="Sắp hết hạn"
          giaTri={stats?.sapHetHan ?? 0}
          icon={Clock3}
          tone="warning"
          moTa="Trong vòng 24 giờ tới"
          dangTai={isLoading}
        />
        <StatCard
          nhan="Quá hạn"
          giaTri={stats?.quaHan ?? 0}
          icon={AlertTriangle}
          tone="destructive"
          moTa="Cần xử lý ngay"
          dangTai={isLoading}
        />
        <StatCard
          nhan="Đã xử lý tuần này"
          giaTri={stats?.daXuLyTuanNay ?? 0}
          icon={CheckCheck}
          tone="success"
          dangTai={isLoading}
        />
      </div>

      {isLoading || !stats ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <ApprovalCharts
          theoLoaiDon={stats.theoLoaiDon}
          theoTrangThai={stats.theoTrangThai}
          xuHuong7Ngay={stats.xuHuong7Ngay}
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Hồ sơ cần ưu tiên</CardTitle>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
            <Link to="/quan-ly/cho-duyet">
              Xem hàng chờ
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {dangTaiQuaHan ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !quaHan || quaHan.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Không có hồ sơ nào quá hạn hoặc sắp hết hạn. Tiến độ xử lý đang tốt.
            </p>
          ) : (
            <ul className="divide-y">
              {quaHan.map((app) => {
                const sla = slaText(app.hanXuLy)
                return (
                  <li key={app.id}>
                    <Link
                      to={`/quan-ly/don/${app.maHoSo}`}
                      className="flex flex-wrap items-center gap-3 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{app.maHoSo}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {app.sinhVien.hoTen} · {app.sinhVien.maSo} · {app.requestType.ten}
                        </p>
                      </div>
                      <StatusBadge trangThai={app.trangThai} />
                      <span
                        className={
                          sla.mucDo === 'QUA_HAN'
                            ? 'text-xs font-bold text-destructive'
                            : 'text-xs font-bold text-warning'
                        }
                      >
                        {sla.text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Hạn {formatDate(app.hanXuLy)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
