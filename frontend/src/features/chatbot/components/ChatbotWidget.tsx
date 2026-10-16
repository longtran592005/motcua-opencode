import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, MessageSquare, RotateCcw, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatMessageBubble } from './ChatMessageBubble'
import { useChat } from '../hooks/useChat'

/** Nút trợ lý ảo nổi ở góc phải dưới, mở khung hỏi đáp thủ tục hành chính. */
export function ChatbotWidget() {
  const [open, setOpen] = React.useState(false)
  const [cauHoi, setCauHoi] = React.useState('')
  const { messages, gui, dangGui, suggestions, danhGia, lamMoi } = useChat()
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    void gui(cauHoi)
    setCauHoi('')
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-4 z-50 flex h-[32rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl sm:right-6"
            role="dialog"
            aria-label="Trợ lý ảo hỏi đáp thủ tục"
          >
            <div className="flex items-center gap-3 bg-brand-heading px-4 py-3 text-white">
              <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Trợ lý ảo Một cửa</p>
                <p className="truncate text-xs text-white/70">Hỏi đáp về thủ tục hành chính</p>
              </div>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={lamMoi}
                  aria-label="Bắt đầu cuộc trò chuyện mới"
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-white/80 hover:bg-white/15 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="Đóng trợ lý ảo"
              >
                <X className="size-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 bg-surface">
              <div className="space-y-4 p-4">
                {messages.length === 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border bg-card p-3">
                      <p className="text-sm font-semibold">Xin chào!</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tôi có thể giúp bạn tìm hiểu về thủ tục, hồ sơ cần chuẩn bị và thời gian xử
                        lý. Hãy chọn một câu hỏi gợi ý hoặc nhập câu hỏi của bạn.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => void gui(item)}
                          className="rounded-full border bg-background px-3 py-1.5 text-left text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <ChatMessageBubble key={message.id} message={message} onDanhGia={danhGia} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t bg-background p-3">
              <Input
                value={cauHoi}
                onChange={(e) => setCauHoi(e.target.value)}
                placeholder="Nhập câu hỏi của bạn…"
                aria-label="Nhập câu hỏi cho trợ lý ảo"
                disabled={dangGui}
              />
              <Button
                type="submit"
                size="icon"
                disabled={dangGui || !cauHoi.trim()}
                aria-label="Gửi câu hỏi"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 z-50 size-14 rounded-full shadow-lg sm:right-6"
        aria-label={open ? 'Đóng trợ lý ảo' : 'Mở trợ lý ảo'}
      >
        {open ? <X className="size-6" /> : <MessageSquare className="size-6" />}
      </Button>
    </>
  )
}
