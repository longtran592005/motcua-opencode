import * as React from 'react'
import {
  ArrowUpRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Forward,
  Sparkles,
  FileCheck2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ChatAction } from '@/services/contracts/system'

interface ChatActionCardsProps {
  hanhDong: ChatAction[]
  onTaoBanNhap?: (actionId: string) => Promise<{ maHoSo: string; duongDan: string } | null>
  onGuiCanBo?: () => void
}

function getFileType(duongDan?: string, ten?: string): { ext: string; isSheet: boolean } {
  const target = (duongDan || ten || '').toLowerCase()
  if (target.endsWith('.docx')) return { ext: 'DOCX', isSheet: false }
  if (target.endsWith('.doc')) return { ext: 'DOC', isSheet: false }
  if (target.endsWith('.xls') || target.endsWith('.xlsx')) return { ext: 'XLS', isSheet: true }
  if (target.endsWith('.pdf')) return { ext: 'PDF', isSheet: false }
  return { ext: 'FILE', isSheet: false }
}

function DraftActionCard({
  action,
  onTaoBanNhap,
}: {
  action: ChatAction
  onTaoBanNhap?: (actionId: string) => Promise<{ maHoSo: string; duongDan: string } | null>
}) {
  const [dangTao, setDangTao] = React.useState(false)
  const [daTao, setDaTao] = React.useState<{ maHoSo: string } | null>(null)

  async function handleTao() {
    if (!onTaoBanNhap || dangTao) return
    setDangTao(true)
    const r = await onTaoBanNhap(action.id)
    setDangTao(false)
    if (r) {
      setDaTao({ maHoSo: r.maHoSo })
      toast.success(`Đã tạo bản nháp ${r.maHoSo} — hãy kiểm tra và nộp trong "Đơn của tôi"`)
    } else {
      toast.error('Không tạo được bản nháp. Hành động có thể đã hết hạn.')
    }
  }

  const truongDaDien = (action.cacTruong ?? []).filter((f) => f.giaTriGoiY)

  return (
    <div className="w-full min-w-0 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-3 text-left shadow-2xs">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="size-3.5 shrink-0" />
        <span>Gợi ý tạo hồ sơ trực tuyến</span>
      </div>
      <p className="mt-1 text-xs font-bold text-foreground truncate">
        {action.tenLoaiDon ?? action.ten}
      </p>

      {truongDaDien.length > 0 && (
        <div className="mt-2 rounded-lg bg-background/80 p-2 text-xs border border-border/50">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Thông tin sẽ điền sẵn:
          </p>
          <div className="space-y-1">
            {truongDaDien.map((f) => (
              <div key={f.ten} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground shrink-0">{f.nhan}:</span>
                <span className="font-medium text-foreground text-right truncate">{f.giaTriGoiY}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(action.canhBao ?? []).map((w) => (
        <p key={w} className="mt-1.5 text-[11px] text-destructive flex items-center gap-1">
          <span>•</span> {w}
        </p>
      ))}

      <div className="mt-2.5">
        {daTao ? (
          <Button asChild size="sm" variant="default" className="h-8 w-full gap-1.5 text-xs font-medium shadow-2xs">
            <Link to={`/don/${daTao.maHoSo}`}>
              <FileCheck2 className="size-3.5" /> Mở bản nháp ({daTao.maHoSo})
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-full gap-1.5 text-xs font-medium shadow-2xs"
            disabled={dangTao}
            onClick={() => void handleTao()}
          >
            <Sparkles className="size-3.5" />
            {dangTao ? 'Đang khởi tạo bản nháp…' : 'Tạo bản nháp từ gợi ý này'}
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Hệ thống chỉ tạo nháp — bạn cần kiểm tra lại trước khi nộp chính thức.
      </p>
    </div>
  )
}

/** Các thẻ hành động do server dựng trong câu trả lời của trợ lý ảo. */
export function ChatActionCards({ hanhDong, onTaoBanNhap, onGuiCanBo }: ChatActionCardsProps) {
  if (!hanhDong.length) return null
  const draftActions = hanhDong.filter((a) => a.kieu === 'DRAFT_PROPOSAL')
  const downloadActions = hanhDong.filter((a) => a.kieu === 'DOWNLOAD_FORM' && a.duongDan)
  const openFormActions = hanhDong.filter((a) => a.kieu === 'OPEN_FORM' && a.duongDan)
  const openAppActions = hanhDong.filter((a) => a.kieu === 'OPEN_APPLICATION' && a.maHoSo)
  const coGoiCanBo = hanhDong.some((a) => a.kieu === 'OFFER_HANDOFF')

  return (
    <div className="w-full min-w-0 space-y-2 pt-1" role="group" aria-label="Hành động đề xuất">
      {/* 1. Thẻ Tải biểu mẫu */}
      {downloadActions.map((a) => {
        const { ext, isSheet } = getFileType(a.duongDan, a.ten)
        return (
          <div
            key={a.id}
            className="group flex w-full min-w-0 items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs transition-all hover:border-primary/50"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                {isSheet ? <FileSpreadsheet className="size-4" /> : <FileText className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate" title={a.ten}>
                  {a.ten}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-primary/90">{ext}</span>
                  <span>•</span>
                  <span>Biểu mẫu đính kèm</span>
                </div>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7.5 shrink-0 gap-1 rounded-lg px-2.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              <a href={a.duongDan} target="_blank" rel="noreferrer">
                <Download className="size-3.5" />
                <span>Tải về</span>
              </a>
            </Button>
          </div>
        )
      })}

      {/* 2. Thẻ Nộp trực tuyến */}
      {openFormActions.map((a) => (
        <div
          key={a.id}
          className="group flex w-full min-w-0 items-center justify-between gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-2.5 shadow-2xs transition-all hover:border-primary/60 hover:bg-primary/10"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
              <ArrowUpRight className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate" title={a.ten}>
                {a.ten}
              </p>
              <p className="mt-0.5 text-[10px] text-primary font-medium">Nộp hồ sơ trực tuyến</p>
            </div>
          </div>
          <Button asChild size="sm" className="h-7.5 shrink-0 gap-1 rounded-lg px-2.5 text-xs font-medium shadow-2xs">
            <a href={a.duongDan}>
              <span>Nộp ngay</span>
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        </div>
      ))}

      {/* 3. Thẻ Xem hồ sơ đang có */}
      {openAppActions.map((a) => (
        <div
          key={a.id}
          className="flex w-full min-w-0 items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">Hồ sơ {a.maHoSo}</p>
            <p className="text-[11px] text-muted-foreground">Nhấp để xem tiến độ giải quyết</p>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7.5 shrink-0 gap-1 text-xs">
            <Link to={`/don/${a.maHoSo}`}>
              <ExternalLink className="size-3.5" /> Xem
            </Link>
          </Button>
        </div>
      ))}

      {/* 4. Thẻ Đề xuất bản nháp */}
      {draftActions.map((a) => (
        <DraftActionCard key={a.id} action={a} onTaoBanNhap={onTaoBanNhap} />
      ))}

      {/* 5. Gửi câu hỏi cho cán bộ */}
      {coGoiCanBo && onGuiCanBo && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-left flex items-center justify-between gap-2 w-full min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Chưa tìm thấy thông tin bạn cần?</p>
            <p className="text-[10px] text-muted-foreground truncate">Chuyển tiếp câu hỏi tới cán bộ tiếp nhận</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7.5 shrink-0 gap-1 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/30"
            onClick={onGuiCanBo}
          >
            <Forward className="size-3.5" /> Gửi cán bộ
          </Button>
        </div>
      )}
    </div>
  )
}
