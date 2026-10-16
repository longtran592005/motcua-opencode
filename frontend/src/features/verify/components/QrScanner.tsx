import * as React from 'react'
import { Camera, CameraOff, Loader2 } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface QrScannerProps {
  /** Nhận token hoặc nội dung thô đọc được từ mã QR. */
  onResult: (token: string) => void
}

function rutTrichToken(text: string): string {
  const raw = text.trim()
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    const index = parts.indexOf('xac-thuc')
    if (index >= 0 && parts[index + 1]) return decodeURIComponent(parts[index + 1])
  } catch {
    /* không phải URL, dùng nguyên văn */
  }
  const match = raw.match(/xac-thuc\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : raw
}

/** Quét mã QR bằng camera để tra cứu nhanh văn bản. */
export function QrScanner({ onResult }: QrScannerProps) {
  const [dangQuet, setDangQuet] = React.useState(false)
  const [dangKhoiTao, setDangKhoiTao] = React.useState(false)
  const idRef = React.useRef(`qr-${Math.random().toString(36).slice(2, 9)}`)
  const scannerRef = React.useRef<Html5Qrcode | null>(null)

  const dungQuet = React.useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      await scanner.stop()
      scanner.clear()
    } catch {
      /* bỏ qua lỗi khi dừng */
    } finally {
      scannerRef.current = null
      setDangQuet(false)
    }
  }, [])

  React.useEffect(() => {
    return () => {
      void dungQuet()
    }
  }, [dungQuet])

  async function batDauQuet() {
    setDangKhoiTao(true)
    try {
      const scanner = new Html5Qrcode(idRef.current, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          toast.success('Đã đọc mã QR.')
          void dungQuet()
          onResult(rutTrichToken(decodedText))
        },
        () => {
          /* bỏ qua khung hình không có mã */
        },
      )
      setDangQuet(true)
    } catch {
      toast.error('Không mở được camera. Vui lòng cấp quyền truy cập camera.')
    } finally {
      setDangKhoiTao(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        id={idRef.current}
        className="overflow-hidden rounded-lg border bg-black/5 [&_video]:w-full"
        aria-label="Khung quét mã QR"
      />
      {dangQuet ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => void dungQuet()}>
          <CameraOff className="size-4" />
          Dừng quét
        </Button>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => void batDauQuet()}
          disabled={dangKhoiTao}
        >
          {dangKhoiTao ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-4" />
          )}
          Quét mã QR bằng camera
        </Button>
      )}
    </div>
  )
}
