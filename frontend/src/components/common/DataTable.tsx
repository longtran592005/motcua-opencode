import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SkeletonTable } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState } from './EmptyState'

export interface Column<T> {
  key: string
  header: string
  /** Render nội dung ô. */
  cell: (row: T) => ReactNode
  /** Cho phép sắp xếp theo cột này. */
  sortable?: boolean
  className?: string
  headerClassName?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  dangTai?: boolean
  loi?: boolean
  onThuLai?: () => void
  thongDiepRong?: string
  moTaRong?: string
  /** Chọn nhiều dòng. */
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  sapXep?: { key: string; direction: 'asc' | 'desc' }
  onSapXepChange?: (sapXep: { key: string; direction: 'asc' | 'desc' }) => void
  /** Phân trang phía server. */
  phanTrang?: {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
  }
  onRowClick?: (row: T) => void
  className?: string
}

/**
 * Bảng dữ liệu dùng chung: cuộn ngang trên mobile, có trạng thái
 * đang tải / rỗng / lỗi, chọn nhiều dòng và sắp xếp.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  dangTai,
  loi,
  onThuLai,
  thongDiepRong = 'Chưa có dữ liệu',
  moTaRong,
  selectable,
  selectedIds = [],
  onSelectionChange,
  sapXep,
  onSapXepChange,
  phanTrang,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (loi) {
    return <ErrorState onThuLai={onThuLai ?? (() => undefined)} className={className} />
  }

  if (dangTai) {
    return (
      <div className={cn('rounded-lg border p-4', className)}>
        <SkeletonTable rows={5} cols={Math.min(columns.length, 5)} />
      </div>
    )
  }

  if (!rows.length) {
    return <EmptyState tieuDe={thongDiepRong} moTa={moTaRong} className={className} />
  }

  const ids = rows.map(getRowId)
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id))
  const someSelected = ids.some((id) => selectedIds.includes(id)) && !allSelected

  const toggleAll = () => {
    if (!onSelectionChange) return
    if (allSelected) onSelectionChange(selectedIds.filter((id) => !ids.includes(id)))
    else onSelectionChange([...new Set([...selectedIds, ...ids])])
  }

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    )
  }

  const handleSort = (key: string) => {
    if (!onSapXepChange) return
    const direction =
      sapXep?.key === key && sapXep.direction === 'asc' ? 'desc' : 'asc'
    onSapXepChange({ key, direction })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả các dòng"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.headerClassName, col.hideOnMobile && 'hidden md:table-cell')}
                >
                  {col.sortable && onSapXepChange ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 uppercase hover:text-primary"
                      aria-label={`Sắp xếp theo ${col.header}`}
                    >
                      {col.header}
                      {sapXep?.key === col.key ? (
                        sapXep.direction === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = getRowId(row)
              const selected = selectedIds.includes(id)
              return (
                <TableRow
                  key={id}
                  data-state={selected ? 'selected' : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Chọn dòng ${id}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(col.className, col.hideOnMobile && 'hidden md:table-cell')}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {phanTrang && phanTrang.totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Trang {phanTrang.page}/{phanTrang.totalPages} · {phanTrang.total} bản ghi
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={phanTrang.page <= 1}
              onClick={() => phanTrang.onPageChange(phanTrang.page - 1)}
              aria-label="Trang trước"
            >
              <ChevronLeft className="size-4" />
              Trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={phanTrang.page >= phanTrang.totalPages}
              onClick={() => phanTrang.onPageChange(phanTrang.page + 1)}
              aria-label="Trang sau"
            >
              Sau
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
