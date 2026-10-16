import * as React from 'react'
import { Link } from 'react-router-dom'
import { Download, Eye, FileText, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ApplicationProgress } from '../components/ApplicationProgress'
import { useMyApplications, useRequestTypes } from '../hooks/useApplications'
import { useDebounce } from '@/hooks/useDebounce'
import { STATUS_FILTER_OPTIONS, PAGE_SIZE } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import type { Application, ApplicationStatus } from '@/types'

/** Danh sách toàn bộ hồ sơ của sinh viên kèm bộ lọc và tìm kiếm. */
export function MyApplicationsPage() {
  const [trangThai, setTrangThai] = React.useState<ApplicationStatus | 'ALL'>('ALL')
  const [requestTypeId, setRequestTypeId] = React.useState('ALL')
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [page, setPage] = React.useState(1)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data: requestTypes } = useRequestTypes()

  const { data, isLoading, isError, refetch } = useMyApplications({
    page,
    pageSize: PAGE_SIZE,
    trangThai,
    requestTypeId: requestTypeId === 'ALL' ? undefined : requestTypeId,
    tuKhoa: tuKhoaTre || undefined,
  })

  React.useEffect(() => {
    setPage(1)
  }, [trangThai, requestTypeId, tuKhoaTre])

  const columns: Column<Application>[] = [
    {
      key: 'maHoSo',
      header: 'Mã hồ sơ',
      cell: (row) => (
        <Link to={`/don/${row.maHoSo}`} className="font-semibold hover:text-primary hover:underline">
          {row.maHoSo}
        </Link>
      ),
    },
    {
      key: 'loaiDon',
      header: 'Loại đơn',
      cell: (row) => <span className="text-sm">{row.requestType.ten}</span>,
    },
    {
      key: 'ngayNop',
      header: 'Ngày nộp',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.ngayNop ? formatDate(row.ngayNop) : '—'}
        </span>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge trangThai={row.trangThai} />,
    },
    {
      key: 'tienTrinh',
      header: 'Tiến trình',
      hideOnMobile: true,
      className: 'min-w-52',
      cell: (row) => <ApplicationProgress application={row} compact />,
    },
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" asChild aria-label={`Xem hồ sơ ${row.maHoSo}`}>
            <Link to={`/don/${row.maHoSo}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
          {row.trangThai === 'COMPLETED' && (
            <Button
              variant="ghost"
              size="icon-sm"
              asChild
              aria-label={`Tải văn bản ${row.maHoSo}`}
            >
              <Link to={`/don/${row.maHoSo}/van-ban`}>
                <Download className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="container space-y-6 py-6">
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Đơn của tôi' }]}
        tieuDe="Đơn của tôi"
        moTa="Theo dõi toàn bộ hồ sơ đã tạo, lọc theo trạng thái và loại đơn."
        actions={
          <Button asChild className="gap-2">
            <Link to="/">
              <Plus className="size-4" />
              Nộp đơn mới
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo mã hồ sơ, tên loại đơn…"
              aria-label="Tìm kiếm hồ sơ"
              className="pl-8"
            />
          </div>
          <Select value={trangThai} onValueChange={(v) => setTrangThai(v as ApplicationStatus | 'ALL')}>
            <SelectTrigger aria-label="Lọc theo trạng thái">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={requestTypeId} onValueChange={setRequestTypeId}>
            <SelectTrigger aria-label="Lọc theo loại đơn">
              <SelectValue placeholder="Loại đơn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả loại đơn</SelectItem>
              {(requestTypes ?? []).map((rt) => (
                <SelectItem key={rt.id} value={rt.id}>
                  {rt.ten}
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
        thongDiepRong="Chưa có hồ sơ nào"
        moTaRong="Bạn chưa tạo hồ sơ nào hoặc không có hồ sơ khớp bộ lọc hiện tại."
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

      {!isLoading && (data?.items.length ?? 0) > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden="true" />
          Tổng {data?.total ?? 0} hồ sơ.
        </p>
      )}
    </div>
  )
}
