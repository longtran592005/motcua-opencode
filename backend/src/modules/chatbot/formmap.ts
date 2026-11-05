/**
 * Nạp form-map.json lúc chạy (Q10): chỉ cặp TIN CẬY CAO mới được gắn nút
 * "Mở đơn trực tuyến"; cặp trung-binh chỉ tải biểu mẫu + câu gợi ý, không nút
 * nộp online tự động. Cặp chưa ghép không ảnh hưởng nút nào.
 */
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FormMapEntry } from './ingest'
import { normalizeText } from './vietnamese'

/** Câu kèm theo khi cặp chỉ ở mức trung-binh (không có nút nộp online tự động). */
export const GOI_Y_TRUNG_BINH: string = 'Nếu đúng thủ tục này, bạn có thể nộp trực tuyến tại mục Dịch vụ Một cửa.'

let cache: { entries: FormMapEntry[]; mtime: number } | null = null

function loadOnce(): FormMapEntry[] {
  const file = resolve(process.cwd(), 'src/modules/chatbot/form-map.json')
  try {
    const mtime = statSync(file).mtimeMs
    if (cache && cache.mtime === mtime) return cache.entries
    const entries = JSON.parse(readFileSync(file, 'utf8')) as FormMapEntry[]
    cache = { entries, mtime }
    return entries
  } catch {
    return []
  }
}

/** Danh sách cặp hiện thời (đa số chưa ghép — maLoaiDon null). */
export function allFormMapEntries(): FormMapEntry[] {
  return loadOnce()
}

/** Tìm cặp theo mã tài liệu thư viện (trường `libraryId` trong form-map). */
export function entryByLibraryId(libraryId: string): FormMapEntry | null {
  return loadOnce().find((e) => e.libraryId === libraryId) ?? null
}

/** Tìm cặp theo tên biểu mẫu (so sánh không dấu, bỏ hoa/thường). */
export function entryByBieuMau(ten: string): FormMapEntry | null {
  const n = normalizeText(ten)
  return loadOnce().find((e) => normalizeText(e.tenBieuMau) === n) ?? null
}

/**
 * Hạn mức nút nộp online cho một loại đơn qua form-map:
 * - 'cao'        → có cặp tin cậy cao → ĐƯỢC gắn nút nộp online.
 * - 'trung-binh' → chỉ có cặp trung-binh → KHÔNG nút online (tải biểu mẫu + lời khuyên).
 * - null         → loại đơn không có cấu hình trong form-map → giữ hành vi hiện trạng.
 */
export function gateNopOnlineFor(maLoaiDon: string): 'cao' | 'trung-binh' | null {
  const hits = loadOnce().filter((e) => e.maLoaiDon === maLoaiDon)
  if (hits.some((h) => h.doTinCay === 'cao')) return 'cao'
  if (hits.length) return 'trung-binh'
  return null
}
