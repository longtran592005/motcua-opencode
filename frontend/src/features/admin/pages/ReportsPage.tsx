import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { useReportOverview } from '@/features/documents/hooks/useDocuments'
import { downloadBlob } from '@/lib/utils'

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--status-pending))',
  'hsl(var(--destructive))',
  'hsl(var(--brand-dark))',
]

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
}

function sangCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell)
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
        })
        .join(','),
    )
    .join('\r\n')
}

/** Trang báo cáo thống kê hồ sơ (chỉ ADMIN). */
export function ReportsPage() {
  const { data, isLoading, isError, refetch } = useReportOverview()

  function xuatExcel() {
    if (!data) return
    const rows: (string | number)[][] = [
      ['Báo cáo thống kê cổng Một cửa điện tử'],
      [],
      ['Chỉ số', 'Giá trị'],
      ['Tổng hồ sơ', data.tongHoSo],
      ['Hoàn thành', data.hoanThanh],
      ['Đang xử lý', data.dangXuLy],
      ['Từ chối', data.tuChoi],
      ['Quá hạn', data.quaHan],
      ['Tỷ lệ đúng hạn (%)', data.tyLeDungHan],
      ['Thời gian xử lý trung bình (giờ)', data.thoiGianXuLyTrungBinhGio],
      [],
      ['Theo loại đơn', 'Số lượng', 'Tỷ lệ (%)'],
      ...data.theoLoaiDon.map((r) => [r.ten, r.soLuong, r.tyLe]),
      [],
      ['Theo khoa', 'Số lượng', 'Tỷ lệ (%)'],
      ...data.theoKhoa.map((r) => [r.ten, r.soLuong, r.tyLe]),
      [],
      ['Theo trạng thái', 'Số lượng', 'Tỷ lệ (%)'],
      ...data.theoTrangThai.map((r) => [r.ten, r.soLuong, r.tyLe]),
      [],
      ['Thời gian xử lý từng bước', 'Vai trò', 'Giờ trung bình', 'Số hồ sơ'],
      ...data.thoiGianTungBuoc.map((r) => [r.buoc, r.vaiTro, r.gioTrungBinh, r.soHoSo]),
    ]
    downloadBlob('bao-cao-mot-cua.csv', `\uFEFF${sangCsv(rows)}`, 'text/csv;charset=utf-8')
    toast.success('Đã xuất báo cáo (định dạng CSV mở được bằng Excel).')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="py-10">
        <ErrorState onThuLai={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Báo cáo thống kê"
        moTa="Số liệu tổng hợp về hồ sơ, thời gian xử lý và tỷ lệ đúng hạn."
        actions={
          <Button className="gap-2" onClick={xuatExcel}>
            <FileSpreadsheet className="size-4" />
            Xuất Excel
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard nhan="Tổng hồ sơ" giaTri={data.tongHoSo} icon={BarChart3} tone="brand" />
        <StatCard nhan="Hoàn thành" giaTri={data.hoanThanh} icon={CheckCircle2} tone="success" />
        <StatCard
          nhan="Đang xử lý"
          giaTri={data.dangXuLy}
          icon={Clock3}
          tone="warning"
          moTa={`Trung bình ${data.thoiGianXuLyTrungBinhGio}h/hồ sơ`}
        />
        <StatCard
          nhan="Quá hạn"
          giaTri={data.quaHan}
          icon={AlertTriangle}
          tone="destructive"
          moTa={`Tỷ lệ đúng hạn ${data.tyLeDungHan}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hồ sơ theo loại đơn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.theoLoaiDon} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="ten" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar dataKey="soLuong" name="Số hồ sơ" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hồ sơ theo khoa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.theoKhoa} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="ten" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar dataKey="soLuong" name="Số hồ sơ" fill="hsl(var(--brand-dark))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phân bố theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.theoTrangThai.filter((r) => r.soLuong > 0)}
                    dataKey="soLuong"
                    nameKey="ten"
                    innerRadius={54}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.theoTrangThai
                      .filter((r) => r.soLuong > 0)
                      .map((entry, index) => (
                        <Cell key={entry.ten} fill={COLORS[index % COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hồ sơ tiếp nhận & hoàn thành theo tháng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.theoThang} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="thang" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="nop"
                    name="Tiếp nhận"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="hoanThanh"
                    name="Hoàn thành"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4 text-primary" aria-hidden="true" />
            Thời gian xử lý trung bình theo bước
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bước duyệt</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead className="text-right">Giờ trung bình</TableHead>
                <TableHead className="text-right">Số hồ sơ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.thoiGianTungBuoc.map((row) => (
                <TableRow key={`${row.buoc}-${row.vaiTro}`}>
                  <TableCell className="font-medium">{row.buoc}</TableCell>
                  <TableCell className="text-muted-foreground">{row.vaiTro}</TableCell>
                  <TableCell className="text-right">{row.gioTrungBinh}</TableCell>
                  <TableCell className="text-right">{row.soHoSo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
