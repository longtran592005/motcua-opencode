import * as React from 'react'
import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { useAnswerHandoff, useHandoffToFaq, useHandoffInbox, type HandoffRow } from '../hooks/useAdminChat'
import { formatDateTime } from '@/lib/formatters'

const HANDOFF_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Chờ trả lời',
  ANSWERED: 'Đã trả lời',
  CLOSED: 'Đã đóng',
}

/** Trang cán bộ: xử lý câu hỏi chatbot chuyển lên (PHONG_DAO_TAO, ADMIN). */
export function ChatbotHandoffPage() {
  const [tab, setTab] = React.useState<'OPEN' | 'ANSWERED' | 'CLOSED' | 'ALL'>('OPEN')
  const [viewing, setViewing] = React.useState<HandoffRow | null>(null)
  const [traLoi, setTraLoi] = React.useState('')
  const { data, isLoading, isError, refetch } = useHandoffInbox(tab)
  const answerMutation = useAnswerHandoff()
  const toFaqMutation = useHandoffToFaq()

  function openAnswer(row: HandoffRow) {
    setViewing(row)
    setTraLoi(row.answer ?? '')
  }

  function submitAnswer() {
    if (!viewing || !traLoi.trim()) return
    answerMutation.mutate(
      { ma: viewing.ma, cauTraLoi: traLoi.trim() },
      { onSuccess: () => setViewing(null) },
    )
  }

  const columns: Column<HandoffRow>[] = [
    {
      key: 'ma',
      header: 'Mã',
      cell: (row) => <span className="font-mono text-xs font-medium">{row.ma}</span>,
    },
    {
      key: 'cauHoi',
      header: 'Câu hỏi',
      cell: (row) => <span className="line-clamp-2 text-sm">{row.question}</span>,
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      cell: (row) => (
        <Badge variant={row.status === 'OPEN' ? 'default' : row.status === 'ANSWERED' ? 'secondary' : 'outline'}>
          {HANDOFF_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'luc',
      header: 'Thời gian',
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'hanhDong',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => openAnswer(row)}>
          {row.status === 'OPEN' ? 'Trả lời' : 'Xem'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Câu hỏi chatbot chuyển lên"
        moTa="Trả lời câu hỏi chưa xử lý được của trợ lý AI; câu hay có thể thêm vào FAQ để trợ lý tự trả lời lần sau."
      />

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          {(['OPEN', 'ANSWERED', 'CLOSED', 'ALL'] as const).map((t) => (
            <Button
              key={t}
              variant={tab === t ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setTab(t)}
            >
              {t === 'ALL' ? 'Tất cả' : HANDOFF_STATUS_LABELS[t]}
            </Button>
          ))}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong="Không có câu hỏi nào"
        moTaRong="Câu hỏi học sinh gửi từ trợ lý AI sẽ xuất hiện tại đây."
      />

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Inbox className="size-4 text-primary" aria-hidden="true" />
                  {viewing.ma}
                </DialogTitle>
                <DialogDescription>{formatDateTime(viewing.createdAt)}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Câu hỏi</p>
                  <p className="text-sm">{viewing.question}</p>
                </div>
                {viewing.context && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Ngữ cảnh hội thoại</p>
                    <p className="whitespace-pre-line text-xs text-muted-foreground">{viewing.context}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground" htmlFor="cauTraLoi">
                    Câu trả lời
                  </label>
                  <Textarea
                    id="cauTraLoi"
                    value={traLoi}
                    onChange={(e) => setTraLoi(e.target.value)}
                    rows={6}
                    placeholder="Nhập câu trả lời chính thức của Phòng Đào tạo… (tối đa 5000 ký tự)"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={submitAnswer} disabled={!traLoi.trim() || answerMutation.isPending}>
                    {answerMutation.isPending ? 'Đang gửi…' : 'Gửi câu trả lời'}
                  </Button>
                  {viewing.status === 'ANSWERED' && viewing.answer && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toFaqMutation.isPending}
                      onClick={() => toFaqMutation.mutate(viewing.ma)}
                    >
                      Thêm vào FAQ
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** XÁO xẹt cho trang loading (dùng khi cần). */
export function ChatbotHandoffSkeleton() {
  return <Skeleton className="h-64 w-full" />
}

export function EmptyInboxState() {
  return <EmptyState tieuDe="Không có câu hỏi nào" />
}
