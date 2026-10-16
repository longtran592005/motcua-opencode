import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TRANG_THAI_COLORS = [
  'hsl(var(--status-draft))',
  'hsl(var(--status-submitted))',
  'hsl(var(--status-pending))',
  'hsl(var(--status-supplement))',
  'hsl(var(--status-rejected))',
  'hsl(var(--status-completed))',
  'hsl(var(--status-cancelled))',
]

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
}

interface ApprovalChartsProps {
  theoLoaiDon: { ten: string; soLuong: number }[]
  theoTrangThai: { trangThai: string; nhan: string; soLuong: number }[]
  xuHuong7Ngay: { ngay: string; nop: number; duyet: number }[]
}

/** Ba biểu đồ thống kê cho trang tổng quan khu quản trị. */
export function ApprovalCharts({ theoLoaiDon, theoTrangThai, xuHuong7Ngay }: ApprovalChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Xu hướng 7 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={xuHuong7Ngay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="mau-nop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mau-duyet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="ngay" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="nop"
                  name="Hồ sơ nộp"
                  stroke="hsl(var(--primary))"
                  fill="url(#mau-nop)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="duyet"
                  name="Lượt duyệt"
                  stroke="hsl(var(--success))"
                  fill="url(#mau-duyet)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hồ sơ theo loại đơn</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={theoLoaiDon} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="ten" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
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
          <CardTitle className="text-base">Phân bố theo trạng thái</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={theoTrangThai.filter((t) => t.soLuong > 0)}
                  dataKey="soLuong"
                  nameKey="nhan"
                  innerRadius={52}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {theoTrangThai
                    .filter((t) => t.soLuong > 0)
                    .map((entry, index) => (
                      <Cell
                        key={entry.trangThai}
                        fill={TRANG_THAI_COLORS[index % TRANG_THAI_COLORS.length]}
                      />
                    ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
