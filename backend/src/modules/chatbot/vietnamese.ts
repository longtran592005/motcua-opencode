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
  // bổ sung (vòng chỉnh eval Q4): từ đệm + từ chung mọi thủ tục, không mang thông tin phân biệt
  'roi', 'nua', 'lan', 'hay', 'nho', 'gui', 'dung', 'dau', 'cu', 'giup',
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

/**
 * Từ điển đồng nghĩa nhỏ (vòng chỉnh Item 4): ánh xạ cách nói tự nhiên →
 * từ vựng của tài liệu. Nếu MỌI token của cụm "tu" có trong câu hỏi thì bổ
 * sung các token "thanh". KHÔNG thay token gốc — chỉ cộng thêm.
 */
const SYNONYMS: Array<{ tu: string[]; thanh: string[] }> = [
  { tu: ['hoc', 'lai'], thanh: ['cai', 'thien'] },
  { tu: ['bao', 'luu'], thanh: ['hoan', 'hoc', 'nghi', 'hoc'] },
  { tu: ['thi', 'lai'], thanh: ['hoc', 'lai', 'cai', 'thien'] },
  { tu: ['nghi', 'hoc', 'nam'], thanh: ['bao', 'luu'] },
  { tu: ['van', 'bang'], thanh: ['xac', 'nhan', 'thong', 'tin'] },
  { tu: ['thay', 'the'], thanh: ['tam', 'thoi'] },
  { tu: ['cong', 'chung'], thanh: ['ban', 'sao'] },
  { tu: ['sinh', 'vien'], thanh: ['cong', 'tac'] },
  { tu: ['lien', 'thong'], thanh: ['hinh', 'thuc'] },
  { tu: ['thuc', 'tap', 'tu'], thanh: ['lien', 'he', 'co', 'so'] },
  { tu: ['thuc', 'tap', 'tap', 'trung'], thanh: ['phan', 'cong'] },
  { tu: ['nghi', 'om'], thanh: ['bao', 'hiem', 'xa', 'hoi'] },
  { tu: ['nghi', 'phep'], thanh: ['huong', 'luong'] },
]

/** Mở rộng token truy vấn bằng đồng nghĩa (chỉ cộng thêm, không thay). */
export function expandKeywords(input: string): string[] {
  const toks = keywords(input)
  const out = new Set(toks)
  for (const { tu, thanh } of SYNONYMS) {
    if (tu.every((t) => toks.includes(t))) for (const t of thanh) out.add(t)
  }
  return [...out]
}

