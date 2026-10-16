import * as React from 'react'
import { Link } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
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
import { useProcessedApplications } from '../hooks/useApprovals'
import { useRequestTypes } from '@/features/applications/hooks/useApplications'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { STATUS_FILTER_OPTIONS, PAGE_SIZE } from '@/lib/constants'
import { APPROVAL_ACTION_LABELS, type Application, type ApplicationStatus } from '@/types'
import { formatDateTime } from '@/lib/formatters'

/** Danh sách hồ sơ đã được người dùng hiện tại xử lý. */
export function ProcessedPage() {
  const { user } = useAuth()
  const [trangThai, setTrangThai] = React.useState<ApplicationStatus | 'ALL'>('ALL')
  const [requestTypeId, setRequestTypeId] = React.useState('ALL')
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [page, setPage] = React.useState(1)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data: requestTypes } = useRequestTypes()
  const { data, isLoading, isError, refetch } = useProcessedApplications({
    page,
    pageSize: PAGE_SIZE,
    trangThai,
    requestTypeId: requestTypeId === 'ALL' ? undefined : requestTypeId,
    tuKhoa: tuKhoaTre || undefined,
  })

  React.useEffect(() => {
    setPage(1)
  }, [trangThai, requestTypeId, tuKhoaTre])

  function hanhDongCuaToi(app: Application): string {
    const hanhDong = [...app.lichSu]
      .reverse()
      .find((h) => h.nguoiThucHienId === user?.id && h.hanhDong !== 'SUBMIT')
    if (!hanhDong) return '—'
    return `${APPROVAL_ACTION_LABELS[hanhDong.hanhDong]} · ${formatDateTime(hanhDong.luc)}`
  }

  const columns: Column<Application>[] = [
    {
      key: 'maHoSo',
      header: 'Mã hồ sơ',
      cell: (row) => (
        <Link
          to={`/quan-ly/don/${row.maHoSo}`}
          className="font-semibold hover:text-primary hover:underline"
        >
          {row.maHoSo}
        </Link>
      ),
    },
    {
      key: 'sinhVien',
      header: 'Sinh viên',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.sinhVien.hoTen}</p>
          <p className="text-xs text-muted-foreground">
            {row.sinhVien.maSo} · {row.sinhVien.lop}
          </p>
        </div>
      ),
    },
    {
      key: 'loaiDon',
      header: 'Loại đơn',
      hideOnMobile: true,
      cell: (row) => <span className="text-sm">{row.requestType.ten}</span>,
    },
    {
      key: 'xuLy',
      header: 'Xử lý của tôi',
      hideOnMobile: true,
      cell: (row) => <span className="text-sm text-muted-foreground">{hanhDongCuaToi(row)}</span>,
    },
    {
      key: 'ketQua',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge trangThai={row.trangThai} />,
    },
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row) => (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`Xem hồ sơ ${row.maHoSo}`}>
          <Link to={`/quan-ly/don/${row.maHoSo}`}>
            <Eye className="size-4" />
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Đã xử lý"
        moTa="Lịch sử các hồ sơ bạn đã duyệt, từ chối hoặc yêu cầu bổ sung."
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative lg:col-span-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo MSSV, họ tên, mã hồ sơ…"
              aria-label="Tìm hồ sơ đã xử lý"
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
        thongDiepRong="Chưa xử lý hồ sơ nào"
        moTaRong="Bạn chưa xử lý hồ sơ nào hoặc không có hồ sơ khớp bộ lọc."
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
    </div>
  )
}
