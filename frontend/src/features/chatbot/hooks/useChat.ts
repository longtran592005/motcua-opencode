import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'
import type { ChatFormSuggestion, ChatSource } from '@/services/contracts/system'

export interface ChatMessage {
  id: string
  vaiTro: 'nguoi' | 'bot'
  noiDung: string
  nguon?: ChatSource[]
  goiYForm?: ChatFormSuggestion
  dangChay?: boolean
  danhGia?: 'HUU_ICH' | 'KHONG_HUU_ICH'
  loi?: boolean
}

let seq = 0
function newId(): string {
  seq += 1
  return `msg_${Date.now()}_${seq}`
}

interface UseChatResult {
  messages: ChatMessage[]
  gui: (cauHoi: string) => Promise<void>
  dangGui: boolean
  suggestions: string[]
  danhGia: (id: string, huuIch: boolean) => Promise<void>
  lamMoi: () => void
}

/** Quản lý hội thoại với trợ lý ảo, nhận câu trả lời dạng streaming. */
export function useChat(): UseChatResult {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [dangGui, setDangGui] = React.useState(false)

  const { data: suggestions = [] } = useQuery({
    queryKey: ['chat', 'suggestions'],
    queryFn: () => services.chat.cauHoiGoiY(),
    staleTime: Infinity,
  })

  const gui = React.useCallback(
    async (cauHoi: string) => {
      const q = cauHoi.trim()
      if (!q || dangGui) return
      const botId = newId()
      setMessages((prev) => [
        ...prev,
        { id: newId(), vaiTro: 'nguoi', noiDung: q },
        { id: botId, vaiTro: 'bot', noiDung: '', dangChay: true },
      ])
      setDangGui(true)

      try {
        for await (const chunk of services.chat.hoi(q)) {
          if (chunk.loai === 'token') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botId ? { ...msg, noiDung: msg.noiDung + (chunk.noiDung ?? '') } : msg,
              ),
            )
          } else if (chunk.loai === 'nguon') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botId
                  ? { ...msg, nguon: chunk.nguon, goiYForm: chunk.goiYForm }
                  : msg,
              ),
            )
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botId
                  ? {
                      ...msg,
                      dangChay: false,
                      loi: Boolean(chunk.maLoi),
                      noiDung: chunk.traLoiDayDu || msg.noiDung,
                    }
                  : msg,
              ),
            )
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botId
              ? {
                  ...msg,
                  dangChay: false,
                  loi: true,
                  noiDung:
                    msg.noiDung ||
                    'Xin lỗi, trợ lý ảo đang gặp sự cố kết nối. Vui lòng thử lại sau ít phút.',
                }
              : msg,
          ),
        )
      } finally {
        setDangGui(false)
      }
    },
    [dangGui],
  )

  const danhGia = React.useCallback(async (id: string, huuIch: boolean) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, danhGia: huuIch ? 'HUU_ICH' : 'KHONG_HUU_ICH' } : msg,
      ),
    )
    try {
      await services.chat.danhGia(id, huuIch)
    } catch {
      /* đánh giá không thành công cũng không ảnh hưởng hội thoại */
    }
  }, [])

  const lamMoi = React.useCallback(() => setMessages([]), [])

  return { messages, gui, dangGui, suggestions, danhGia, lamMoi }
}
