import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/formatters'
import { cn, formatBytes } from '@/lib/utils'
import type { FormField } from '@/types'

interface ApplicationDataViewProps {
  fields: FormField[]
  duLieu: Record<string, unknown>
  className?: string
}

function hienThi(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (field.type === 'checkbox') {
    if (value === true) return field.options?.[0]?.label ?? 'Đồng ý'
    if (Array.isArray(value)) {
      return value
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(', ')
    }
    return 'Không'
  }
  if (field.type === 'date') return formatDate(String(value))
  if (field.type === 'number') return String(value)
  if (field.options) {
    return field.options.find((o) => o.value === value)?.label ?? String(value)
  }
  return String(value)
}

/** Trình bày nội dung hồ sơ theo nhãn trường của biểu mẫu động. */
export function ApplicationDataView({ fields, duLieu, className }: ApplicationDataViewProps) {
  const fieldHienThi = fields.filter((f) => f.type !== 'upload')
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {fieldHienThi.map((field) => (
        <div
          key={field.id}
          className={cn('space-y-0.5', field.width === 'full' && 'sm:col-span-2')}
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {hienThi(field, duLieu[field.key])}
          </dd>
        </div>
      ))}
    </dl>
  )
}

interface AttachmentListProps {
  attachments: { id: string; ten: string; kichThuoc: number; loai: string; url: string }[]
  className?: string
}

/** Danh sách tệp đính kèm kèm liên kết tải/xem. */
export function AttachmentList({ attachments, className }: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>Không có tệp đính kèm.</p>
    )
  }
  return (
    <ul className={cn('space-y-2', className)}>
      {attachments.map((file) => {
        const laAnh = file.loai.startsWith('image/')
        return (
          <li key={file.id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <Paperclip className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.ten}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.kichThuoc)}</p>
            </div>
            {laAnh ? (
              <Badge variant="secondary">Ảnh</Badge>
            ) : (
              <Badge variant="secondary">Tệp</Badge>
            )}
          </li>
        )
      })}
    </ul>
  )
}
