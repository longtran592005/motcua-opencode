import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { services } from '@/services'
import type { ChatAction, ChatFormSuggestion, ChatSource } from '@/services/contracts/system'

export interface ChatMessage {
  id: string
  /** id tin nhắn trả về từ backend (dùng cho đánh giá). */
  serverId?: string
  vaiTro: 'nguoi' | 'bot'
  noiDung: string
  nguon?: ChatSource[]
  goiYForm?: ChatFormSuggestion
  hanhDong?: ChatAction[]
  dangChay?: boolean
  danhGia?: 'HUU_ICH' | 'KHONG_HUU_ICH'
  loi?: boolean
  /** Trợ lý đang ở chế độ tra cứu nhanh (chỉ tìm kiếm, không gọi AI). */
  traCuuNhanh?: boolean
}

let seq = 0
function newId(): string {
  seq += 1
  return `msg_${Date.now()}_${seq}`
}

const THONG_BAO_LOI: Record<string, string> = {
  RATE_LIMITED: 'Bạn hỏi nhiều quá hoặc hệ thống đã hết hạn mức hôm nay. Hãy chờ một lát rồi thử lại.',
  NETWORK_ERROR: 'Xin lỗi, trợ lý ảo đang gặp sự cố kết nối. Vui lòng thử lại sau ít phút.',
  VALIDATION_ERROR: 'Câu hỏi chưa hợp lệ (tối đa 1000 ký tự).',
}

interface UseChatResult {
  messages: ChatMessage[]
  gui: (cauHoi: string) => Promise<void>
  dangGui: boolean
  suggestions: string[]
  danhGia: (id: string, huuIch: boolean) => Promise<void>
  lamMoi: () => void
  sessionId?: string
  taoBanNhap: (actionId: string) => Promise<{ maHoSo: string; duongDan: string } | null>
  guiCanBo: (cauHoi?: string) => Promise<{ ma: string } | null>
  daGuiCauHoi: { ma: string; cauHoi: string; ngay: string }[]
}

/** Quản lý hội thoại với trợ lý ảo, nhận câu trả lời dạng streaming. */
export function useChat(): UseChatResult {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [dangGui, setDangGui] = React.useState(false)
  const sessionIdRef = React.useRef<string | undefined>(undefined)
  const [sessionId, setSessionId] = React.useState<string | undefined>(undefined)
  const [daGuiCauHoi, setDaGuiCauHoi] = React.useState<NonNullable<UseChatResult['daGuiCauHoi']>>([])

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
        for await (const chunk of services.chat.hoi(q, sessionIdRef.current)) {
          if (chunk.loai === 'token') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botId ? { ...msg, noiDung: msg.noiDung + (chunk.noiDung ?? '') } : msg,
              ),
            )
          } else if (chunk.loai === 'nguon') {
            if (chunk.sessionId && !sessionIdRef.current) {
              sessionIdRef.current = chunk.sessionId
              setSessionId(chunk.sessionId)
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === botId
                  ? {
                      ...msg,
                      nguon: chunk.nguon,
                      goiYForm: chunk.goiYForm,
                      hanhDong: chunk.hanhDong,
                      traCuuNhanh: chunk.cheDo === 'SEARCH_ONLY',
                    }
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
                      serverId: chunk.messageId,
                      loi: Boolean(chunk.maLoi),
                      noiDung: chunk.traLoiDayDu || msg.noiDung,
                      ...(chunk.maLoi && THONG_BAO_LOI[chunk.maLoi]
                        ? { noiDung: msg.noiDung || THONG_BAO_LOI[chunk.maLoi] }
                        : {}),
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
                    THONG_BAO_LOI.NETWORK_ERROR,
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
    const serverId = setDanhGiaServerId(id, huuIch)
    try {
      if (serverId) await services.chat.danhGia(serverId, huuIch)
    } catch {
      /* đánh giá không thành công cũng không ảnh hưởng hội thoại */
    }
    function setDanhGiaServerId(localId: string, huuIch: boolean): string | undefined {
      let serverIdOut: string | undefined
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== localId) return msg
          serverIdOut = msg.serverId
          return { ...msg, danhGia: huuIch ? 'HUU_ICH' : 'KHONG_HUU_ICH' }
        }),
      )
      return serverIdOut
    }
  }, [])

  /** Cuộc trò chuyện mới: xóa phiên + tin nhắn. */
  const lamMoi = React.useCallback(() => {
    setMessages([])
    sessionIdRef.current = undefined
    setSessionId(undefined)
  }, [])

  const taoBanNhap = React.useCallback(async (actionId: string) => {
    if (!services.chat.taoBanNhap) return null
    try {
      return await services.chat.taoBanNhap(actionId)
    } catch {
      return null
    }
  }, [])

  const guiCanBo = React.useCallback(async (cauHoi?: string) => {
    if (!services.chat.guiCanBo) return null
    try {
      const r = await services.chat.guiCanBo(sessionIdRef.current, cauHoi)
      const lastQuestion = cauHoi ?? [...messages].reverse().find((m) => m.vaiTro === 'nguoi')?.noiDung ?? ''
      setDaGuiCauHoi((prev) => [{ ma: r.ma, cauHoi: lastQuestion, ngay: new Date().toISOString() }, ...prev])
      return r
    } catch {
      return null
    }
  }, [messages])

  // Nạp câu hỏi đã gửi (khi có hỗ trợ từ service).
  React.useEffect(() => {
    if (!services.chat.cauHoiDaGui) return
    void services.chat
      .cauHoiDaGui()
      .then((items) =>
        setDaGuiCauHoi(
          items.map((i) => ({
            ma: i.ma,
            cauHoi: i.question,
            ngay: new Date(i.createdAt).toISOString(),
          })),
        ),
      )
      .catch(() => {})
  }, [])

  return { messages, gui, dangGui, suggestions, danhGia, lamMoi, sessionId, taoBanNhap, guiCanBo, daGuiCauHoi }
}
