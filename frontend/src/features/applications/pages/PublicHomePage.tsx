import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  LogIn,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ProcessDiagram } from '../components/ProcessDiagram'
import { QuickServiceGrid } from '../components/QuickServiceGrid'
import { SCHOOL } from '@/lib/constants'

const DIEM_NOI_BAT = [
  {
    icon: FileSearch,
    tieuDe: 'Nộp hồ sơ trực tuyến',
    moTa: 'Gửi yêu cầu cấp giấy xác nhận, bảng điểm, hoãn thi, bảo lưu… ngay trên cổng.',
  },
  {
    icon: ShieldCheck,
    tieuDe: 'Phê duyệt nhiều cấp',
    moTa: 'Hồ sơ luân chuyển qua Cố vấn học tập, Trưởng khoa và Phòng Đào tạo.',
  },
  {
    icon: QrCode,
    tieuDe: 'Văn bản có mã xác thực',
    moTa: 'Mỗi văn bản được cấp kèm mã QR để tra cứu và kiểm tra tính hợp lệ.',
  },
]

/** Trang chủ cổng thông tin dành cho người chưa đăng nhập. */
export function PublicHomePage() {
  const navigate = useNavigate()
  const [maVanBan, setMaVanBan] = React.useState('')

  function traCuu(event: React.FormEvent) {
    event.preventDefault()
    const ma = maVanBan.trim()
    if (!ma) return
    navigate(`/xac-thuc/${encodeURIComponent(ma)}`)
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <section className="bg-brand-heading text-white">
        <div className="container grid gap-8 py-12 lg:grid-cols-2 lg:items-center lg:py-16">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {SCHOOL.ten}
            </span>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
              Cổng dịch vụ một cửa điện tử
            </h1>
            <p className="max-w-xl text-white/80">
              Nộp hồ sơ hành chính, theo dõi tiến trình phê duyệt và nhận văn bản điện tử có mã xác
              thực — tất cả trong một nền tảng duy nhất dành cho sinh viên và cán bộ nhà trường.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/dang-nhap">
                  <LogIn className="size-4" />
                  Đăng nhập để nộp hồ sơ
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/thu-vien-bieu-mau">Thư viện biểu mẫu</Link>
              </Button>
            </div>

            <form
              onSubmit={traCuu}
              className="flex flex-col gap-2 rounded-xl bg-white/10 p-3 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <QrCode
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60"
                  aria-hidden="true"
                />
                <Input
                  value={maVanBan}
                  onChange={(e) => setMaVanBan(e.target.value)}
                  placeholder="Nhập mã văn bản để tra cứu, ví dụ: 120/GXN-ĐHTB"
                  aria-label="Nhập mã văn bản để tra cứu"
                  className="h-10 border-transparent bg-white pl-9 text-foreground"
                />
              </div>
              <Button type="submit" className="h-10 shrink-0 gap-1.5">
                Tra cứu
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {DIEM_NOI_BAT.map((item) => (
              <Card key={item.tieuDe} className="border-white/15 bg-white/5 text-white backdrop-blur">
                <CardContent className="space-y-2 p-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-white/15">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="font-bold">{item.tieuDe}</p>
                  <p className="text-xs text-white/75">{item.moTa}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { so: '1.007', nhan: 'Hồ sơ đã tiếp nhận' },
            { so: '12', nhan: 'Loại thủ tục trực tuyến' },
            { so: '96%', nhan: 'Hồ sơ đúng hạn' },
          ].map((item) => (
            <div key={item.nhan} className="rounded-xl bg-secondary/50 p-4 text-center">
              <p className="text-2xl font-extrabold text-brand-heading">{item.so}</p>
              <p className="text-sm text-muted-foreground">{item.nhan}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="section-title text-xl font-extrabold text-brand-heading">
              Quy trình xử lý hồ sơ
            </h2>
            <p className="text-sm text-muted-foreground">
              Bốn bước từ khi nộp đơn đến khi nhận văn bản có mã xác thực.
            </p>
          </div>
          <ProcessDiagram />
        </div>
      </section>

      <section className="container space-y-6">
        <QuickServiceGrid />
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-secondary/40 p-5 text-center">
          <p className="flex items-center gap-2 font-bold text-brand-heading">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            Sẵn sàng nộp hồ sơ?
          </p>
          <p className="text-sm text-muted-foreground">
            Đăng nhập bằng mã số sinh viên để bắt đầu sử dụng dịch vụ một cửa.
          </p>
          <Button asChild className="gap-2">
            <Link to="/dang-nhap">
              <LogIn className="size-4" />
              Đăng nhập ngay
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
