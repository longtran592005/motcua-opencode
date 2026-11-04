/**
 * Chuẩn hóa tiếng Việt cho tìm kiếm: chữ thường, bỏ dấu, đ→d, tách token,
 * bỏ từ đệm thông dụng. Dùng cho BM25 và bộ nhớ đệm danh pháp.
 */

const DIA_RE = /[\u0300-\u036f]/g

/** Bỏ dấu + chữ thường + đ→d. Giữ số và chữ, còn lại là ranh giới token. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIA_RE, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
}

/** Từ đệm tiếng Việt thông dụng — bỏ khỏi chỉ mục và truy vấn. */
const STOPWORDS = new Set([
  'va', 'cua', 'la', 'co', 'cho', 'dao', 'duoc', 'nhu', 'the', 'nay', 'no', 'mot',
  'cai', 'vao', 'ra', 'di', 'den', 'tu', 'voi', 'tren', 'trong', 'khi', 'o', 'vay',
  'sao', 'nao', 'ra', 'phai', 'can', 'muon', 'hoi', 'xin', 'cam', 'on', 'minh',
  'em', 'anh', 'chi', 'toi', 'ban', 'ta', 'day', 'do', 'hoac', 'neu', 'theo',
  've', 'xem', 'lam', 'gi', 'the', 'nao', 'vung', 'quy', 'co', 'chi',
  'lam', 'sao', 'de', 'bi', 'dua', 'ho', 'khong', 'chua', 'da', 'se',
])

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token)
}

/** Các token hữu ích (không phải từ đệm). */
export function keywords(input: string): string[] {
  return tokenize(input).filter((t) => !STOPWORDS.has(t))
}

/** Chuẩn hóa mạnh cho bộ nhớ đệm: bỏ mọi ký tự phi chữ-số-số (không dấu). */
export function cacheKey(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9]+/g, ' ').trim()
}
