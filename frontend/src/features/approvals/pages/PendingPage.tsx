import * as React from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, Eye, Search, SlidersHorizontal } from 'lucide-react'
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useApproveBatch, usePendingApplications } from '../hooks/useApprovals'
import { useRequestTypes } from '@/features/applications/hooks/useApplications'
import { useDebounce } from '@/hooks/useDebounce'
import { khoaHooks, lopHooks } from '@/hooks/useCatalog'
import { PAGE_SIZE } from '@/lib/constants'
import { formatDate, slaText } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Application } from '@/types'

/** Hàng chờ duyệt: danh sách hồ sơ đang chờ người dùng hiện tại xử lý. */
export function PendingPage() {
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [requestTypeId, setRequestTypeId] = React.useState('ALL')
  const [khoa, setKhoa] = React.useState('ALL')
  const [lop, setLop] = React.useState('ALL')
  const [hanXuLy, setHanXuLy] = React.useState<'ALL' | 'SAP_HET_HAN' | 'QUA_HAN'>('ALL')
  const [sapXep, setSapXep] = React.useState<'HAN_GAN_NHAT' | 'MOI_NHAT' | 'CU_NHAT'>(
    'HAN_GAN_NHAT',
  )
  const [page, setPage] = React.useState(1)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [moDuyetNhanh, setMoDuyetNhanh] = React.useState(false)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data: requestTypes } = useRequestTypes()
  const { data: khoaList } = khoaHooks.useList()
  const { data: lopList } = lopHooks.useList()
  const duyetNhanh = useApproveBatch()

  React.useEffect(() => {
    setPage(1)
    setSelectedIds([])
  }, [tuKhoaTre, requestTypeId, khoa, lop, hanXuLy, sapXep])

  const { data, isLoading, isError, refetch } = usePendingApplications({
    page,
    pageSize: PAGE_SIZE,
    tuKhoa: tuKhoaTre || undefined,
    requestTypeId: requestTypeId === 'ALL' ? undefined : requestTypeId,
    khoa: khoa === 'ALL' ? undefined : khoa,
    lop: lop === 'ALL' ? undefined : lop,
    hanXuLy,
    sapXep,
  })

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
      key: 'ngayNop',
      header: 'Ngày nộp',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.ngayNop)}</span>
      ),
    },
    {
      key: 'hanXuLy',
      header: 'Hạn xử lý',
      sortable: true,
      cell: (row) => {
        const sla = slaText(row.hanXuLy)
        return (
          <div>
            <p className="text-sm">{formatDate(row.hanXuLy)}</p>
            <p
              className={cn(
                'text-xs font-semibold',
                sla.mucDo === 'QUA_HAN' && 'text-destructive',
                sla.mucDo === 'SAP_HET_HAN' && 'text-warning',
                sla.mucDo === 'BINH_THUONG' && 'text-muted-foreground',
              )}
            >
              {sla.text}
            </p>
          </div>
        )
      },
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      cell: (row) => <StatusBadge trangThai={row.trangThai} />,
    },
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row) => (
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to={`/quan-ly/don/${row.maHoSo}`}>
            <Eye className="size-4" />
            Xử lý
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Chờ tôi duyệt"
        moTa="Danh sách hồ sơ đang chờ bạn phê duyệt, sắp xếp theo hạn xử lý gần nhất."
      />

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo MSSV, họ tên, mã hồ sơ…"
              aria-label="Tìm kiếm hồ sơ chờ duyệt"
              className="pl-8"
            />
          </div>
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
          <Select value={khoa} onValueChange={setKhoa}>
            <SelectTrigger aria-label="Lọc theo khoa">
              <SelectValue placeholder="Khoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả khoa</SelectItem>
              {(khoaList ?? []).map((k) => (
                <SelectItem key={k.id} value={k.ten}>
                  {k.ten}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lop} onValueChange={setLop}>
            <SelectTrigger aria-label="Lọc theo lớp">
              <SelectValue placeholder="Lớp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả lớp</SelectItem>
              {(lopList ?? []).map((l) => (
                <SelectItem key={l.id} value={l.ten}>
                  {l.ten}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hanXuLy} onValueChange={(v) => setHanXuLy(v as typeof hanXuLy)}>
            <SelectTrigger aria-label="Lọc theo hạn xử lý">
              <SelectValue placeholder="Hạn xử lý" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Mọi thời hạn</SelectItem>
              <SelectItem value="SAP_HET_HAN">Sắp hết hạn (≤24 giờ)</SelectItem>
              <SelectItem value="QUA_HAN">Đã quá hạn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sapXep} onValueChange={(v) => setSapXep(v as typeof sapXep)}>
            <SelectTrigger aria-label="Sắp xếp danh sách">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                <SelectValue placeholder="Sắp xếp" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HAN_GAN_NHAT">Hạn gần nhất</SelectItem>
              <SelectItem value="MOI_NHAT">Mới nộp gần đây</SelectItem>
              <SelectItem value="CU_NHAT">Nộp lâu nhất</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-secondary/60 p-3">
          <p className="text-sm font-semibold">
            Đã chọn <span className="text-primary">{selectedIds.length}</span> hồ sơ
          </p>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setMoDuyetNhanh(true)}
            disabled={duyetNhanh.isPending}
          >
            <CheckCheck className="size-4" />
            Duyệt nhanh (một chạm)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Bỏ chọn
          </Button>
          <p className="text-xs text-muted-foreground">
            Chỉ những bước ở chế độ “Một chạm” mới duyệt nhanh được.
          </p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        sapXep={
          sapXep === 'HAN_GAN_NHAT'
            ? { key: 'hanXuLy', direction: 'asc' }
            : undefined
        }
        onSapXepChange={(sx) => {
          if (sx.key === 'hanXuLy') setSapXep(sx.direction === 'asc' ? 'HAN_GAN_NHAT' : 'CU_NHAT')
        }}
        thongDiepRong="Không có hồ sơ nào chờ duyệt"
        moTaRong="Hiện không có hồ sơ nào chờ bạn xử lý hoặc không khớp bộ lọc."
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

      <ConfirmDialog
        open={moDuyetNhanh}
        onOpenChange={setMoDuyetNhanh}
        tieuDe={`Duyệt nhanh ${selectedIds.length} hồ sơ`}
        moTa="Hệ thống sẽ tự động duyệt các hồ sơ đang ở bước “Một chạm”. Hồ sơ ở bước yêu cầu ký OTP sẽ được báo lại để xử lý riêng."
        nhanXacNhan="Xác nhận duyệt"
        dangXuLy={duyetNhanh.isPending}
        onXacNhan={() => {
          duyetNhanh.mutate(
            { maHoSoList: selectedIds, ghiChu: 'Duyệt nhanh hàng loạt trên hàng chờ.' },
            {
              onSuccess: () => {
                setMoDuyetNhanh(false)
                setSelectedIds([])
              },
              onError: () => setMoDuyetNhanh(false),
            },
          )
        }}
      />
    </div>
  )
}
