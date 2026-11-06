import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Bot,
  Clock,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  X,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChatMessageBubble } from './ChatMessageBubble'
import { useChat } from '../hooks/useChat'

/** Nút trợ lý ảo nổi ở góc phải dưới, mở khung hỏi đáp thủ tục hành chính. */
export function ChatbotWidget() {
  const [open, setOpen] = React.useState(false)
  const [cauHoi, setCauHoi] = React.useState('')
  const { messages, gui, dangGui, suggestions, danhGia, lamMoi, taoBanNhap, guiCanBo, daGuiCauHoi } = useChat()
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, open])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!cauHoi.trim() || dangGui) return
    void gui(cauHoi)
    setCauHoi('')
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex h-[min(34rem,calc(100vh-4rem))] max-h-[540px] w-[min(26rem,calc(100vw-1.5rem))] sm:w-[410px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl"
            role="dialog"
            aria-label="Trợ lý ảo hỏi đáp thủ tục Một cửa"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 bg-gradient-to-r from-primary via-primary/95 to-brand-dark px-3.5 py-3 text-primary-foreground shadow-xs shrink-0">
              <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs shadow-2xs">
                <Bot className="size-5" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 flex size-2 items-center justify-center">
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400 border border-white" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs sm:text-sm font-bold tracking-tight truncate">Trợ lý ảo Một cửa</h2>
                  <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-white shrink-0">
                    AI
                  </span>
                </div>
                <p className="truncate text-[11px] text-white/80">Hỏi đáp & biểu mẫu trực tuyến TBU</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7.5 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                    onClick={lamMoi}
                    title="Bắt đầu hội thoại mới"
                    aria-label="Bắt đầu cuộc trò chuyện mới"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7.5 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors"
                  onClick={() => setOpen(false)}
                  title="Đóng trợ lý ảo"
                  aria-label="Đóng trợ lý ảo"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable Chat Area (Không dùng Radix display:table để tránh lỗi tràn ngang) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-3.5 bg-surface/30">
              {messages.length === 0 ? (
                <div className="space-y-3 pt-1">
                  {/* Welcome Card */}
                  <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-primary font-semibold text-xs">
                      <Sparkles className="size-3.5 shrink-0" />
                      <span>Xin chào bạn! 👋</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Tôi là Trợ lý ảo Bộ phận Một cửa. Tôi có thể giải đáp thủ tục hành chính,
                      hướng dẫn chuẩn bị hồ sơ và hỗ trợ tải hoặc nộp biểu mẫu.
                    </p>
                  </div>

                  {/* Suggestions Section */}
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <HelpCircle className="size-3 text-primary shrink-0" />
                        <span>Gợi ý câu hỏi</span>
                      </p>
                      <div className="space-y-1.5">
                        {suggestions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => void gui(item)}
                            className="group flex w-full min-w-0 items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2 text-left text-xs text-foreground shadow-2xs transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary active:scale-[0.99]"
                          >
                            <span className="truncate pr-1">{item}</span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessageBubble
                      key={message.id}
                      message={message}
                      onDanhGia={danhGia}
                      onTaoBanNhap={taoBanNhap}
                      onGuiCanBo={() => void guiCanBo()?.then(() => undefined)}
                    />
                  ))}

                  {/* Pending Tickets sent to staff */}
                  {daGuiCauHoi.length > 0 && (
                    <div className="w-full min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs shadow-2xs">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 text-xs">
                          <Clock className="size-3.5 shrink-0" />
                          <span>Yêu cầu đang chờ cán bộ phản hồi</span>
                        </span>
                        <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          {daGuiCauHoi.length}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {daGuiCauHoi.slice(0, 3).map((item) => (
                          <div
                            key={item.ma}
                            className="rounded-lg bg-background/90 p-2 border border-amber-500/20"
                          >
                            <span className="font-mono font-bold text-primary text-[11px]">{item.ma}</span>
                            <p className="mt-0.5 text-foreground line-clamp-2 text-xs">{item.cauHoi}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Bell className="size-3 text-primary shrink-0" />
                        <span className="truncate">Cán bộ sẽ phản hồi qua chuông thông báo.</span>
                      </p>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input & Footer Container */}
            <div className="border-t border-border/80 bg-background p-2.5 sm:p-3 shrink-0">
              <form onSubmit={handleSubmit} className="relative flex w-full min-w-0 items-center">
                <Input
                  value={cauHoi}
                  onChange={(e) => setCauHoi(e.target.value)}
                  placeholder="Hỏi về thủ tục, biểu mẫu, học phí…"
                  aria-label="Nhập câu hỏi cho trợ lý ảo"
                  disabled={dangGui}
                  className="h-9.5 w-full rounded-xl border-input/80 bg-muted/40 pr-10 text-xs transition-all placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-primary/20"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={dangGui || !cauHoi.trim()}
                  aria-label="Gửi câu hỏi"
                  className="absolute right-1 size-7.5 rounded-lg shadow-2xs transition-transform active:scale-95"
                >
                  <Send className="size-3.5" />
                </Button>
              </form>
              <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
                Trợ lý AI Một cửa • Đối chiếu quy định chính thức của TBU
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) - Chỉ hiện khi widget đóng để không bị thừa nút hoặc đè giao diện */}
      {!open && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 size-13 rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="Mở trợ lý ảo"
        >
          <MessageSquare className="size-5.5" />
        </Button>
      )}
    </>
  )
}
