import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, FileEdit, Search, TriangleAlert, Files } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/common/StatCard'
import { SupplementAlert } from '../components/SupplementAlert'
import { QuickServiceGrid } from '../components/QuickServiceGrid'
import { RecentApplications } from '../components/RecentApplications'
import { ProcessDiagram } from '../components/ProcessDiagram'
import { useMyStats } from '../hooks/useApplications'
import { useAuth } from '@/hooks/useAuth'

/** Trang chủ khu vực sinh viên: điểm vào cho mọi thao tác nộp và theo dõi hồ sơ. */
export function StudentHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tuKhoa, setTuKhoa] = React.useState('')
  const { data: stats, isLoading } = useMyStats()

  function timKiem(event: React.FormEvent) {
    event.preventDefault()
    const q = tuKhoa.trim()
    navigate(q ? `/thu-vien-bieu-mau?q=${encodeURIComponent(q)}` : '/thu-vien-bieu-mau')
  }

  return (
    <div className="container space-y-8 py-6 lg:py-8">
      {/* Banner chào mừng */}
      <section className="overflow-hidden rounded-2xl bg-brand-heading text-white">
        <div className="relative p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/30 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative max-w-2xl space-y-4">
            <div>
              <p className="text-sm text-white/70">Xin chào,</p>
              <h1 className="text-2xl font-extrabold sm:text-3xl">{user?.hoTen}</h1>
              <p className="mt-1 text-sm text-white/80">
                {user?.maSo} · {user?.lopTen ?? '—'} · {user?.nganhTen ?? '—'}
              </p>
            </div>
            <form onSubmit={timKiem} className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={tuKhoa}
                  onChange={(e) => setTuKhoa(e.target.value)}
                  placeholder="Tìm thủ tục, biểu mẫu bạn cần…"
                  aria-label="Tìm thủ tục, biểu mẫu"
                  className="h-11 border-transparent bg-white pl-9 text-foreground"
                />
              </div>
              <Button type="submit" size="lg" className="h-11 shrink-0">
                Tìm kiếm
              </Button>
            </form>
          </div>
        </div>
      </section>

      <SupplementAlert />

      <QuickServiceGrid />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentApplications />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Thống kê của tôi</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <StatCard
                nhan="Bản nháp"
                giaTri={stats?.nhap ?? 0}
                icon={FileEdit}
                tone="muted"
                dangTai={isLoading}
              />
              <StatCard
                nhan="Đang xử lý"
                giaTri={stats?.dangXuLy ?? 0}
                icon={Clock}
                tone="brand"
                dangTai={isLoading}
              />
              <StatCard
                nhan="Cần bổ sung"
                giaTri={stats?.canBoSung ?? 0}
                icon={TriangleAlert}
                tone="warning"
                dangTai={isLoading}
              />
              <StatCard
                nhan="Hoàn thành"
                giaTri={stats?.hoanThanh ?? 0}
                icon={CheckCircle2}
                tone="success"
                dangTai={isLoading}
              />
            </CardContent>
          </Card>

          <Card className="bg-secondary/40">
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-2 font-bold text-brand-heading">
                <Files className="size-4 text-primary" aria-hidden="true" />
                Tổng hồ sơ đã tạo
              </p>
              <p className="text-3xl font-extrabold text-brand-heading">{stats?.tong ?? 0}</p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/don-cua-toi">Quản lý tất cả hồ sơ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="section-title text-lg font-extrabold text-brand-heading">
            Quy trình xử lý hồ sơ
          </h2>
          <p className="text-sm text-muted-foreground">
            Hồ sơ được luân chuyển qua các cấp duyệt trước khi cấp văn bản điện tử.
          </p>
        </div>
        <ProcessDiagram />
      </section>
    </div>
  )
}
