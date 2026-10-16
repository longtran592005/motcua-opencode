import { Lock, RefreshCw, ShieldCheck, Timer } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiError } from '@/types'
import type { OtpChallenge } from '@/services/contracts/approval'
import { services } from '@/services'
import { OTP_CONFIG } from '@/lib/constants'
import { countdownText } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface OtpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  maHoSo: string
  tieuDe?: string
  moTa?: string
  /** Gọi khi người dùng bấm xác nhận; ném ApiError để hiển thị lỗi OTP. */
  onXacThuc: (input: { challengeId: string; otp: string }) => Promise<void>
}

interface LoiTrangThai {
  ma: string
  thongDiep: string
}

/**
 * Hộp thoại ký OTP: 6 ô số tự chuyển ô, đếm ngược hiệu lực mã,
 * giới hạn gửi lại 30 giây và khoá tạm 15 phút sau 5 lần nhập sai.
 * Bản mock chấp nhận mã cố định khai báo trong `MOCK_OTP_CODE` — không hiển thị trên giao diện.
 */
export function OtpDialog({
  open,
  onOpenChange,
  maHoSo,
  tieuDe = 'Ký số bằng OTP',
  moTa = 'Mã xác thực đã được gửi tới số điện thoại và email đăng ký của bạn.',
  onXacThuc,
}: OtpDialogProps) {
  const [challenge, setChallenge] = React.useState<OtpChallenge | null>(null)
  const [so, setSo] = React.useState<string[]>(Array(OTP_CONFIG.doDai).fill(''))
  const [loi, setLoi] = React.useState<LoiTrangThai | null>(null)
  const [dangGui, setDangGui] = React.useState(false)
  const [dangXacThuc, setDangXacThuc] = React.useState(false)
  const [now, setNow] = React.useState(() => Date.now())
  const refs = React.useRef<Array<HTMLInputElement | null>>([])

  React.useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [open])

  const guiMa = React.useCallback(async () => {
    setDangGui(true)
    setLoi(null)
    try {
      const result = await services.otp.gui(maHoSo)
      setChallenge(result)
      setSo(Array(OTP_CONFIG.doDai).fill(''))
      setTimeout(() => refs.current[0]?.focus(), 60)
    } catch (err) {
      const e = err as ApiError
      setLoi({ ma: e.code ?? 'UNKNOWN', thongDiep: e.message })
    } finally {
      setDangGui(false)
    }
  }, [maHoSo])

  React.useEffect(() => {
    if (open) void guiMa()
    else {
      setChallenge(null)
      setSo(Array(OTP_CONFIG.doDai).fill(''))
      setLoi(null)
    }
  }, [open, guiMa])

  const hetHanLuc = challenge ? new Date(challenge.hetHanLuc).getTime() : 0
  const choGuiLaiLuc = hetHanLuc - OTP_CONFIG.hanSuDungGiay * 1000 + OTP_CONFIG.choGuiLaiGiay * 1000
  const conLai = Math.max(0, Math.round((hetHanLuc - now) / 1000))
  const choGuiLai = Math.max(0, Math.round((choGuiLaiLuc - now) / 1000))
  const khoaDenLuc = challenge?.khoaDenLuc ? new Date(challenge.khoaDenLuc).getTime() : 0
  const dangKhoa = khoaDenLuc > now
  const khoaConLai = dangKhoa ? Math.round((khoaDenLuc - now) / 1000) : 0
  const hetHieuLuc = !!challenge && conLai <= 0 && !dangKhoa

  const capNhatO = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...so]
    next[index] = digit
    setSo(next)
    setLoi(null)
    if (digit && index < OTP_CONFIG.doDai - 1) refs.current[index + 1]?.focus()
  }

  const danDayDu = so.every((d) => d !== '')

  const xacThuc = async () => {
    if (!challenge || !danDayDu || dangKhoa) return
    setDangXacThuc(true)
    setLoi(null)
    try {
      await onXacThuc({ challengeId: challenge.challengeId, otp: so.join('') })
      onOpenChange(false)
    } catch (err) {
      const e = err as ApiError
      const chiTiet = (e.chiTiet ?? {}) as { soLanConLai?: number; khoaDenLuc?: string }
      if (e.code === 'OTP_LOCKED') {
        const denLuc = chiTiet.khoaDenLuc ? new Date(chiTiet.khoaDenLuc).getTime() : Date.now()
        setChallenge((c) => (c ? { ...c, khoaDenLuc: new Date(denLuc).toISOString() } : c))
        setNow(Date.now())
      }
      setLoi({ ma: e.code ?? 'UNKNOWN', thongDiep: e.message })
      setSo(Array(OTP_CONFIG.doDai).fill(''))
      refs.current[0]?.focus()
    } finally {
      setDangXacThuc(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {tieuDe}
          </DialogTitle>
          <DialogDescription>{moTa}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground">
            <span className="flex items-center gap-1.5">
              <Timer className="size-3.5" />
              Hiệu lực còn lại: {countdownText(conLai)}
            </span>
            <span>Hồ sơ {maHoSo}</span>
          </div>

          {dangKhoa && (
            <Alert variant="destructive">
              <Lock className="size-4" />
              <AlertDescription>
                Chức năng ký đang bị tạm khoá do nhập sai quá {OTP_CONFIG.soLanSaiToiDa} lần.
                Vui lòng thử lại sau {countdownText(khoaConLai)}.
              </AlertDescription>
            </Alert>
          )}

          {!dangKhoa && hetHieuLuc && (
            <Alert variant="warning">
              <Timer className="size-4" />
              <AlertDescription>
                Mã OTP đã hết hiệu lực. Bấm “Gửi lại mã” để nhận mã mới.
              </AlertDescription>
            </Alert>
          )}

          {loi && !dangKhoa && (
            <Alert variant="destructive">
              <AlertDescription>{loi.thongDiep}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center gap-2" role="group" aria-label="Nhập mã OTP">
            {so.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  refs.current[index] = el
                }}
                value={digit}
                onChange={(e) => capNhatO(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !so[index] && index > 0) {
                    refs.current[index - 1]?.focus()
                  }
                  if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
                  if (e.key === 'ArrowRight' && index < OTP_CONFIG.doDai - 1) {
                    refs.current[index + 1]?.focus()
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text').replace(/\D/g, '')
                  if (!text) return
                  e.preventDefault()
                  const next = Array(OTP_CONFIG.doDai).fill('')
                  text
                    .slice(0, OTP_CONFIG.doDai)
                    .split('')
                    .forEach((d, i) => {
                      next[i] = d
                    })
                  setSo(next)
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                disabled={dangKhoa || dangXacThuc || !challenge}
                aria-label={`Ô số ${index + 1} của mã OTP`}
                className={cn(
                  'size-11 rounded-md border border-input bg-background text-center text-lg font-bold tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              />
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Mã gồm {OTP_CONFIG.doDai} chữ số, hiệu lực {OTP_CONFIG.hanSuDungGiay / 60} phút. Không
            chia sẻ mã cho bất kỳ ai.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => void guiMa()}
            disabled={dangGui || choGuiLai > 0 || dangKhoa}
          >
            <RefreshCw className={cn('size-4', dangGui && 'animate-spin')} />
            {choGuiLai > 0 ? `Gửi lại sau ${choGuiLai}s` : 'Gửi lại mã'}
          </Button>
          <Button
            type="button"
            onClick={() => void xacThuc()}
            disabled={!danDayDu || dangKhoa || dangXacThuc || !challenge}
          >
            {dangXacThuc ? 'Đang ký…' : 'Xác nhận ký'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
