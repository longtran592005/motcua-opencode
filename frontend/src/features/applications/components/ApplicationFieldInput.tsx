import { Input } from '@/components/ui/input'
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FormField } from '@/types'
import { cn } from '@/lib/utils'
import { FileUpload } from '@/components/common/FileUpload'
import type { Attachment } from '@/types'

interface ApplicationFieldInputProps {
  field: FormField
  value: unknown
  onChange: (value: unknown) => void
  error?: string
  /** Tệp đính kèm khi trường có type = upload. */
  attachments?: Attachment[]
  onAttachmentsChange?: (value: Attachment[]) => void
}

/** Hiển thị một trường của biểu mẫu động theo đúng kiểu dữ liệu đã khai báo. */
export function ApplicationFieldInput({
  field,
  value,
  onChange,
  error,
  attachments = [],
  onAttachmentsChange,
}: ApplicationFieldInputProps) {
  const id = `field-${field.key}`
  const moTaId = field.helpText ? `${id}-help` : undefined
  const loiId = error ? `${id}-error` : undefined
  const ariaProps = {
    'aria-describedby': [moTaId, loiId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : undefined,
  }

  let control: ReactNode

  switch (field.type) {
    case 'textarea':
      control = (
        <Textarea
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
          disabled={field.readOnly}
          readOnly={field.readOnly}
          className={cn(field.readOnly && 'bg-muted')}
          {...ariaProps}
        />
      )
      break

    case 'select':
      control = (
        <Select
          value={(value as string) ?? ''}
          onValueChange={onChange}
          disabled={field.readOnly}
        >
          <SelectTrigger id={id} className="w-full" {...ariaProps}>
            <SelectValue placeholder={field.placeholder ?? 'Chọn một giá trị'} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
      break

    case 'radio':
      control = (
        <RadioGroup
          value={(value as string) ?? ''}
          onValueChange={onChange}
          className="flex flex-col gap-2"
          aria-describedby={ariaProps['aria-describedby']}
        >
          {(field.options ?? []).map((opt) => (
            <label
              key={opt.value}
              htmlFor={`${id}-${opt.value}`}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <RadioGroupItem value={opt.value} id={`${id}-${opt.value}`} />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
      )
      break

    case 'checkbox': {
      const options = field.options ?? [{ label: field.label, value: 'CO' }]
      const nhieuLuaChon = options.length > 1
      if (!nhieuLuaChon) {
        control = (
          <label
            htmlFor={id}
            className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/40 p-3 text-sm"
          >
            <Checkbox
              id={id}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked === true)}
              className="mt-0.5"
              {...ariaProps}
            />
            <span>{options[0].label}</span>
          </label>
        )
        break
      }
      const danhSach = Array.isArray(value) ? (value as string[]) : []
      control = (
        <div className="space-y-2" role="group" aria-label={field.label}>
          {options.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`${id}-${opt.value}`}
              className="flex cursor-pointer items-center gap-2.5 text-sm"
            >
              <Checkbox
                id={`${id}-${opt.value}`}
                checked={danhSach.includes(opt.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...danhSach, opt.value]
                      : danhSach.filter((v) => v !== opt.value),
                  )
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      )
      break
    }

    case 'upload':
      control = (
        <FileUpload
          value={attachments}
          onChange={(next) => onAttachmentsChange?.(next)}
          accept={field.accept}
          maxSizeMb={field.maxSizeMb}
          requirementKey={field.key}
        />
      )
      break

    default:
      control = (
        <Input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          value={(value as string | number) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          disabled={field.readOnly}
          readOnly={field.readOnly}
          className={cn(field.readOnly && 'bg-muted')}
          {...ariaProps}
        />
      )
  }

  return (
    <div className={cn('space-y-1.5', field.width === 'half' && 'sm:col-span-1')}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {field.label}
        {field.required && !field.readOnly && (
          <span className="text-destructive" aria-label="Bắt buộc">
            *
          </span>
        )}
      </Label>
      {control}
      {field.helpText && (
        <p id={moTaId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      )}
      {error && (
        <p id={loiId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
