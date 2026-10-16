import { differenceInHours, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : value
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value?: string | Date | null): string {
  const d = toDate(value)
  return d ? format(d, 'dd/MM/yyyy') : '—'
}

export function formatDateTime(value?: string | Date | null): string {
  const d = toDate(value)
  return d ? format(d, 'dd/MM/yyyy HH:mm') : '—'
}

export function formatTime(value?: string | Date | null): string {
  const d = toDate(value)
  return d ? format(d, 'HH:mm') : '—'
}

export function formatRelative(value?: string | Date | null): string {
  const d = toDate(value)
  if (!d) return '—'
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: vi })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value)
}

/** Chuỗi mô tả thời hạn xử lý còn lại. */
export function slaText(hanXuLy?: string): {
  text: string
  mucDo: 'BINH_THUONG' | 'SAP_HET_HAN' | 'QUA_HAN'
} {
  const d = toDate(hanXuLy)
  if (!d) return { text: 'Không có hạn', mucDo: 'BINH_THUONG' }
  const hours = differenceInHours(d, new Date())
  if (hours < 0) {
    return {
      text: `Quá hạn ${Math.abs(hours)} giờ`,
      mucDo: 'QUA_HAN',
    }
  }
  if (hours <= 24) {
    return { text: `Còn ${hours} giờ`, mucDo: 'SAP_HET_HAN' }
  }
  const days = Math.floor(hours / 24)
  return { text: `Còn ${days} ngày`, mucDo: 'BINH_THUONG' }
}

export function formatDuration(hours?: number): string {
  if (hours === undefined || hours === null) return '—'
  if (hours < 24) return `${hours} giờ`
  const days = hours / 24
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ngày`
}

/** Đếm ngược dạng mm:ss cho hộp thoại OTP. */
export function countdownText(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
