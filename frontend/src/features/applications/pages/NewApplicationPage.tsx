import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Send, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/EmptyState'
import { FileUpload } from '@/components/common/FileUpload'
import { PageHeader } from '@/components/common/PageHeader'
import { Separator } from '@/components/ui/separator'
import { ApplicationFieldInput } from '../components/ApplicationFieldInput'
import { RelatedFormsCard } from '../components/RelatedFormsCard'
import { RequestTypeIcon } from '../components/RequestTypeIcon'
import { SubmissionResult } from '../components/SubmissionResult'
import {
  useCreateDraft,
  useRequestType,
  useSubmitApplication,
  useUpdateDraft,
} from '../hooks/useApplications'
import { validateApplicationData, type ApplicationFormErrors } from '../lib/applicationSchema'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/formatters'
import type { Attachment, Application, CreateApplicationPayload } from '@/types'

/** Trang nộp đơn mới: biểu mẫu động theo cấu hình loại đơn. */
export function NewApplicationPage() {
  const { loaiDon } = useParams<{ loaiDon: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { data: requestType, isLoading, isError, refetch } = useRequestType(loaiDon)
  const createDraft = useCreateDraft()
  const updateDraft = useUpdateDraft()
  const submitApp = useSubmitApplication()

  const [giaTri, setGiaTri] = React.useState<Record<string, unknown>>({})
  const [tepDinhKem, setTepDinhKem] = React.useState<Attachment[]>([])
  const [loi, setLoi] = React.useState<ApplicationFormErrors>({})
  const [maNhap, setMaNhap] = React.useState<string | null>(null)
  const [ketQua, setKetQua] = React.useState<Application | null>(null)
  const [dangGui, setDangGui] = React.useState(false)

  // Tự điền thông tin sinh viên vào các trường chỉ đọc khi tải xong cấu hình.
  React.useEffect(() => {
    if (!requestType || !user) return
    const auto: Record<string, unknown> = {
      ho_ten: user.hoTen,
      mssv: user.maSo,
      ngay_sinh: user.ngaySinh,
      lop: user.lopTen,
      khoa: user.donViTen,
      nganh: user.nganhTen,
      khoa_hoc: user.khoaHoc,
    }
    setGiaTri((prev) => {
      const next = { ...prev }
      for (const field of requestType.formFields) {
        if (field.readOnly && auto[field.key] !== undefined) next[field.key] = auto[field.key]
        else if (next[field.key] === undefined && field.defaultValue !== undefined)
          next[field.key] = field.defaultValue
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestType, user])

  if (isLoading) {
    return (
      <div className="container max-w-4xl space-y-4 py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (isError || !requestType) {
    return (
      <div className="container max-w-4xl py-10">
        <ErrorState
          thongDiep="Không tìm thấy loại đơn bạn chọn hoặc máy chủ đang gặp sự cố."
          onThuLai={() => void refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (ketQua) {
    return (
      <div className="container py-8">
        <SubmissionResult application={ketQua} />
      </div>
    )
  }

  const rt = requestType

  function capNhat(key: string, value: unknown) {
    setGiaTri((prev) => ({ ...prev, [key]: value }))
    setLoi((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function gopTep(requirementKey: string, next: Attachment[]) {
    setTepDinhKem((prev) => [
      ...prev.filter((a) => a.requirementKey !== requirementKey),
      ...next.map((a) => ({ ...a, requirementKey })),
    ])
  }

  function giayToThieu(): string[] {
    const daCo = new Set(tepDinhKem.map((t) => t.requirementKey))
    return rt.giayTo.filter((g) => g.batBuoc && !daCo.has(g.key)).map((g) => g.label)
  }

  async function luuNhap() {
    setDangGui(true)
    const payload: CreateApplicationPayload = {
      requestTypeId: rt.id,
      duLieu: giaTri,
      tepDinhKem,
    }
    try {
      if (maNhap) await updateDraft.mutateAsync({ maHoSo: maNhap, payload })
      else {
        const draft = await createDraft.mutateAsync(payload)
        setMaNhap(draft.maHoSo)
      }
      toast.success('Đã lưu bản nháp.', {
        description: 'Bạn có thể tiếp tục hoàn thiện hồ sơ trong mục "Đơn của tôi".',
      })
      navigate('/don-cua-toi')
    } catch (error) {
      toast.error('Không lưu được bản nháp', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDangGui(false)
    }
  }

  async function nopHoSo() {
    const errors = validateApplicationData(rt, giaTri)
    const thieuTep = giayToThieu()
    if (Object.keys(errors).length > 0 || thieuTep.length > 0) {
      setLoi(errors)
      toast.error('Hồ sơ chưa hợp lệ', {
        description:
          thieuTep.length > 0
            ? `Thiếu giấy tờ bắt buộc: ${thieuTep.join(', ')}.`
            : 'Vui lòng kiểm tra các trường được đánh dấu.',
      })
      return
    }

    setDangGui(true)
    const payload: CreateApplicationPayload = {
      requestTypeId: rt.id,
      duLieu: giaTri,
      tepDinhKem,
    }
    try {
      const draft = maNhap
        ? await updateDraft.mutateAsync({ maHoSo: maNhap, payload })
        : await createDraft.mutateAsync(payload)
      const submitted = await submitApp.mutateAsync(draft.maHoSo)
      setKetQua(submitted)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      toast.error('Không nộp được hồ sơ', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="container max-w-4xl space-y-6 py-6">
      <PageHeader
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Nộp đơn mới' },
        ]}
        tieuDe={rt.ten}
        moTa={rt.moTa}
      />

      <Button variant="ghost" size="sm" className="gap-1.5 px-0" asChild>
        <Link to="/">
          <ArrowLeft className="size-4" />
          Chọn loại đơn khác
        </Link>
      </Button>

      <Card>
        <CardHeader className="gap-1">
          <div className="flex items-center gap-3">
            <RequestTypeIcon icon={rt.icon} mau={rt.mau} />
            <div>
              <CardTitle className="text-base">Thông tin hồ sơ</CardTitle>
              <p className="text-xs text-muted-foreground">
                Thời gian xử lý dự kiến {rt.soNgayXuLy} ngày
                {rt.lePhi > 0 ? ` · Lệ phí ${formatCurrency(rt.lePhi)}` : ' · Miễn phí'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[...rt.formFields]
              .sort((a, b) => a.order - b.order)
              .filter((f) => f.type !== 'upload')
              .map((field) => (
                <ApplicationFieldInput
                  key={field.id}
                  field={field}
                  value={giaTri[field.key]}
                  onChange={(v) => capNhat(field.key, v)}
                  error={loi[field.key]}
                />
              ))}
          </div>

          {rt.formFields.some((f) => f.type === 'upload') && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-brand-heading">Tệp đính kèm theo biểu mẫu</h3>
                {rt.formFields
                  .filter((f) => f.type === 'upload')
                  .map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <p className="text-sm font-medium">{field.label}</p>
                      <FileUpload
                        value={tepDinhKem.filter((a) => a.requirementKey === field.key)}
                        onChange={(next) => gopTep(field.key, next)}
                        accept={field.accept}
                        maxSizeMb={field.maxSizeMb}
                      />
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {rt.giayTo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Giấy tờ kèm theo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {rt.giayTo.map((giayTo) => (
              <div key={giayTo.key} className="space-y-1.5">
                <p className="flex items-center gap-1 text-sm font-medium">
                  {giayTo.label}
                  {giayTo.batBuoc && (
                    <span className="text-destructive" aria-label="Bắt buộc">
                      *
                    </span>
                  )}
                </p>
                {giayTo.helpText && (
                  <p className="text-xs text-muted-foreground">{giayTo.helpText}</p>
                )}
                <FileUpload
                  value={tepDinhKem.filter((a) => a.requirementKey === giayTo.key)}
                  onChange={(next) => gopTep(giayTo.key, next)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <RelatedFormsCard requestTypeId={rt.id} />

      {Object.keys(loi).length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Vui lòng hoàn thiện các trường bắt buộc được đánh dấu đỏ trước khi nộp.</p>
        </div>
      )}

      <div className="sticky bottom-0 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 backdrop-blur sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => void luuNhap()}
          disabled={dangGui}
        >
          <Save className="size-4" />
          Lưu bản nháp
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={() => void nopHoSo()}
          disabled={dangGui}
        >
          {dangGui ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Nộp hồ sơ
        </Button>
      </div>
    </div>
  )
}
