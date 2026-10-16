import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  FilePlus2,
  FileText,
  Undo2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Timeline } from '@/components/common/Timeline'
import { ApplicationDataView, AttachmentList } from '../components/ApplicationDataView'
import { SupplementDialog } from '../components/SupplementDialog'
import { ApplicationProgress } from '../components/ApplicationProgress'
import {
  useApplicationDetail,
  useCancelApplication,
  useSupplementApplication,
} from '../hooks/useApplications'
import { formatDate, formatDateTime, slaText } from '@/lib/formatters'
import { ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

/** Trang chi tiết một hồ sơ phía sinh viên. */
export function ApplicationDetailPage() {
  const { ma } = useParams<{ ma: string }>()
  const { data, isLoading, isError, refetch } = useApplicationDetail(ma)
  const cancelApp = useCancelApplication()
  const supplementApp = useSupplementApplication()

  const [moBoSung, setMoBoSung] = React.useState(false)
  const [moRutDon, setMoRutDon] = React.useState(false)
  const [lyDoRut, setLyDoRut] = React.useState('')

  if (isLoading) {
    return (
      <div className="container max-w-5xl space-y-4 py-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="container max-w-3xl py-10">
        <ErrorState
          thongDiep="Không tải được hồ sơ. Hồ sơ có thể không tồn tại hoặc bạn không có quyền xem."
          onThuLai={() => void refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to="/don-cua-toi">Về danh sách hồ sơ</Link>
          </Button>
        </div>
      </div>
    )
  }

  const app = data
  const coTheRut =
    app.buocDaDuyet === 0 && (app.trangThai === 'SUBMITTED' || app.trangThai === 'PENDING_APPROVAL')
  const sla = slaText(app.hanXuLy)

  return (
    <div className="container max-w-5xl space-y-6 py-6">
      <PageHeader
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Đơn của tôi', to: '/don-cua-toi' },
          { label: app.maHoSo },
        ]}
        tieuDe={`Hồ sơ ${app.maHoSo}`}
        moTa={app.requestType.ten}
        actions={<StatusBadge trangThai={app.trangThai} />}
      />

      <Button variant="ghost" size="sm" className="gap-1.5 px-0" asChild>
        <Link to="/don-cua-toi">
          <ArrowLeft className="size-4" />
          Danh sách hồ sơ
        </Link>
      </Button>

      {app.trangThai === 'NEED_SUPPLEMENT' && app.yeuCauBoSung && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-bold text-warning">Hồ sơ cần bổ sung</p>
            <p className="mt-0.5 text-foreground/85">{app.yeuCauBoSung.noiDung}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Yêu cầu bởi {app.yeuCauBoSung.boiAiTen} · {formatDateTime(app.yeuCauBoSung.luc)}
            </p>
          </div>
          <Button
            className="shrink-0 gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
            onClick={() => setMoBoSung(true)}
          >
            <FilePlus2 className="size-4" />
            Bổ sung hồ sơ
          </Button>
        </div>
      )}

      {app.trangThai === 'REJECTED' && (
        <div className="rounded-xl border border-destructive/40 bg-destructive-soft p-4 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-destructive">
            <XCircle className="size-4" aria-hidden="true" />
            Hồ sơ đã bị từ chối
          </p>
          <p className="mt-1 text-foreground/85">{app.lyDoTuChoi ?? 'Không có lý do được ghi lại.'}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tiến trình xử lý</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ApplicationProgress application={app} />
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Ngày nộp:</span>
                  <span className="font-semibold">
                    {app.ngayNop ? formatDateTime(app.ngayNop) : 'Chưa nộp'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Hạn xử lý:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      sla.mucDo === 'QUA_HAN' && 'text-destructive',
                      sla.mucDo === 'SAP_HET_HAN' && 'text-warning',
                    )}
                  >
                    {formatDate(app.hanXuLy)} ({sla.text})
                  </span>
                </div>
                {app.buocHienTai && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Đang chờ duyệt: </span>
                    <span className="font-semibold">
                      {ROLE_LABELS[app.buocHienTai.role]}
                    </span>
                  </div>
                )}
                {app.soVanBan && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Số văn bản: </span>
                    <span className="font-semibold">{app.soVanBan}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nội dung hồ sơ</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationDataView
                fields={app.requestTypeFull.formFields}
                duLieu={app.duLieu}
              />
              <Separator className="my-4" />
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-heading">
                <FileText className="size-4 text-primary" aria-hidden="true" />
                Tệp đính kèm ({app.tepDinhKem.length})
              </p>
              <AttachmentList attachments={app.tepDinhKem} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lịch sử xử lý</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={app.lichSu} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              {app.trangThai === 'COMPLETED' && (
                <Button className="w-full gap-2" asChild>
                  <Link to={`/don/${app.maHoSo}/van-ban`}>
                    <FileText className="size-4" />
                    Xem &amp; tải văn bản
                  </Link>
                </Button>
              )}
              {app.trangThai === 'DRAFT' && (
                <Button className="w-full gap-2" asChild>
                  <Link to={`/don/moi/${app.requestTypeId}`}>Tiếp tục hoàn thiện</Link>
                </Button>
              )}
              {coTheRut && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  onClick={() => setMoRutDon(true)}
                >
                  <Undo2 className="size-4" />
                  Rút đơn
                </Button>
              )}
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/don-cua-toi">Về danh sách hồ sơ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SupplementDialog
        open={moBoSung}
        onOpenChange={setMoBoSung}
        application={app}
        dangGui={supplementApp.isPending}
        onSubmit={(input) => {
          if (!ma) return
          supplementApp.mutate(
            { maHoSo: ma, input: { tepDinhKem: input.tepDinhKem, ghiChu: input.ghiChu } },
            { onSuccess: () => setMoBoSung(false) },
          )
        }}
      />

      <ConfirmDialog
        open={moRutDon}
        onOpenChange={setMoRutDon}
        tieuDe="Rút hồ sơ"
        moTa="Hồ sơ sẽ chuyển sang trạng thái Đã rút và không thể tiếp tục xử lý. Hành động này không thể hoàn tác."
        nhanXacNhan="Rút đơn"
        bienThe="destructive"
        dangXuLy={cancelApp.isPending}
        onXacNhan={() => {
          if (!ma) return
          cancelApp.mutate(
            { maHoSo: ma, lyDo: lyDoRut.trim() || undefined },
            { onSuccess: () => setMoRutDon(false) },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ly-do-rut">Lý do rút đơn (không bắt buộc)</Label>
          <Textarea
            id="ly-do-rut"
            value={lyDoRut}
            onChange={(e) => setLyDoRut(e.target.value)}
            rows={3}
            placeholder="Ví dụ: đã giải quyết được nguyện vọng, nộp nhầm loại đơn…"
          />
        </div>
      </ConfirmDialog>
      {cancelApp.isError && (
        <p className="text-sm text-destructive">
          {cancelApp.error instanceof Error ? cancelApp.error.message : 'Không rút được hồ sơ.'}
        </p>
      )}
      {supplementApp.isError && (
        <p className="text-sm text-destructive">
          {supplementApp.error instanceof Error
            ? supplementApp.error.message
            : 'Không gửi được bổ sung.'}
        </p>
      )}
    </div>
  )
}
