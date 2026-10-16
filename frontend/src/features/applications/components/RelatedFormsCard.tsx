import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDownloadLibraryItem, useLibraryItems } from '@/features/library/hooks/useLibrary'

interface RelatedFormsCardProps {
  /** Loại đơn đang nộp, dùng để lọc biểu mẫu có `batBuocVoiLoaiDon` tương ứng. */
  requestTypeId: string
}

/**
 * Thẻ "Biểu mẫu liên quan": liệt kê các biểu mẫu trong thư viện tài liệu Một cửa
 * gắn với loại đơn đang nộp để người dùng tải, in và ký trước khi đính kèm.
 */
export function RelatedFormsCard({ requestTypeId }: RelatedFormsCardProps) {
  const { data, isLoading } = useLibraryItems({})
  const taiVe = useDownloadLibraryItem()

  const items = (data ?? []).filter((item) => item.batBuocVoiLoaiDon?.includes(requestTypeId))

  if (isLoading || items.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Biểu mẫu liên quan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Tải biểu mẫu của nhà trường, in và ký trước khi đính kèm vào hồ sơ bên trên.
        </p>
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.ten}</p>
                <p className="text-xs text-muted-foreground">
                  {item.loaiTep.toUpperCase()} · {item.kichThuoc}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => taiVe.mutate(item.id)}
              disabled={taiVe.isPending}
              aria-label={`Tải biểu mẫu ${item.ten}`}
            >
              {taiVe.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Tải
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
