import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react'
import * as React from 'react'
import { toast } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Attachment } from '@/types'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  value: Attachment[]
  onChange: (value: Attachment[]) => void
  accept?: string
  maxSizeMb?: number
  multiple?: boolean
  /** Gắn với giấy tờ bắt buộc nào trong cấu hình loại đơn. */
  requirementKey?: string
  disabled?: boolean
  /** Nhãn mô tả, hiển thị bên trong vùng kéo thả. */
  moTa?: string
  className?: string
}

const MAX_BYTES_DEFAULT = 5 * 1024 * 1024

/** Vùng kéo thả tệp đính kèm — mô phỏng quá trình tải lên. */
export function FileUpload({
  value,
  onChange,
  accept = '.pdf,.jpg,.jpeg,.png,.docx,.xlsx',
  maxSizeMb,
  multiple = true,
  requirementKey,
  disabled,
  moTa,
  className,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [dangTai, setDangTai] = React.useState<{ ten: string; phanTram: number } | null>(null)
  const maxBytes = (maxSizeMb ?? 5) * 1024 * 1024 || MAX_BYTES_DEFAULT

  const xuLyTep = async (files: FileList | null) => {
    if (!files?.length) return
    const danhSach = Array.from(files)
    const hopLe = danhSach.filter((f) => {
      if (f.size > maxBytes) {
        toast.error(`Tệp "${f.name}" vượt quá ${maxSizeMb ?? 5}MB.`)
        return false
      }
      return true
    })
    if (!hopLe.length) return

    for (const file of hopLe) {
      setDangTai({ ten: file.name, phanTram: 0 })
      // Mô phỏng tiến trình tải lên (mock service không thực hiện upload thật).
      for (let p = 20; p <= 100; p += 20) {
        await new Promise((r) => setTimeout(r, 90))
        setDangTai({ ten: file.name, phanTram: p })
      }
      const attachment: Attachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ten: file.name,
        loai: file.type || 'application/octet-stream',
        kichThuoc: file.size,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        requirementKey,
      }
      onChange(multiple ? [...value, attachment] : [attachment])
    }
    setDangTai(null)
    toast.success(`Đã tải lên ${hopLe.length} tệp.`)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Chọn hoặc kéo thả tệp để tải lên"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) void xuLyTep(e.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-secondary' : 'border-input bg-muted/40 hover:bg-secondary/60',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <UploadCloud className="size-7 text-primary" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-brand-heading">
            Kéo thả tệp vào đây hoặc bấm để chọn
          </p>
          <p className="text-xs text-muted-foreground">
            {moTa ?? `Hỗ trợ ${accept}. Tối đa ${maxSizeMb ?? 5}MB mỗi tệp.`}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            void xuLyTep(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {dangTai && (
        <div className="space-y-1.5 rounded-md border p-3">
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span className="truncate font-medium">{dangTai.ten}</span>
            <span className="ml-auto text-muted-foreground">{dangTai.phanTram}%</span>
          </div>
          <Progress value={dangTai.phanTram} />
        </div>
      )}

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((file) => {
            const laAnh = file.loai.startsWith('image/')
            return (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  {laAnh ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.ten}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.kichThuoc)}</p>
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Xoá tệp ${file.ten}`}
                    className="text-destructive hover:bg-destructive-soft"
                    onClick={() => onChange(value.filter((f) => f.id !== file.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {value.length === 0 && !dangTai && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" />
          Chưa có tệp nào được đính kèm.
        </p>
      )}
    </div>
  )
}
