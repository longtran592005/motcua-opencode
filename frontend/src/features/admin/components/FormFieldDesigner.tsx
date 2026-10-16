import * as React from 'react'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FIELD_TYPES, FIELD_TYPE_LABELS, type FieldOption, type FieldType, type FormField } from '@/types'
import { cn } from '@/lib/utils'

const LOAI_CO_OPTIONS: FieldType[] = ['select', 'radio', 'checkbox']

function truongMoi(order: number): FormField {
  return {
    id: `f_${Math.random().toString(36).slice(2, 9)}`,
    key: '',
    label: '',
    type: 'text',
    required: false,
    order,
    width: 'half',
  }
}

interface FieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: FormField | null
  onSave: (field: FormField) => void
}

/** Hộp thoại thêm / sửa một trường của biểu mẫu động. */
function FieldDialog({ open, onOpenChange, field, onSave }: FieldDialogProps) {
  const [draft, setDraft] = React.useState<FormField>(field ?? truongMoi(1))

  React.useEffect(() => {
    if (open) setDraft(field ?? truongMoi(1))
  }, [open, field])

  const canOptions = LOAI_CO_OPTIONS.includes(draft.type)
  const options = draft.options ?? []

  function capNhat(patch: Partial<FormField>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  function capNhatOption(index: number, patch: Partial<FieldOption>) {
    capNhat({ options: options.map((o, i) => (i === index ? { ...o, ...patch } : o)) })
  }

  const hopLe = draft.label.trim() !== '' && draft.key.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Sửa trường biểu mẫu' : 'Thêm trường biểu mẫu'}</DialogTitle>
          <DialogDescription>
            Cấu hình trường dữ liệu mà sinh viên sẽ điền khi nộp đơn.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ff-label">
              Nhãn hiển thị <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ff-label"
              value={draft.label}
              onChange={(e) => capNhat({ label: e.target.value })}
              placeholder="Ví dụ: Lý do đề nghị"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ff-key">
              Khoá dữ liệu <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ff-key"
              value={draft.key}
              onChange={(e) => capNhat({ key: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
              placeholder="ví dụ: ly_do"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ff-type">Kiểu trường</Label>
            <Select value={draft.type} onValueChange={(v) => capNhat({ type: v as FieldType })}>
              <SelectTrigger id="ff-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ff-width">Độ rộng</Label>
            <Select
              value={draft.width ?? 'half'}
              onValueChange={(v) => capNhat({ width: v as 'half' | 'full' })}
            >
              <SelectTrigger id="ff-width">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="half">Nửa dòng</SelectItem>
                <SelectItem value="full">Cả dòng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ff-placeholder">Gợi ý trong ô nhập</Label>
            <Input
              id="ff-placeholder"
              value={draft.placeholder ?? ''}
              onChange={(e) => capNhat({ placeholder: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ff-help">Hướng dẫn thêm</Label>
            <Textarea
              id="ff-help"
              value={draft.helpText ?? ''}
              onChange={(e) => capNhat({ helpText: e.target.value })}
              rows={2}
            />
          </div>

          {draft.type === 'upload' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ff-accept">Định dạng cho phép</Label>
                <Input
                  id="ff-accept"
                  value={draft.accept ?? ''}
                  onChange={(e) => capNhat({ accept: e.target.value })}
                  placeholder=".pdf,.jpg,.png"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ff-max">Dung lượng tối đa (MB)</Label>
                <Input
                  id="ff-max"
                  type="number"
                  value={draft.maxSizeMb ?? 5}
                  onChange={(e) => capNhat({ maxSizeMb: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {draft.type === 'number' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ff-min">Giá trị nhỏ nhất</Label>
                <Input
                  id="ff-min"
                  type="number"
                  value={draft.min ?? ''}
                  onChange={(e) => capNhat({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ff-maxnum">Giá trị lớn nhất</Label>
                <Input
                  id="ff-maxnum"
                  type="number"
                  value={draft.max ?? ''}
                  onChange={(e) => capNhat({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
            <div>
              <Label htmlFor="ff-required" className="cursor-pointer">
                Bắt buộc nhập
              </Label>
              <p className="text-xs text-muted-foreground">
                Sinh viên phải điền trường này trước khi nộp hồ sơ.
              </p>
            </div>
            <Switch
              id="ff-required"
              checked={draft.required}
              onCheckedChange={(v) => capNhat({ required: v })}
            />
          </div>
        </div>

        {canOptions && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label>Danh sách lựa chọn</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => capNhat({ options: [...options, { label: '', value: '' }] })}
              >
                <Plus className="size-3.5" />
                Thêm lựa chọn
              </Button>
            </div>
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Chưa có lựa chọn nào. Với trường “Chọn nhiều” một lựa chọn sẽ hiển thị dạng ô tích.
              </p>
            )}
            {options.map((opt, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={opt.label}
                  placeholder="Nhãn hiển thị"
                  onChange={(e) => capNhatOption(index, { label: e.target.value })}
                />
                <Input
                  value={opt.value}
                  placeholder="Giá trị"
                  className="font-mono text-sm"
                  onChange={(e) => capNhatOption(index, { value: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label="Xoá lựa chọn"
                  onClick={() => capNhat({ options: options.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            disabled={!hopLe}
            onClick={() => {
              onSave({
                ...draft,
                key: draft.key.trim(),
                label: draft.label.trim(),
                options: canOptions ? options : undefined,
              })
            }}
          >
            {field ? 'Lưu trường' : 'Thêm trường'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface FormFieldDesignerProps {
  fields: FormField[]
  onChange: (fields: FormField[]) => void
}

/** Trình thiết kế biểu mẫu động: thêm, sửa, xoá và sắp xếp thứ tự trường. */
export function FormFieldDesigner({ fields, onChange }: FormFieldDesignerProps) {
  const [moDialog, setMoDialog] = React.useState(false)
  const [dangSua, setDangSua] = React.useState<FormField | null>(null)
  const [xoaIndex, setXoaIndex] = React.useState<number | null>(null)
  const dragIndex = React.useRef<number | null>(null)

  const sapXep = [...fields].sort((a, b) => a.order - b.order)

  function luu(field: FormField) {
    const danhSach = dangSua
      ? sapXep.map((f) => (f.id === field.id ? field : f))
      : [...sapXep, { ...field, order: sapXep.length + 1 }]
    onChange(danhSach.map((f, index) => ({ ...f, order: index + 1 })))
    setMoDialog(false)
    setDangSua(null)
  }

  function diChuyen(from: number, to: number) {
    if (to < 0 || to >= sapXep.length || from === to) return
    const danhSach = [...sapXep]
    const [item] = danhSach.splice(from, 1)
    danhSach.splice(to, 0, item)
    onChange(danhSach.map((f, index) => ({ ...f, order: index + 1 })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-brand-heading">Thiết kế biểu mẫu</p>
          <p className="text-xs text-muted-foreground">
            Kéo thả để sắp xếp thứ tự trường hiển thị cho sinh viên.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setDangSua(null)
            setMoDialog(true)
          }}
        >
          <Plus className="size-4" />
          Thêm trường
        </Button>
      </div>

      {sapXep.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Biểu mẫu chưa có trường nào. Bấm “Thêm trường” để bắt đầu thiết kế.
        </p>
      ) : (
        <ul className="space-y-2">
          {sapXep.map((field, index) => (
            <li
              key={field.id}
              draggable
              onDragStart={() => (dragIndex.current = index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null) diChuyen(dragIndex.current, index)
                dragIndex.current = null
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-card p-3',
                field.readOnly && 'bg-muted/50',
              )}
            >
              <GripVertical
                className="size-4 shrink-0 cursor-grab text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {field.label || '(chưa đặt nhãn)'}
                  {field.required && (
                    <span className="text-destructive" aria-label="Bắt buộc">
                      *
                    </span>
                  )}
                  {field.readOnly && <Badge variant="secondary">Chỉ đọc</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {FIELD_TYPE_LABELS[field.type]} · khoá{' '}
                  <span className="font-mono">{field.key || '—'}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => diChuyen(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Di chuyển ${field.label} lên`}
                >
                  <span aria-hidden="true">↑</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => diChuyen(index, index + 1)}
                  disabled={index === sapXep.length - 1}
                  aria-label={`Di chuyển ${field.label} xuống`}
                >
                  <span aria-hidden="true">↓</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDangSua(field)
                    setMoDialog(true)
                  }}
                  aria-label={`Sửa trường ${field.label}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => setXoaIndex(index)}
                  aria-label={`Xoá trường ${field.label}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FieldDialog open={moDialog} onOpenChange={setMoDialog} field={dangSua} onSave={luu} />

      <ConfirmDialog
        open={xoaIndex !== null}
        onOpenChange={(open) => !open && setXoaIndex(null)}
        tieuDe="Xoá trường biểu mẫu"
        moTa="Trường này sẽ bị xoá khỏi biểu mẫu. Dữ liệu đã nộp trước đó vẫn được giữ nguyên."
        nhanXacNhan="Xoá trường"
        bienThe="destructive"
        onXacNhan={() => {
          if (xoaIndex === null) return
          onChange(
            sapXep
              .filter((_, i) => i !== xoaIndex)
              .map((f, index) => ({ ...f, order: index + 1 })),
          )
          setXoaIndex(null)
        }}
      />
    </div>
  )
}
