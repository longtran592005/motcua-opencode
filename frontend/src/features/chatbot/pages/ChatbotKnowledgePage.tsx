import * as React from 'react'
import { BookOpen, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FileUpload } from '@/components/common/FileUpload'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useDeleteKnowledge,
  useKnowledge,
  usePatchKnowledge,
  useReindex,
  useUpsertKnowledge,
  type KnowledgeRow,
} from '../hooks/useAdminChat'
import { formatDateTime } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Attachment } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: 'Đang xử lý',
  READY: 'Sẵn sàng',
  FAILED: 'Lỗi',
  DISABLED: 'Đã tắt',
}

const SOURCE_LABELS: Record<string, string> = {
  LIBRARY: 'Thư viện',
  UPLOAD: 'Tải lên',
  FAQ: 'FAQ',
}

/** Đọc tệp thành base64 (không tiền tố data:). */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result)
    }
    reader.onerror = () => reject(new Error('Không đọc được tệp'))
    reader.readAsDataURL(file)
  })
}

/** Trang cán bộ: quản trị kiến thức truy xuất của trợ lý AI (PHONG_DAO_TAO, ADMIN). */
export function ChatbotKnowledgePage() {
  const { data, isLoading, isError, refetch } = useKnowledge()
  const upsert = useUpsertKnowledge()
  const patch = usePatchKnowledge()
  const del = useDeleteKnowledge()
  const reindex = useReindex()

  const [faqOpen, setFaqOpen] = React.useState(false)
  const [tieuDe, setTieuDe] = React.useState('')
  const [noiDung, setNoiDung] = React.useState('')
  const [tepDinhKem, setTepDinhKem] = React.useState<Attachment[]>([])
  const [xoaMuc, setXoaMuc] = React.useState<KnowledgeRow | null>(null)

  const handleFiles = React.useCallback(
    (files: File[]) => {
      if (!files.length) return
      const file = files[0]
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      const mimeMap: Record<string, string> = { pdf: 'pdf', docx: 'docx', txt: 'txt', md: 'md' }
      if (!mimeMap[ext]) {
        toast.error('Chỉ hỗ trợ pdf, docx, txt, md (tối đa 10MB)')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Tệp tối đa 10MB')
        return
      }
      void readFileAsBase64(file).then((base64) => {
        upsert.mutate({ kieu: 'FILE', ten: file.name, mime: mimeMap[ext], noiDung: base64 })
      })
      setTepDinhKem([])
    },
    [upsert],
  )

  function submitFaq() {
    if (!tieuDe.trim() || !noiDung.trim()) return
    upsert.mutate(
      { kieu: 'FAQ', tieuDe: tieuDe.trim(), noiDung: noiDung.trim() },
      { onSuccess: () => {
        setFaqOpen(false)
        setTieuDe('')
        setNoiDung('')
      } },
    )
  }

  const columns: Column<KnowledgeRow>[] = [
    {
      key: 'ma',
      header: 'Mã',
      hideOnMobile: true,
      cell: (row) => <span className="font-mono text-[11px] text-muted-foreground">{row.ma}</span>,
    },
    {
      key: 'title',
      header: 'Tài liệu',
      cell: (row) => {
        const failure = row.status === 'FAILED' ? row.errorMessage : null
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.title}</p>
            {failure && <p className="truncate text-xs text-destructive">{failure}</p>}
          </div>
        )
      },
    },
    {
      key: 'sourceType',
      header: 'Nguồn',
      cell: (row) => <Badge variant="outline">{SOURCE_LABELS[row.sourceType] ?? row.sourceType}</Badge>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (row) => (
        <Badge
          variant={
            row.status === 'READY'
              ? 'default'
              : row.status === 'PROCESSING'
                ? 'secondary'
                : row.status === 'DISABLED'
                  ? 'outline'
                  : 'destructive'
          }
        >
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'chunks',
      header: 'Số đoạn',
      hideOnMobile: true,
      cell: (row) => <span className="text-xs text-muted-foreground">{row._count?.chunks ?? '—'}</span>,
    },
    {
      key: 'capNhat',
      header: 'Cập nhật',
      hideOnMobile: true,
      cell: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => patch.mutate({ ma: row.ma, batHieuLuc: row.status !== 'DISABLED' })}
            title={row.status === 'DISABLED' ? 'Bật lại' : 'Tắt (không còn truy xuất)'}
          >
            {row.status === 'DISABLED' ? 'Bật' : 'Tắt'}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setXoaMuc(row)} aria-label={`Xóa ${row.title}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Kiến thức chatbot"
        moTa="Tài liệu và FAQ mà trợ lý AI dùng để trả lời. Tải lên pdf/docx/txt/md (≤ 10MB) hoặc gõ câu hỏi – câu trả lời để làm FAQ."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-56">
            <FileUpload
              accept=".pdf,.docx,.txt,.md"
              maxSizeMb={10}
              moTa="Tải tài liệu pdf, docx, txt, md (tối đa 10MB) cho trợ lý AI"
              value={tepDinhKem}
              onChange={setTepDinhKem}
              onFilesNguyenBan={handleFiles}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFaqOpen(true)}>
            <BookOpen className="size-4" /> Thêm FAQ
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={reindex.isPending}
            onClick={() => reindex.mutate()}
          >
            <RefreshCw className="size-4" /> {reindex.isPending ? 'Đang lập lại…' : 'Lập lại chỉ mục'}
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong="Chưa có tài liệu kiến thức"
        moTaRong="Tải tài liệu hoặc thêm FAQ để trợ lý AI trả lời dựa trên tài liệu của trường."
      />

      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm mục FAQ</DialogTitle>
            <DialogDescription>
              Câu hỏi + trả lời này được trợ lý dùng luôn cho lần hỏi sau.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="faq-tieu-de">Câu hỏi</Label>
              <Input
                id="faq-tieu-de"
                value={tieuDe}
                onChange={(e) => setTieuDe(e.target.value)}
                placeholder="Ví dụ: Đơn xin hoãn thi nộp ở đâu?"
                maxLength={300}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="faq-noi-dung">Trả lời</Label>
              <Textarea
                id="faq-noi-dung"
                value={noiDung}
                onChange={(e) => setNoiDung(e.target.value)}
                rows={6}
                maxLength={8000}
                placeholder="Nhập câu trả lời chính thức…"
              />
            </div>
            <Button size="sm" onClick={submitFaq} disabled={!tieuDe.trim() || !noiDung.trim() || upsert.isPending}>
              {upsert.isPending ? 'Đang lưu…' : 'Lưu FAQ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaMuc !== null}
        onOpenChange={(open) => !open && setXoaMuc(null)}
        tieuDe={`Xóa tài liệu "${xoaMuc?.title ?? ''}"?`}
        moTa="Tài liệu sẽ được xóa mềm khỏi kiến thức truy xuất của trợ lý AI."
        bienThe="destructive"
        nhanXacNhan="Xóa"
        dangXuLy={del.isPending}
        onXacNhan={() => {
          if (xoaMuc) del.mutate(xoaMuc.ma)
          setXoaMuc(null)
        }}
      />
    </div>
  )
}
