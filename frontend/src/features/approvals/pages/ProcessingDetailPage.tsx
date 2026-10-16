import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  FilePlus2,
  Fingerprint,
  ShieldCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/EmptyState'
import { OtpDialog } from '@/components/common/OtpDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Timeline } from '@/components/common/Timeline'
import { ApplicationDataView, AttachmentList } from '@/features/applications/components/ApplicationDataView'
import { ApplicationProgress } from '@/features/applications/components/ApplicationProgress'
import { useApplicationDetail } from '@/features/applications/hooks/useApplications'
import {
  useApproveApplication,
  useRejectApplication,
  useRequestSupplement,
} from '../hooks/useApprovals'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatDateTime, slaText } from '@/lib/formatters'
import { quickHash, shortHash, cn } from '@/lib/utils'
import { APPROVAL_MODE_LABELS, ROLE_LABELS, type ApiError } from '@/types'

/** Trang xử lý một hồ sơ ở khu vực phê duyệt. */
export function ProcessingDetailPage() {
  const { ma } = useParams<{ ma: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useApplicationDetail(ma)

  const approveApp = useApproveApplication()
  const rejectApp = useRejectApplication()
  const requestBoSung = useRequestSupplement()

  const [moDuyet, setMoDuyet] = React.useState(false)
  const [moOtp, setMoOtp] = React.useState(false)
  const [moTuChoi, setMoTuChoi] = React.useState(false)
  const [moBoSung, setMoBoSung] = React.useState(false)
  const [lyDoTuChoi, setLyDoTuChoi] = React.useState('')
  const [noiDungBoSung, setNoiDungBoSung] = React.useState('')
  const [ghiChuDuyet, setGhiChuDuyet] = React.useState('')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="py-10">
        <ErrorState
          thongDiep="Không tải được hồ sơ. Hồ sơ có thể đã được xử lý hoặc ngoài phạm vi phụ trách."
          onThuLai={() => void refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to="/quan-ly/cho-duyet">Về hàng chờ duyệt</Link>
          </Button>
        </div>
      </div>
    )
  }

  const app = data
  const buoc = app.buocHienTai
  const laOtp = buoc?.mode === 'OTP'
  const coTheXuLy =
    !!buoc &&
    (app.trangThai === 'PENDING_APPROVAL' || app.trangThai === 'SUBMITTED') &&
    (user?.role === buoc.role || user?.role === 'ADMIN')
  const sla = slaText(app.hanXuLy)
  const maBamNoiDung = quickHash(JSON.stringify(app.duLieu))
  const lichSuKy = app.lichSu.filter((h) => h.phuongThuc)
  const tepAnh = app.tepDinhKem.filter((t) => t.loai.startsWith('image/'))

  function sauKhiXuLy(thongDiep: string) {
    toast.success(thongDiep)
    navigate('/quan-ly/cho-duyet')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[
          { label: 'Tổng quan', to: '/quan-ly' },
          { label: 'Chờ tôi duyệt', to: '/quan-ly/cho-duyet' },
          { label: app.maHoSo },
        ]}
        tieuDe={`Hồ sơ ${app.maHoSo}`}
        moTa={app.requestType.ten}
        actions={<StatusBadge trangThai={app.trangThai} />}
      />

      <Button variant="ghost" size="sm" className="gap-1.5 px-0" asChild>
        <Link to="/quan-ly/cho-duyet">
          <ArrowLeft className="size-4" />
          Hàng chờ duyệt
        </Link>
      </Button>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin sinh viên</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                ['Họ và tên', app.sinhVien.hoTen],
                ['Mã số sinh viên', app.sinhVien.maSo],
                ['Lớp', app.sinhVien.lop],
                ['Khoa', app.sinhVien.khoa],
                ['Ngành', app.sinhVien.nganh],
                ['Khóa học', app.sinhVien.khoaHoc],
                ['Email', app.sinhVien.email],
                ['Cố vấn học tập', app.sinhVien.coVanTen ?? '—'],
              ].map(([nhan, giaTri]) => (
                <div key={nhan}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</p>
                  <p className="text-sm font-medium">{giaTri}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nội dung đề nghị</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationDataView fields={app.requestTypeFull.formFields} duLieu={app.duLieu} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tệp đính kèm ({app.tepDinhKem.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tepAnh.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {tepAnh.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border bg-muted"
                    >
                      <img
                        src={file.url}
                        alt={file.ten}
                        className="h-32 w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
              <AttachmentList attachments={app.tepDinhKem} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tình trạng xử lý</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ApplicationProgress application={app} />
              <Separator />
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Ngày nộp</dt>
                  <dd className="font-medium">{formatDate(app.ngayNop)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Hạn xử lý</dt>
                  <dd
                    className={cn(
                      'font-medium',
                      sla.mucDo === 'QUA_HAN' && 'text-destructive',
                      sla.mucDo === 'SAP_HET_HAN' && 'text-warning',
                    )}
                  >
                    {formatDate(app.hanXuLy)}
                  </dd>
                </div>
                {buoc && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Bước hiện tại</dt>
                    <dd className="font-medium">
                      {buoc.ten} · {ROLE_LABELS[buoc.role]}
                    </dd>
                  </div>
                )}
                {buoc && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Chế độ duyệt</dt>
                    <dd>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-semibold',
                          laOtp
                            ? 'bg-warning-soft text-warning'
                            : 'bg-secondary text-primary',
                        )}
                      >
                        {APPROVAL_MODE_LABELS[buoc.mode]}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-base">
                <Fingerprint className="size-4 text-primary" aria-hidden="true" />
                Thông tin chữ ký
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Mã băm nội dung hồ sơ
                </p>
                <p className="break-all font-mono text-xs">{maBamNoiDung}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mã băm tại thời điểm ký sẽ được ghi nhận cùng chữ ký.
                </p>
              </div>
              {lichSuKy.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Hồ sơ chưa có chữ ký điện tử nào được thu thập.
                </p>
              ) : (
                <ul className="space-y-2">
                  {lichSuKy.map((h) => (
                    <li key={h.id} className="rounded-md border bg-card p-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-heading">
                        <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" />
                        {h.nguoiThucHienTen}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.chucVu ?? ROLE_LABELS[h.vaiTro]} · {h.phuongThuc === 'OTP' ? 'Ký OTP' : 'Duyệt điện tử'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.luc)}
                      </p>
                      {h.signatureId && (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          Mã chữ ký: {shortHash(h.signatureId)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lịch sử xử lý</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={app.lichSu} />
            </CardContent>
          </Card>
        </div>
      </div>

      {coTheXuLy ? (
        <div className="sticky bottom-0 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 backdrop-blur sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setMoTuChoi(true)}
            disabled={buoc?.allowReject === false}
          >
            <X className="size-4" />
            Từ chối
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setMoBoSung(true)}
            disabled={buoc?.allowSupplement === false}
          >
            <FilePlus2 className="size-4" />
            Yêu cầu bổ sung
          </Button>
          <Button
            className="gap-2"
            onClick={() => (laOtp ? setMoOtp(true) : setMoDuyet(true))}
            disabled={approveApp.isPending}
          >
            <Check className="size-4" />
            {laOtp ? 'Ký OTP & duyệt' : 'Duyệt hồ sơ'}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          Hồ sơ không còn chờ bạn xử lý.
        </div>
      )}

      {/* Duyệt một chạm */}
      <ConfirmDialog
        open={moDuyet}
        onOpenChange={setMoDuyet}
        tieuDe="Xác nhận duyệt hồ sơ"
        moTa="Hồ sơ sẽ được duyệt ở bước hiện tại và chuyển tới cấp kế tiếp (hoặc cấp văn bản nếu là bước cuối)."
        nhanXacNhan="Duyệt hồ sơ"
        dangXuLy={approveApp.isPending}
        onXacNhan={() => {
          if (!ma) return
          approveApp.mutate(
            { maHoSo: ma, ghiChu: ghiChuDuyet.trim() || undefined },
            {
              onSuccess: () => sauKhiXuLy('Đã duyệt hồ sơ.'),
              onError: (e) =>
                toast.error('Không duyệt được', {
                  description: (e as ApiError).message,
                }),
            },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ghi-chu-duyet">Ghi chú duyệt (không bắt buộc)</Label>
          <Textarea
            id="ghi-chu-duyet"
            value={ghiChuDuyet}
            onChange={(e) => setGhiChuDuyet(e.target.value)}
            rows={2}
            placeholder="Ví dụ: hồ sơ đầy đủ, đủ điều kiện xác nhận."
          />
        </div>
      </ConfirmDialog>

      {/* Ký OTP */}
      <OtpDialog
        open={moOtp}
        onOpenChange={setMoOtp}
        maHoSo={app.maHoSo}
        tieuDe="Ký số OTP để duyệt hồ sơ"
        onXacThuc={async ({ challengeId, otp }) => {
          if (!ma) return
          await approveApp.mutateAsync({ maHoSo: ma, challengeId, otp })
          sauKhiXuLy('Đã ký số OTP và duyệt hồ sơ.')
        }}
      />

      {/* Từ chối */}
      <ConfirmDialog
        open={moTuChoi}
        onOpenChange={setMoTuChoi}
        tieuDe="Từ chối hồ sơ"
        moTa="Hồ sơ sẽ kết thúc ở trạng thái Từ chối và sinh viên không thể tiếp tục bổ sung."
        nhanXacNhan="Từ chối hồ sơ"
        bienThe="destructive"
        dangXuLy={rejectApp.isPending}
        onXacNhan={() => {
          if (!ma || !lyDoTuChoi.trim()) return
          rejectApp.mutate(
            { maHoSo: ma, lyDo: lyDoTuChoi.trim() },
            { onSuccess: () => sauKhiXuLy('Đã từ chối hồ sơ.') },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ly-do-tu-choi">
            Lý do từ chối <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="ly-do-tu-choi"
            value={lyDoTuChoi}
            onChange={(e) => setLyDoTuChoi(e.target.value)}
            rows={3}
            placeholder="Nêu rõ lý do để sinh viên nắm được."
          />
          {!lyDoTuChoi.trim() && (
            <p className="text-xs text-muted-foreground">Bắt buộc nhập lý do từ chối.</p>
          )}
        </div>
      </ConfirmDialog>

      {/* Yêu cầu bổ sung */}
      <ConfirmDialog
        open={moBoSung}
        onOpenChange={setMoBoSung}
        tieuDe="Yêu cầu bổ sung hồ sơ"
        moTa="Hồ sơ sẽ quay về phía sinh viên. Sau khi bổ sung, hồ sơ quay lại đúng bước này."
        nhanXacNhan="Gửi yêu cầu"
        dangXuLy={requestBoSung.isPending}
        onXacNhan={() => {
          if (!ma || !noiDungBoSung.trim()) return
          requestBoSung.mutate(
            { maHoSo: ma, noiDung: noiDungBoSung.trim() },
            { onSuccess: () => sauKhiXuLy('Đã gửi yêu cầu bổ sung.') },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="noi-dung-bo-sung">
            Nội dung cần bổ sung <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="noi-dung-bo-sung"
            value={noiDungBoSung}
            onChange={(e) => setNoiDungBoSung(e.target.value)}
            rows={3}
            placeholder="Ví dụ: bổ sung ảnh CCCD mặt trước, bảng điểm học kỳ 1…"
          />
          {!noiDungBoSung.trim() && (
            <p className="text-xs text-muted-foreground">Bắt buộc nhập nội dung yêu cầu.</p>
          )}
        </div>
      </ConfirmDialog>

      {approveApp.isError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {(approveApp.error as ApiError)?.message ?? 'Không duyệt được hồ sơ.'}
        </p>
      )}
    </div>
  )
}
