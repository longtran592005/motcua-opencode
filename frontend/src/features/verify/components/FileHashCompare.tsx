import * as React from 'react'
import { BadgeCheck, FileUp, Loader2, ShieldX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCompareFileHash } from '../hooks/useVerify'
import { cn } from '@/lib/utils'

interface FileHashCompareProps {
  token: string
}

/** Băm tệp người dùng tải lên bằng SHA-256 (Web Crypto). */
async function bamTep(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Trình duyệt không hỗ trợ Web Crypto: trả về chuỗi rỗng để báo lỗi mềm.
  return ''
}

interface KetQua {
  trungKhop: boolean
  maBam: string
}

/** Khu vực kéo thả tệp PDF để đối chiếu mã băm với văn bản gốc. */
export function FileHashCompare({ token }: FileHashCompareProps) {
  const compare = useCompareFileHash()
  const [dragging, setDragging] = React.useState(false)
  const [dangBam, setDangBam] = React.useState(false)
  const [ketQua, setKetQua] = React.useState<KetQua | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function xuLy(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Vui lòng chọn tệp PDF để đối chiếu.')
      return
    }
    setDangBam(true)
    setKetQua(null)
    try {
      const maBam = await bamTep(file)
      if (!maBam) {
        toast.error('Trình duyệt không hỗ trợ băm tệp. Vui lòng dùng trình duyệt khác.')
        return
      }
      const result = await compare.mutateAsync({ token, maBam })
      setKetQua({ trungKhop: result.ketQuaDoiChieu?.trungKhop ?? false, maBam })
    } catch (error) {
      toast.error('Không thể đối chiếu tệp', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDangBam(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Tải tệp PDF lên để đối chiếu mã băm"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void xuLy(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-secondary' : 'border-input bg-muted/40 hover:bg-secondary/60',
        )}
      >
        {dangBam ? (
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <FileUp className="size-6 text-primary" aria-hidden="true" />
        )}
        <div>
          <p className="text-sm font-semibold text-brand-heading">
            Kéo thả tệp PDF văn bản để đối chiếu
          </p>
          <p className="text-xs text-muted-foreground">
            Hệ thống băm tệp bằng SHA-256 và so khớp với mã băm đã lưu.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            void xuLy(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {ketQua && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2.5 rounded-lg border p-3 text-sm',
            ketQua.trungKhop
              ? 'border-success/50 bg-success-soft text-success'
              : 'border-destructive/50 bg-destructive-soft text-destructive',
          )}
        >
          {ketQua.trungKhop ? (
            <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">
              {ketQua.trungKhop
                ? 'Tệp khớp với văn bản gốc — nội dung nguyên vẹn.'
                : 'Tệp không khớp với văn bản gốc — nội dung có thể đã bị thay đổi.'}
            </p>
            <p className="break-all font-mono text-[11px] text-foreground/70">
              SHA-256: {ketQua.maBam}
            </p>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="px-0 text-xs"
        onClick={() => inputRef.current?.click()}
      >
        Hoặc bấm để chọn tệp từ máy tính
      </Button>
    </div>
  )
}
