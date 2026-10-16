import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, CalendarDays, FileText, Hash, Search, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { SignatureStamp } from '@/components/common/SignatureStamp'
import { VerifyStatusBanner } from '../components/VerifyStatusBanner'
import { FileHashCompare } from '../components/FileHashCompare'
import { QrScanner } from '../components/QrScanner'
import { useVerifyByToken } from '../hooks/useVerify'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { maskMssv, maskName } from '@/lib/utils'
import { DOCUMENT_STATUS_LABELS } from '@/types'

/** Trang kết quả xác thực văn bản (truy cập qua mã QR hoặc nhập mã). */
export function VerifyResultPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useVerifyByToken(token)
  const [maNhap, setMaNhap] = React.useState('')

  const khongTimThay = isError

  return (
    <div className="container max-w-3xl space-y-5 py-6">
      <div className="space-y-1">
        <h1 className="section-title text-xl font-extrabold text-brand-heading">
          Xác thực văn bản điện tử
        </h1>
        <p className="text-sm text-muted-foreground">
          Kết quả tra cứu văn bản cấp bởi Trường Đại học Thái Bình.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : khongTimThay || !data ? (
        <Card className="border-destructive/40">
          <CardContent className="space-y-4 p-6 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
              <XCircle className="size-6" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="font-bold text-destructive">Không tìm thấy văn bản</p>
              <p className="text-sm text-muted-foreground">
                Mã xác thực không tồn tại hoặc đường dẫn không hợp lệ. Vui lòng kiểm tra lại mã QR
                hoặc nhập số văn bản để tra cứu.
              </p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (maNhap.trim()) {
                  window.location.href = `/xac-thuc/${encodeURIComponent(maNhap.trim())}`
                }
              }}
            >
              <Input
                value={maNhap}
                onChange={(e) => setMaNhap(e.target.value)}
                placeholder="Nhập mã xác thực hoặc số văn bản"
                aria-label="Nhập mã xác thực hoặc số văn bản"
              />
              <Button type="submit" className="shrink-0 gap-1.5">
                <Search className="size-4" />
                Tra cứu
              </Button>
            </form>
            <Button variant="ghost" asChild>
              <Link to="/xac-thuc">Về trang tra cứu</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <VerifyStatusBanner
            trangThai={data.trangThai}
            chuKyConHieuLuc={data.vanBan.chuKyConHieuLuc}
            lyDoThuHoi={data.vanBan.lyDoThuHoi}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                Thông tin văn bản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trích yếu</dt>
                  <dd className="text-sm font-semibold">{data.vanBan.trichYeu}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Số văn bản
                  </dt>
                  <dd className="text-sm font-semibold">{data.vanBan.soVanBan}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Loại văn bản
                  </dt>
                  <dd className="text-sm font-semibold">{data.vanBan.loaiVanBan}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Người được cấp
                  </dt>
                  <dd className="text-sm font-semibold">
                    {maskName(data.vanBan.sinhVien.hoTen)} · {maskMssv(data.vanBan.sinhVien.mssv)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ngày cấp
                  </dt>
                  <dd className="flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                    {formatDate(data.vanBan.ngayCap)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Trạng thái
                  </dt>
                  <dd className="text-sm font-semibold">
                    {DOCUMENT_STATUS_LABELS[data.trangThai]}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                    <Hash className="size-3" aria-hidden="true" /> Mã băm SHA-256
                  </dt>
                  <dd className="break-all font-mono text-[11px] text-foreground/80">
                    {data.vanBan.maBamSha256}
                  </dd>
                </div>
              </dl>

              <Separator />

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-brand-heading">
                  <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
                  Danh sách chữ ký ({data.vanBan.chuKy.length})
                </p>
                <div className="space-y-2">
                  {data.vanBan.chuKy.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Văn bản chưa có chữ ký điện tử.</p>
                  ) : (
                    [...data.vanBan.chuKy]
                      .sort((a, b) => a.buocOrder - b.buocOrder)
                      .map((chuKy) => (
                        <div key={chuKy.id} className="space-y-0.5">
                          <SignatureStamp chuKy={chuKy} compact />
                          <p className="pl-1 text-[11px] text-muted-foreground">
                            {chuKy.hopLe
                              ? 'Chữ ký hợp lệ'
                              : (chuKy.lyDoKhongHopLe ?? 'Chữ ký không hợp lệ')}
                            {' · '}
                            {formatDateTime(chuKy.thoiDiemKy)}
                          </p>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Đối chiếu tệp PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <FileHashCompare token={data.vanBan.tokenXacThuc} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quét mã QR khác</CardTitle>
              </CardHeader>
              <CardContent>
                <QrScanner
                  onResult={(t) => {
                    if (t && t !== token) window.location.href = `/xac-thuc/${encodeURIComponent(t)}`
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
