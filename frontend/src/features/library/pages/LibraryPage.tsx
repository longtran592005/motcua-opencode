import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileSpreadsheet, FileText, FolderOpen, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import {
  useDownloadLibraryItem,
  useLibraryGroups,
  useLibraryItems,
} from '../hooks/useLibrary'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { LibraryItem } from '@/types'

function LibraryIcon({ loaiTep, className }: { loaiTep: LibraryItem['loaiTep']; className?: string }) {
  if (loaiTep === 'xlsx' || loaiTep === 'xls') {
    return <FileSpreadsheet className={className} aria-hidden="true" />
  }
  return <FileText className={className} aria-hidden="true" />
}

const LOAI_TONE: Record<LibraryItem['loaiTep'], string> = {
  pdf: 'bg-destructive-soft text-destructive',
  doc: 'bg-secondary text-primary',
  docx: 'bg-secondary text-primary',
  xls: 'bg-success-soft text-success',
  xlsx: 'bg-success-soft text-success',
}

const LOAI_LABEL: Record<LibraryItem['loaiTep'], string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
}

/** Thư viện biểu mẫu, quy trình giải quyết thủ tục và văn bản hành chính. */
export function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tuKhoa, setTuKhoa] = React.useState(searchParams.get('q') ?? '')
  const [nhom, setNhom] = React.useState('ALL')
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data: groups } = useLibraryGroups()
  const { data, isLoading, isError, refetch } = useLibraryItems({
    tuKhoa: tuKhoaTre || undefined,
    nhom: nhom === 'ALL' ? undefined : nhom,
  })
  const taiVe = useDownloadLibraryItem()

  React.useEffect(() => {
    const q = tuKhoaTre.trim()
    setSearchParams(q ? { q } : {}, { replace: true })
  }, [tuKhoaTre, setSearchParams])

  return (
    <div className="container space-y-6 py-6">
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Biểu mẫu & tài liệu' }]}
        tieuDe="Thư viện biểu mẫu và tài liệu"
        moTa="Tra cứu, tải biểu mẫu, quy trình giải quyết thủ tục và các văn bản hành chính của Trường Đại học Thái Bình."
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
              placeholder="Tìm biểu mẫu theo tên hoặc mô tả…"
              aria-label="Tìm biểu mẫu"
              className="pl-8"
            />
          </div>
          <Select value={nhom} onValueChange={setNhom}>
            <SelectTrigger aria-label="Lọc theo nhóm biểu mẫu">
              <SelectValue placeholder="Nhóm biểu mẫu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả nhóm</SelectItem>
              {(groups ?? []).map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onThuLai={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          tieuDe="Không tìm thấy biểu mẫu"
          moTa="Không có biểu mẫu nào khớp với từ khoá hoặc nhóm đã chọn."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            Tìm thấy <span className="font-semibold text-foreground">{data.length}</span> tài liệu
            {nhom !== 'ALL' ? ` trong nhóm “${nhom}”` : ''}.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <Card key={item.id} className="flex h-full flex-col">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-lg',
                        LOAI_TONE[item.loaiTep],
                      )}
                    >
                      <LibraryIcon loaiTep={item.loaiTep} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-brand-heading">{item.ten}</p>
                      <Badge variant="secondary" className="mt-1 font-normal">
                        {item.nhom}
                      </Badge>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.moTa}</p>

                  <div className="mt-auto space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      {LOAI_LABEL[item.loaiTep]} · {item.kichThuoc} · cập nhật{' '}
                      {formatDate(item.capNhatLuc)} · {item.luotTai} lượt tải
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => taiVe.mutate(item.id)}
                      disabled={taiVe.isPending}
                      aria-label={`Tải tài liệu ${item.ten}`}
                    >
                      <Download className="size-4" />
                      Tải tài liệu
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
