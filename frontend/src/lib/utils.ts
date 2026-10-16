import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Tạo id ngẫu nhiên có tiền tố. */
export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function includesText(haystack: string, needle: string): boolean {
  if (!needle.trim()) return true
  return normalizeText(haystack).includes(normalizeText(needle))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Che bớt họ tên: "Nguyễn Văn An" -> "Nguyễn V** A".
 */
export function maskName(hoTen: string): string {
  const parts = hoTen.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  const middle = parts.slice(1, -1).map((w) => '*'.repeat(w.length))
  return [parts[0], ...middle, last.charAt(0)].join(' ')
}

/**
 * Che bớt mã số sinh viên: "20211234" -> "2021***".
 */
export function maskMssv(maSo: string): string {
  if (maSo.length <= 4) return '*'.repeat(maSo.length)
  return `${maSo.slice(0, 4)}${'*'.repeat(Math.max(3, maSo.length - 4))}`
}

/**
 * Băm nội dung thành chuỗi SHA-256 (Web Crypto). Dùng cho mock chữ ký / đối chiếu.
 */
export async function sha256(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback đơn giản cho môi trường không có Web Crypto.
    let h = 0
    for (let i = 0; i < text.length; i += 1) {
      h = (h << 5) - h + text.charCodeAt(i)
      h |= 0
    }
    return Math.abs(h).toString(16).padStart(64, '0')
  }
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Băm nhanh dạng đồng bộ (chỉ dùng cho dữ liệu mock sinh sẵn). */
export function quickHash(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = (h1 ^ c) * 16777619
    h2 = (h2 + c * (i + 7)) >>> 0
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return (part(h1) + part(h2) + part(h1 ^ h2) + part(h1 + h2)).repeat(2)
}

export function shortHash(hash: string, length = 8): string {
  return hash.slice(0, length).toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function initials(hoTen: string): string {
  const parts = hoTen.trim().split(/\s+/)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase()
}

/** Lưu một Blob thành tệp tải về máy. */
export function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadBlob(filename: string, content: string, mime: string) {
  saveBlob(filename, new Blob([content], { type: mime }))
}

/** Tải tệp tĩnh trong `public/` (Word, Excel, PDF) và lưu về máy với tên gốc. */
export async function downloadStaticFile(filename: string, url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Không tải được tệp (HTTP ${response.status}).`)
  }
  saveBlob(filename, await response.blob())
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait = 300,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}
