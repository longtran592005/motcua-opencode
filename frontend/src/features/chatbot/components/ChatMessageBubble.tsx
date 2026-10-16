import { Bot, FileText, ThumbsDown, ThumbsUp, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '../hooks/useChat'

interface ChatMessageBubbleProps {
  message: ChatMessage
  onDanhGia: (id: string, huuIch: boolean) => void
}

/** Một bong bóng hội thoại: câu hỏi của người dùng hoặc trả lời của trợ lý ảo. */
export function ChatMessageBubble({ message, onDanhGia }: ChatMessageBubbleProps) {
  const laNguoi = message.vaiTro === 'nguoi'

  return (
    <div className={cn('flex gap-2', laNguoi && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          laNguoi ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground',
        )}
        aria-hidden="true"
      >
        {laNguoi ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>

      <div className={cn('max-w-[85%] space-y-2', laNguoi && 'items-end text-right')}>
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            laNguoi
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm bg-secondary text-secondary-foreground',
            message.loi && !laNguoi && 'bg-destructive-soft text-destructive',
          )}
        >
          {message.dangChay && !message.noiDung ? (
            <span className="flex items-center gap-1 py-0.5" aria-label="Trợ lý ảo đang trả lời">
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
            </span>
          ) : (
            <p className="whitespace-pre-line">{message.noiDung}</p>
          )}
          {message.dangChay && message.noiDung && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle" />
          )}
        </div>

        {message.nguon && message.nguon.length > 0 && (
          <div className="rounded-lg border bg-card p-2 text-left">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Nguồn tham khảo
            </p>
            <ul className="space-y-1">
              {message.nguon.map((nguon, index) => (
                <li key={index} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-medium text-foreground">{nguon.tenFile}</span> · trang{' '}
                    {nguon.trang}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {message.goiYForm && (
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Link to={`/don/moi/${message.goiYForm.requestTypeId}`}>
              <FileText className="size-3.5" />
              Mở đơn: {message.goiYForm.ten}
            </Link>
          </Button>
        )}

        {!laNguoi && !message.dangChay && !message.loi && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Câu trả lời hữu ích?</span>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-6', message.danhGia === 'HUU_ICH' && 'text-success')}
              onClick={() => onDanhGia(message.id, true)}
              aria-label="Hữu ích"
            >
              <ThumbsUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-6', message.danhGia === 'KHONG_HUU_ICH' && 'text-destructive')}
              onClick={() => onDanhGia(message.id, false)}
              aria-label="Không hữu ích"
            >
              <ThumbsDown className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
