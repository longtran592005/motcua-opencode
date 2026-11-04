import { Activity, Boxes, MessageSquareText, Send, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useChatStats, type ChatStats } from '../hooks/useAdminChat'
import { formatDateTime } from '@/lib/formatters'

const thongKeCard = (tieuDe: string, giaTri: string, icon: ReactNode, moTa: string) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tieuDe}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{giaTri}</p>
          <p className="text-xs text-muted-foreground">{moTa}</p>
        </div>
        {icon}
      </div>
    </CardContent>
  </Card>
)

const topDocColumns: Column<{ ten: string; soDuocTrich: number }>[] = [
  { key: 'ten', header: 'Tài liệu', cell: (row) => <span className="text-sm">{row.ten}</span> },
  {
    key: 'so',
    header: 'Số lần được trích',
    className: 'text-right',
    cell: (row) => <Badge variant="secondary">{row.soDuocTrich}</Badge>,
  },
]

// Bảng câu hỏi chưa trả lời được — kiểu dòng nội bộ.
/** Trang cán bộ: thống kê hoạt động trợ lý AI (PHONG_DAO_TAO, ADMIN). */
export function ChatbotStatsPage() {
  const { data, isLoading, isError, refetch } = useChatStats()
  const stats: ChatStats | undefined = data

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Thống kê chatbot"
        moTa="Sóng hoạt động của trợ lý AI trong 7 ngày gần nhất: tỷ lệ có nguồn, câu chưa trả lời được, đánh giá."
      />

      {isError && (
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <span className="text-sm text-destructive">Không tải được thống kê.</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {thongKeCard('Câu hỏi trong tuần', String(stats.hoiTrongTuan), <Activity className="size-5 text-primary" />, 'Tổng lượt hỏi')}
            {thongKeCard('Có nguồn', `${Math.round(stats.tyLeCoNguon * 100)}%`, <MessageSquareText className="size-5 text-primary" />, 'Câu trả lời dẫn tài liệu')}
            {thongKeCard('Không tìm thấy', `${Math.round(stats.tyLeKhongTimThay * 100)}%`, <Sparkles className="size-5 text-warning" />, 'Chưa có căn cứ trả lời')}
            {thongKeCard(
              'Chuyển cán bộ',
              `${stats.handoffDaTraLoi}/${stats.handoffSo}`,
              <Send className="size-5 text-primary" />,
              'Đã trả lời / tổng câu gửi',
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {thongKeCard('Hữu ích', String(stats.huuIch), <ThumbsUp className="size-5 text-success" />, 'Đánh giá của sinh viên')}
            {thongKeCard('Không hữu ích', String(stats.khongHuuIch), <ThumbsDown className="size-5 text-destructive" />, 'Đánh giá của sinh viên')}
          </div>

          <Card>
            <CardContent className="grid gap-4 md:grid-cols-1">
              <p className="text-sm font-bold">Chưa trả lời được (7 ngày gần nhất)</p>
              <div className="space-y-1.5">
                {stats.khongTimThayGanNhat.length === 0 && (
                  <p className="text-sm text-muted-foreground">Chưa có câu hỏi nào chưa trả lời được.</p>
                )}
                {stats.khongTimThayGanNhat.slice(0, 10).map((row) => (
                  <div key={row.id} className="flex items-baseline justify-between gap-4 rounded-md border p-2">
                    <span className="min-w-0 truncate text-sm">{row.cauHoi}</span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.lucHoi)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Boxes className="size-4 text-primary" aria-hidden="true" /> 10 tài liệu được trích nhiều nhất
              </p>
              <DataTable
                columns={topDocColumns}
                rows={stats.topDocs}
                getRowId={(row) => row.ten}
                dangTai={false}
                loi={false}
                onThuLai={() => undefined}
                thongDiepRong="Chưa có tài liệu nào được trích dẫn"
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
