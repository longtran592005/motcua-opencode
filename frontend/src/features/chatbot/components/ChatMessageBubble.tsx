import * as React from 'react'
import {
  Bot,
  Check,
  Copy,
  BookOpen,
  FileText,
  SearchCheck,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '../hooks/useChat'
import { ChatActionCards } from './ChatActionCards'

interface ChatMessageBubbleProps {
  message: ChatMessage
  onDanhGia: (id: string, huuIch: boolean) => void
  onTaoBanNhap?: (actionId: string) => Promise<{ maHoSo: string; duongDan: string } | null>
  onGuiCanBo?: () => void
}

/** Một bong bóng hội thoại: câu hỏi của người dùng hoặc trả lời của trợ lý ảo. */
export function ChatMessageBubble({ message, onDanhGia, onTaoBanNhap, onGuiCanBo }: ChatMessageBubbleProps) {
  const laNguoi = message.vaiTro === 'nguoi'
  const [copied, setCopied] = React.useState(false)

  async function handleCopy() {
    if (!message.noiDung) return
    try {
      await navigator.clipboard.writeText(message.noiDung)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore clipboard error */
    }
  }

  return (
    <div className={cn('flex w-full min-w-0 gap-2 items-start', laNguoi ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <span
        className={cn(
          'flex size-7.5 shrink-0 items-center justify-center rounded-xl shadow-2xs text-xs font-semibold mt-0.5',
          laNguoi
            ? 'bg-secondary text-secondary-foreground border border-border/60'
            : 'bg-gradient-to-tr from-primary to-brand-light text-primary-foreground',
        )}
        aria-hidden="true"
      >
        {laNguoi ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>

      {/* Message content & attachments */}
      <div className={cn('flex-1 min-w-0 space-y-2', laNguoi ? 'flex flex-col items-end text-right' : 'text-left')}>
        {/* Main Text Bubble */}
        <div
          className={cn(
            'px-3.5 py-2 text-sm leading-relaxed shadow-2xs break-words max-w-[92%]',
            laNguoi
              ? 'rounded-2xl rounded-tr-xs bg-primary text-primary-foreground text-left'
              : 'rounded-2xl rounded-tl-xs bg-card border border-border/80 text-foreground w-full',
            message.loi && !laNguoi && 'border-destructive/40 bg-destructive-soft text-destructive',
          )}
        >
          {message.dangChay && !message.noiDung ? (
            <div className="flex items-center gap-1.5 py-1 text-muted-foreground" aria-label="Trợ lý ảo đang trả lời">
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              <span className="ml-1 text-xs">Đang tìm câu trả lời…</span>
            </div>
          ) : (
            <p className="whitespace-pre-line break-words">{message.noiDung}</p>
          )}
          {message.dangChay && message.noiDung && (
            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary align-middle rounded-full" />
          )}
        </div>

        {/* Chế độ tra cứu nhanh */}
        {message.traCuuNhanh && !laNguoi && (
          <div className="pt-0.5">
            <Badge variant="outline" className="gap-1 bg-muted/60 text-[10px] text-muted-foreground border-border/80 font-normal">
              <SearchCheck className="size-3 text-primary" aria-hidden="true" /> Chế độ tra cứu tài liệu
            </Badge>
          </div>
        )}

        {/* Thẻ hành động đính kèm (Biểu mẫu, nộp hồ sơ, bản nháp) */}
        {message.hanhDong && message.hanhDong.length > 0 && (
          <ChatActionCards hanhDong={message.hanhDong} onTaoBanNhap={onTaoBanNhap} onGuiCanBo={onGuiCanBo} />
        )}

        {/* Nguồn tham khảo */}
        {message.nguon && message.nguon.length > 0 && (
          <div className="w-full min-w-0 rounded-xl border border-border/70 bg-muted/40 p-2.5 text-left shadow-2xs">
            <div className="mb-2 flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
                <span>Nguồn trích dẫn</span>
              </span>
              <span className="text-[10px] text-muted-foreground">{message.nguon.length} tài liệu</span>
            </div>
            <div className="space-y-1.5">
              {message.nguon.map((nguon, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/90 px-2.5 py-1.5 text-xs border border-border/60"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="font-medium text-foreground truncate text-xs" title={nguon.tenFile}>
                      {nguon.tenFile}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Trang {nguon.trang}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gợi ý form trực tuyến */}
        {message.goiYForm && (
          <Button asChild size="sm" variant="outline" className="h-8 w-full justify-start gap-2 rounded-xl text-xs font-medium border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 min-w-0">
            <Link to={`/don/moi/${message.goiYForm.requestTypeId}`} className="truncate">
              <FileText className="size-3.5 shrink-0" />
              <span className="truncate">Nộp hồ sơ: {message.goiYForm.ten}</span>
            </Link>
          </Button>
        )}

        {/* Footer toolbar: Đánh giá + Sao chép */}
        {!laNguoi && !message.dangChay && !message.loi && (
          <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground w-full">
            <div className="flex items-center gap-1">
              <span>Hữu ích?</span>
              <button
                type="button"
                className={cn(
                  'flex size-6 items-center justify-center rounded-md hover:bg-muted transition-colors',
                  message.danhGia === 'HUU_ICH' ? 'text-success font-bold bg-success/10' : 'hover:text-foreground',
                )}
                onClick={() => onDanhGia(message.id, true)}
                title="Câu trả lời hữu ích"
                aria-label="Hữu ích"
              >
                <ThumbsUp className="size-3" />
              </button>
              <button
                type="button"
                className={cn(
                  'flex size-6 items-center justify-center rounded-md hover:bg-muted transition-colors',
                  message.danhGia === 'KHONG_HUU_ICH' ? 'text-destructive font-bold bg-destructive/10' : 'hover:text-foreground',
                )}
                onClick={() => onDanhGia(message.id, false)}
                title="Chưa hữu ích"
                aria-label="Không hữu ích"
              >
                <ThumbsDown className="size-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Sao chép nội dung"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-success" />
                  <span className="text-[10px] text-success">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span className="text-[10px]">Sao chép</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
