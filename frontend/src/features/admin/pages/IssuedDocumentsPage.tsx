import * as React from 'react'
import { Download, Eye, FileBadge, Search, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { AdministrativeDocument } from '@/features/documents/components/AdministrativeDocument'
import { useIssuedDocuments, useRevokeDocument } from '@/features/documents/hooks/useDocuments'
import { useDebounce } from '@/hooks/useDebounce'
import { PAGE_SIZE } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { maskName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { DOCUMENT_STATUS_LABELS, type DocumentStatus, type SignedDocument } from '@/types'

const STATUS_OPTIONS: { value: DocumentStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'VALID', label: 'Hợp lệ' },
  { value: 'REVOKED', label: 'Đã thu hồi' },
  { value: 'INVALID', label: 'Không hợp lệ' },
]

function statusClass(trangThai: DocumentStatus): string {
  if (trangThai === 'VALID') return 'border-success/40 bg-success-soft text-success'
  if (trangThai === 'REVOKED') return 'border-warning/40 bg-warning-soft text-warning'
  return 'border-destructive/40 bg-destructive-soft text-destructive'
}

/** Trang quản lý văn bản đã cấp, thu hồi và lịch sử tải (chỉ ADMIN). */
export function IssuedDocumentsPage() {
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [trangThai, setTrangThai] = React.useState<DocumentStatus | 'ALL'>('ALL')
  const [page, setPage] = React.useState(1)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const [xemChiTiet, setXemChiTiet] = React.useState<SignedDocument | null>(null)
  const [thuHoi, setThuHoi] = React.useState<SignedDocument | null>(null)
  const [lyDo, setLyDo] = React.useState('')
  const revoke = useRevokeDocument()

  const { data, isLoading, isError, refetch } = useIssuedDocuments({
    page,
    pageSize: PAGE_SIZE,
    tuKhoa: tuKhoaTre || undefined,
    trangThai,
  })

  React.useEffect(() => {
    setPage(1)
  }, [tuKhoaTre, trangThai])

  const columns: Column<SignedDocument>[] = [
    {
      key: 'soVanBan',
      header: 'Số văn bản',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-semibold">{row.soVanBan}</p>
          <p className="truncate text-xs text-muted-foreground">{row.loaiVanBan}</p>
        </div>
      ),
    },
    {
      key: 'trichYeu',
      header: 'Trích yếu',
      hideOnMobile: true,
      cell: (row) => <span className="line-clamp-1 text-sm">{row.trichYeu}</span>,
    },
    {
      key: 'sinhVien',
      header: 'Người được cấp',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{maskName(row.sinhVien.hoTen)}</p>
          <p className="text-xs text-muted-foreground">{row.sinhVien.khoa}</p>
        </div>
      ),
    },
    {
      key: 'ngayCap',
      header: 'Ngày cấp',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.ngayCap)}</span>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      cell: (row) => (
        <Badge variant="outline" className={statusClass(row.trangThai)}>
          {DOCUMENT_STATUS_LABELS[row.trangThai]}
        </Badge>
      ),
    },
    {
      key: 'luotTai',
      header: 'Lượt tải',
      hideOnMobile: true,
      cell: (row) => <span className="text-sm">{row.luotTai.length}</span>,
    },
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setXemChiTiet(row)}
            aria-label={`Xem văn bản ${row.soVanBan}`}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-warning hover:bg-warning-soft"
            disabled={row.trangThai !== 'VALID'}
            onClick={() => {
              setThuHoi(row)
              setLyDo('')
            }}
            aria-label={`Thu hồi văn bản ${row.soVanBan}`}
          >
            <Undo2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Văn bản đã cấp"
        moTa="Tra cứu văn bản đã cấp, thu hồi văn bản và theo dõi lịch sử tải."
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo số văn bản, trích yếu, họ tên, MSSV…"
              aria-label="Tìm văn bản đã cấp"
              className="pl-8"
            />
          </div>
          <Select value={trangThai} onValueChange={(v) => setTrangThai(v as DocumentStatus | 'ALL')}>
            <SelectTrigger aria-label="Lọc theo trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong="Chưa có văn bản nào được cấp"
        moTaRong="Không có văn bản nào khớp bộ lọc hiện tại."
        phanTrang={
          data
            ? {
                page: data.page,
                totalPages: data.totalPages,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      {/* Chi tiết văn bản */}
      <Dialog open={xemChiTiet !== null} onOpenChange={(open) => !open && setXemChiTiet(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          {xemChiTiet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileBadge className="size-4 text-primary" aria-hidden="true" />
                  {xemChiTiet.soVanBan}
                </DialogTitle>
                <DialogDescription>{xemChiTiet.trichYeu}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg bg-muted/60 p-3">
                  <AdministrativeDocument
                    document={xemChiTiet}
                    verifyUrl={`${window.location.origin}/xac-thuc/${xemChiTiet.tokenXacThuc}`}
                  />
                </div>

                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-brand-heading">
                    <Download className="size-4 text-primary" aria-hidden="true" />
                    Lịch sử tải ({xemChiTiet.luotTai.length})
                  </p>
                  {xemChiTiet.luotTai.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Chưa có lượt tải nào.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {xemChiTiet.luotTai.map((log) => (
                        <li
                          key={log.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">{log.nguoiTai}</span>
                          <span className="font-mono">{log.diaChiIp}</span>
                          <span>{formatDateTime(log.luc)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {xemChiTiet.trangThai === 'REVOKED' && (
                  <p className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                    Văn bản đã bị thu hồi. Lý do: {xemChiTiet.lyDoThuHoi ?? '—'}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={xemChiTiet.trangThai !== 'VALID'}
                    onClick={() => {
                      setThuHoi(xemChiTiet)
                      setLyDo('')
                      setXemChiTiet(null)
                    }}
                  >
                    <Undo2 className="size-4" />
                    Thu hồi văn bản
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={thuHoi !== null}
        onOpenChange={(open) => !open && setThuHoi(null)}
        tieuDe="Thu hồi văn bản"
        moTa={
          thuHoi
            ? `Văn bản ${thuHoi.soVanBan} sẽ chuyển sang trạng thái Đã thu hồi và không còn hiệu lực. Hành động này không thể hoàn tác.`
            : undefined
        }
        nhanXacNhan="Thu hồi văn bản"
        bienThe="destructive"
        dangXuLy={revoke.isPending}
        onXacNhan={() => {
          if (!thuHoi || !lyDo.trim()) return
          revoke.mutate(
            { id: thuHoi.id, lyDo: lyDo.trim() },
            {
              onSuccess: () => setThuHoi(null),
              onError: (error) =>
                toast.error('Không thu hồi được', {
                  description: error instanceof Error ? error.message : undefined,
                }),
            },
          )
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="ly-do-thu-hoi">
            Lý do thu hồi <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="ly-do-thu-hoi"
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            rows={3}
            placeholder="Ví dụ: cấp trùng, sai nội dung, hết hiệu lực…"
          />
          {!lyDo.trim() && (
            <p className={cn('text-xs text-muted-foreground')}>
              Bắt buộc nhập lý do thu hồi.
            </p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  )
}
