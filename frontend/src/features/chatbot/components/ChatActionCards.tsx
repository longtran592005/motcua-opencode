import * as React from 'react'
import { Download, ExternalLink, FileText, Forward } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ChatAction } from '@/services/contracts/system'

interface ChatActionCardsProps {
  hanhDong: ChatAction[]
  onTaoBanNhap?: (actionId: string) => Promise<{ maHoSo: string; duongDan: string } | null>
  onGuiCanBo?: () => void
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
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-left">
      <p className="text-xs font-bold">Đề xuất bản nháp: {action.tenLoaiDon ?? action.ten}</p>
      {truongDaDien.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {truongDaDien.map((f) => (
            <li key={f.ten}>
              <span className="font-medium text-foreground">{f.nhan}</span>: {f.giaTriGoiY}
            </li>
          ))}
        </ul>
      )}
      {(action.canhBao ?? []).map((w) => (
        <p key={w} className="mt-1 text-[11px] text-destructive">
          {w}
        </p>
      ))}
      {daTao ? (
        <Button asChild size="sm" variant="outline" className="mt-2 h-7 gap-1.5 text-xs">
          <Link to={`/don/${daTao.maHoSo}`}>
            <FileText className="size-3.5" /> Mở bản nháp {daTao.maHoSo}
          </Link>
        </Button>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" className="h-7 text-xs" disabled={dangTao} onClick={() => void handleTao()}>
            {dangTao ? 'Đang tạo…' : 'Tạo bản nháp'}
          </Button>
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Bản nháp chưa được nộp — bạn cần kiểm tra thông tin và tự nộp.
      </p>
    </div>
  )
}

/** Các thẻ hành động do server dựng trong câu trả lời của trợ lý ảo. */
export function ChatActionCards({ hanhDong, onTaoBanNhap, onGuiCanBo }: ChatActionCardsProps) {
  if (!hanhDong.length) return null
  const draftActions = hanhDong.filter((a) => a.kieu === 'DRAFT_PROPOSAL')
  const linkActions = hanhDong.filter((a) => a.kieu === 'OPEN_FORM' || a.kieu === 'DOWNLOAD_FORM' || a.kieu === 'OPEN_APPLICATION')
  const coGoiCanBo = hanhDong.some((a) => a.kieu === 'OFFER_HANDOFF')

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hành động đề xuất">
      {linkActions.map((a) =>
        a.kieu === 'OPEN_APPLICATION' && a.maHoSo ? (
          <Button key={a.id} asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Link to={`/don/${a.maHoSo}`}>
              <ExternalLink className="size-3.5" /> Xem đơn {a.maHoSo}
            </Link>
          </Button>
        ) : a.kieu === 'DOWNLOAD_FORM' && a.duongDan ? (
          <Button key={a.id} asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <a href={a.duongDan} target="_blank" rel="noreferrer">
              <Download className="size-3.5" /> Tải biểu mẫu: {a.ten}
            </a>
          </Button>
        ) : a.duongDan ? (
          <Button key={a.id} asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <a href={a.duongDan}>
              <FileText className="size-3.5" /> Nộp trực tuyến: {a.ten}
            </a>
          </Button>
        ) : null,
      )}

      {draftActions.map((a) => (
        <DraftActionCard key={a.id} action={a} onTaoBanNhap={onTaoBanNhap} />
      ))}

      {coGoiCanBo && onGuiCanBo && (
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-destructive" onClick={onGuiCanBo}>
          <Forward className="size-3.5" /> Gửi câu hỏi cho cán bộ
        </Button>
      )}
    </div>
  )
}
