import * as React from 'react'
import { ArrowRight, History, Search, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuditActions, useAuditLogs } from '../hooks/useAdmin'
import { useDebounce } from '@/hooks/useDebounce'
import { PAGE_SIZE } from '@/lib/constants'
import { formatDateTime } from '@/lib/formatters'
import { AUDIT_ACTION_LABELS, ROLE_LABELS, type AuditLog } from '@/types'

/** Trang nhật ký hệ thống chỉ đọc (chỉ ADMIN). */
export function AuditLogPage() {
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [hanhDong, setHanhDong] = React.useState('ALL')
  const [tuNgay, setTuNgay] = React.useState('')
  const [denNgay, setDenNgay] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [chiTiet, setChiTiet] = React.useState<AuditLog | null>(null)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data: actions } = useAuditActions()
  const { data, isLoading, isError, refetch } = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    tuKhoa: tuKhoaTre || undefined,
    hanhDong: hanhDong === 'ALL' ? undefined : hanhDong,
    tuNgay: tuNgay || undefined,
    denNgay: denNgay || undefined,
  })

  React.useEffect(() => {
    setPage(1)
  }, [tuKhoaTre, hanhDong, tuNgay, denNgay])

  const columns: Column<AuditLog>[] = [
    {
      key: 'luc',
      header: 'Thời gian',
      cell: (row) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDateTime(row.luc)}
        </span>
      ),
    },
    {
      key: 'nguoiThucHien',
      header: 'Người thực hiện',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.nguoiThucHienTen}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[row.vaiTro]}</p>
        </div>
      ),
    },
    {
      key: 'hanhDong',
      header: 'Hành động',
      cell: (row) => (
        <Badge variant="secondary">{AUDIT_ACTION_LABELS[row.hanhDong] ?? row.hanhDong}</Badge>
      ),
    },
    {
      key: 'doiTuong',
      header: 'Đối tượng',
      hideOnMobile: true,
      cell: (row) => <span className="text-sm text-muted-foreground">{row.doiTuong}</span>,
    },
    {
      key: 'diaChiIp',
      header: 'Thiết bị / IP',
      hideOnMobile: true,
      cell: (row) => (
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="font-mono">{row.diaChiIp}</p>
          <p className="truncate">{row.thietBi}</p>
        </div>
      ),
    },
    {
      key: 'chiTiet',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setChiTiet(row)}>
          Chi tiết
          <ArrowRight className="size-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Nhật ký hệ thống"
        moTa="Ghi nhận toàn bộ thao tác quan trọng phục vụ tra soát và kiểm toán. Chỉ xem, không sửa."
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo người thực hiện, đối tượng, IP…"
              aria-label="Tìm nhật ký"
              className="pl-8"
            />
          </div>
          <Select value={hanhDong} onValueChange={setHanhDong}>
            <SelectTrigger aria-label="Lọc theo hành động">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả hành động</SelectItem>
              {(actions ?? []).map((a) => (
                <SelectItem key={a.ma} value={a.ma}>
                  {a.nhan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="nk-tu-ngay" className="text-xs">
                Từ ngày
              </Label>
              <Input
                id="nk-tu-ngay"
                type="date"
                value={tuNgay}
                onChange={(e) => setTuNgay(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nk-den-ngay" className="text-xs">
                Đến ngày
              </Label>
              <Input
                id="nk-den-ngay"
                type="date"
                value={denNgay}
                onChange={(e) => setDenNgay(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong="Chưa có bản ghi nhật ký nào"
        moTaRong="Không có bản ghi nào khớp bộ lọc hiện tại."
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

      <Dialog open={chiTiet !== null} onOpenChange={(open) => !open && setChiTiet(null)}>
        <DialogContent className="max-w-lg">
          {chiTiet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="size-4 text-primary" aria-hidden="true" />
                  {AUDIT_ACTION_LABELS[chiTiet.hanhDong] ?? chiTiet.hanhDong}
                </DialogTitle>
                <DialogDescription>
                  {formatDateTime(chiTiet.luc)} · {chiTiet.nguoiThucHienTen} ({ROLE_LABELS[chiTiet.vaiTro]})
                </DialogDescription>
              </DialogHeader>

              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Đối tượng</dt>
                  <dd className="text-right font-medium">{chiTiet.doiTuong}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Mã đối tượng</dt>
                  <dd className="text-right font-mono text-xs">{chiTiet.doiTuongId}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Địa chỉ IP</dt>
                  <dd className="text-right font-mono text-xs">{chiTiet.diaChiIp}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Thiết bị</dt>
                  <dd className="text-right">{chiTiet.thietBi}</dd>
                </div>
              </dl>

              {(chiTiet.giaTriTruoc || chiTiet.giaTriSau) && (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-brand-heading">
                    <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
                    Thay đổi dữ liệu
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-destructive/30 bg-destructive-soft/40 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-destructive">
                        Trước
                      </p>
                      <p className="mt-1 whitespace-pre-line font-mono text-xs">
                        {chiTiet.giaTriTruoc ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-success/30 bg-success-soft/40 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-success">Sau</p>
                      <p className="mt-1 whitespace-pre-line font-mono text-xs">
                        {chiTiet.giaTriSau ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
