import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Download, Printer, ShieldX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { AdministrativeDocument } from '../components/AdministrativeDocument'
import {
  useDocumentByApplication,
  useExportDocument,
  useLogDownload,
} from '../hooks/useDocuments'
import { cn } from '@/lib/utils'

/** Trang xem trước văn bản hành chính A4 của một hồ sơ đã hoàn thành. */
export function DocumentPage() {
  const { ma } = useParams<{ ma: string }>()
  const { data: document, isLoading, isError, refetch } = useDocumentByApplication(ma)
  const exportDoc = useExportDocument()
  const logDownload = useLogDownload()
  const daGhiNhan = React.useRef(false)

  React.useEffect(() => {
    if (document && !daGhiNhan.current) {
      daGhiNhan.current = true
      logDownload.mutate(document.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document])

  if (isLoading) {
    return (
      <div className="container max-w-4xl space-y-4 py-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mx-auto h-[1000px] w-full max-w-[794px]" />
      </div>
    )
  }

  if (isError || !document) {
    return (
      <div className="container max-w-3xl py-10">
        <ErrorState
          thongDiep="Hồ sơ chưa được cấp văn bản hoặc bạn không có quyền truy cập."
          onThuLai={() => void refetch()}
        />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to={ma ? `/don/${ma}` : '/don-cua-toi'}>Về chi tiết hồ sơ</Link>
          </Button>
        </div>
      </div>
    )
  }

  const doc = document
  const verifyUrl = `${window.location.origin}/xac-thuc/${doc.tokenXacThuc}`
  const hopLe = doc.chuKyConHieuLuc && doc.trangThai !== 'REVOKED'

  function xuLyTai() {
    exportDoc.mutate(
      { id: doc.id, dinhDang: 'html' },
      {
        onSuccess: (ketQua) => {
          const cuaSo = window.open('', '_blank')
          if (cuaSo) {
            cuaSo.document.write(ketQua.noiDung)
            cuaSo.document.close()
            cuaSo.focus()
            setTimeout(() => cuaSo.print(), 400)
          } else {
            toast.error('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép để tải PDF.')
            return
          }
          toast.success('Đã mở bản in — chọn "Lưu thành PDF" trong hộp thoại in.')
        },
        onError: (error) => {
          toast.error('Không thể tải văn bản', {
            description: error instanceof Error ? error.message : undefined,
          })
        },
      },
    )
  }

  return (
    <div className="container max-w-4xl space-y-5 py-6">
      <PageHeader
        className="no-print"
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Đơn của tôi', to: '/don-cua-toi' },
          { label: doc.maHoSo, to: `/don/${doc.maHoSo}` },
          { label: 'Văn bản' },
        ]}
        tieuDe={`Văn bản ${doc.soVanBan}`}
        moTa={doc.trichYeu}
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="size-4" />
              In văn bản
            </Button>
            <Button className="gap-2" onClick={xuLyTai} disabled={exportDoc.isPending}>
              <Download className="size-4" />
              Tải PDF
            </Button>
          </>
        }
      />

      <div className="no-print">
        <Button variant="ghost" size="sm" className="gap-1.5 px-0" asChild>
          <Link to={`/don/${doc.maHoSo}`}>
            <ArrowLeft className="size-4" />
            Về chi tiết hồ sơ
          </Link>
        </Button>
      </div>

      <div
        className={cn(
          'no-print flex items-center gap-2.5 rounded-lg border p-3 text-sm font-semibold',
          hopLe
            ? 'border-success/40 bg-success-soft text-success'
            : 'border-destructive/40 bg-destructive-soft text-destructive',
        )}
        role="status"
      >
        {hopLe ? (
          <BadgeCheck className="size-5 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldX className="size-5 shrink-0" aria-hidden="true" />
        )}
        {hopLe ? 'Chữ ký hợp lệ' : 'Nội dung đã bị thay đổi sau khi ký'}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          Mã băm: <span className="font-mono">{doc.maBamSha256.slice(0, 16)}…</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg bg-muted/60 p-2 sm:p-6">
        <AdministrativeDocument document={doc} verifyUrl={verifyUrl} />
      </div>
    </div>
  )
}
