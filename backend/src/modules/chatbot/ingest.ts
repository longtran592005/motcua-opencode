/**
 * Nạp kiến thức (3.1): với mỗi tài liệu thư viện LUÔN tạo một "thẻ biểu mẫu"
 * (tên, nhóm, mô tả, định dạng, URL tải về) — kể cả khi không đọc được nội dung
 * tệp; thêm nội dung tệp nếu đọc được (.docx mammoth / .doc word-extractor /
 * .pdf pdf-parse / .txt,.md đọc thẳng).
 *
 * Chia đoạn theo tiêu đề/điều–khoản–mục/đoạn văn, ~600–900 ký tự, chồng lấn
 * ~100 ký tự. Upsert theo ma = KB-<slug>-<hash8>; chỉ xử lý lại khi content_hash
 * thay đổi. Ghi form-map.json ánh xạ biểu mẫu ↔ loại đơn trực tuyến (so khớp
 * gần đúng tên).
 *
 * Chạy: npm run chatbot:ingest — nối CSDL theo DATABASE_URL (chỉ chạy trên
 * CSDL TEST hoặc CSDL dev khi người dùng tự chạy theo docs/CHATBOT_HUONG_DAN.md).
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { prisma } from '../../lib/prisma'
import { normalizeText } from './vietnamese'

const PUBLIC_ROOT = path.resolve(process.cwd(), '..', 'frontend', 'public')

/** Url '/tai-lieu/...' → đường dẫn tệp tuyệt đối, hoặc null khi không hợp lệ. */
export function libraryUrlToPath(url: string, publicRoot: string = PUBLIC_ROOT): string | null {
  if (!url.startsWith('/tai-lieu/')) return null
  const clean = url.split('?')[0].split('#')[0]
  const resolved = path.resolve(publicRoot, `.${clean}`)
  if (!resolved.startsWith(path.resolve(publicRoot))) return null
  return resolved
}

export interface ExtractResult {
  text: string
  pages?: number
}

/** Đọc văn bản thô từ tệp. Trả null khi định dạng/khả năng đọc thất bại. */
export async function extractTextFromFile(absPath: string, loaiTep: string): Promise<ExtractResult | null> {
  if (!fs.existsSync(absPath)) return null
  try {
    if (loaiTep === 'pdf' || absPath.toLowerCase().endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(absPath)) })
      try {
        const res = await parser.getText()
        return { text: res.text ?? '', pages: res.pages?.length ?? undefined }
      } finally {
        await parser.destroy().catch(() => {})
      }
    }
    if (loaiTep === 'docx' || absPath.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const res = await mammoth.extractRawText({ buffer: fs.readFileSync(absPath) })
      return { text: res.value ?? '' }
    }
    if (loaiTep === 'doc' || absPath.toLowerCase().endsWith('.doc')) {
      const { default: WordExtractor } = await import('word-extractor')
      const extractor = new WordExtractor()
      const doc = await extractor.extract(absPath)
      return { text: doc.getBody() ?? '' }
    }
    if (loaiTep === 'txt' || loaiTep === 'md' || /\.(txt|md)$/i.test(absPath)) {
      return { text: fs.readFileSync(absPath, 'utf8') }
    }
    return null
  } catch {
    return null
  }
}

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Slug ASCII cho mã tài liệu. */
export function slugify(input: string): string {
  return (
    normalizeText(input)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tai-lieu'
  )
}

/* ------------------------------------------------------------------ *
 * Chia đoạn (chunking)
 * ------------------------------------------------------------------ */

const TARGET = 800
const MIN = 300
const MAX = 950
const OVERLAP = 100

/** Tách khối theo dòng trống / tiêu đề / điều–khoản. */
function splitBlocks(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let cur: string[] = []
  const flush = () => {
    if (cur.length) {
      const joined = cur.join('\n').trim()
      if (joined) blocks.push(joined)
      cur = []
    }
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      flush()
      continue
    }
    // Tiêu đề / điều / khoản / mục → bắt đầu khối mới.
    if (/^(Điều|ĐIỀU)\s+\d+/.test(t) || /^(Mục|MỤC)\s+\d/.test(t) || /^#{1,4}\s/.test(t) || /^[IVX]+\./.test(t)) {
      flush()
      cur.push(t)
      continue
    }
    cur.push(t)
    if (cur.join('\n').length >= TARGET) flush()
  }
  flush()
  return blocks
}

export interface RawChunk {
  content: string
  page: number | null
  heading: string | null
}

/** Chia văn bản thành các đoạn 600–900 ký tự, chồng lấn ~100 ký tự. */
export function chunkText(text: string): RawChunk[] {
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  const blocks = splitBlocks(clean)
  const out: RawChunk[] = []
  let buf = ''
  const push = (s: string) => {
    const t = s.trim()
    if (t.length < 40) return // quá ngắn, gộp bên dưới
    out.push({ content: t.slice(0, MAX), page: null, heading: null })
  }
  for (const b of blocks) {
    if (!buf) {
      buf = b
    } else if (buf.length + b.length + 1 <= MAX) {
      buf += '\n' + b
    } else {
      push(buf)
      // Chồng lấn ~100 ký tự từ cuối buffer.
      buf = buf.slice(-OVERLAP) + '\n' + b
    }
    if (buf.length >= TARGET) {
      push(buf)
      buf = buf.slice(-OVERLAP)
    }
  }
  if (buf.trim().length >= 40) push(buf)
  return out
}

/* ------------------------------------------------------------------ *
 * Form map: ánh xạ tài liệu thư viện ↔ loại đơn trực tuyến
 * ------------------------------------------------------------------ */

export interface FormMapEntry {
  tenBieuMau: string
  libraryId: string | null
  maLoaiDon: string | null
  tenLoaiDon: string | null
  doTinCay: 'cao' | 'trung-binh' | 'thap'
}

/** So khớp gần đúng tên: đếm token chung giữa tên biểu mẫu và tên loại đơn. */
export function matchFormsToRequestTypes(
  forms: Array<{ id: string; ten: string }>,
  requestTypes: Array<{ ma: string; ten: string }>,
): FormMapEntry[] {
  return forms.map((f) => {
    const ft = new Set(
      normalizeText(f.ten)
        .replace(/^(don|don de nghi|don xin|giay|giay de nghi|giay xin)\b/g, '')
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1),
    )
    let best: { ma: string; ten: string; score: number } | null = null
    for (const rt of requestTypes) {
      const rtTokens = normalizeText(rt.ten).split(/[^a-z0-9]+/).filter((t) => t.length > 1)
      let common = 0
      for (const t of rtTokens) if (ft.has(t)) common += 1
      const score = rtTokens.length ? common / Math.max(ft.size, rtTokens.length) : 0
      if (!best || score > best.score) best = { ma: rt.ma, ten: rt.ten, score }
    }
    const e: FormMapEntry = {
      tenBieuMau: f.ten,
      libraryId: f.id,
      maLoaiDon: null,
      tenLoaiDon: null,
      doTinCay: 'thap',
    }
    if (best && best.score >= 0.7) {
      e.maLoaiDon = best.ma
      e.tenLoaiDon = best.ten
      e.doTinCay = 'cao'
    } else if (best && best.score >= 0.45) {
      e.maLoaiDon = best.ma
      e.tenLoaiDon = best.ten
      e.doTinCay = 'trung-binh'
    }
    return e
  })
}

/** Ghi/nhật kỳ form-map.json (để người dùng rà lại tay). */
export function writeFormMap(entries: FormMapEntry[], file = path.resolve(PUBLIC_ROOT, '../../backend', 'src/modules/chatbot/form-map.json')): void {
  fs.writeFileSync(file, JSON.stringify(entries, null, 2), 'utf8')
}

/* ------------------------------------------------------------------ *
 * Upsert kiến thức
 * ------------------------------------------------------------------ */

export interface IngestProgress {
  documents: number
  chunks: number
  unreadable: string[]
  skipped: number
  embedded: number
  embedErrors: number
}

/** Ma tài liệu: KB-<slug>-<hash8> — hash theo library id + tiêu đề (ổn định). */
function documentCode(libId: string | null, title: string): string {
  const h = sha256(`${libId ?? 'upload'}|${title}`).slice(0, 8)
  return `KB-${slugify(title)}-${h}`
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>
}

/** Tạo embedding theo lô nhỏ, thử lại 1 lần khi lỗi (429). */
async function embedBatch(texts: string[], embedder: Embedder | null, progress: IngestProgress): Promise<(number[] | null)[]> {
  if (!embedder) return texts.map(() => null)
  const out: (number[] | null)[] = []
  const BATCH = 16
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    let vectors: number[][] | null = null
    try {
      vectors = await embedder.embed(slice)
    } catch {
      try {
        await new Promise((r) => setTimeout(r, 800))
        vectors = await embedder.embed(slice)
      } catch {
        vectors = null
      }
    }
    if (!vectors || vectors.length !== slice.length) {
      progress.embedErrors += slice.length
      out.push(...slice.map(() => null))
    } else {
      out.push(...vectors)
      progress.embedded += slice.length
    }
  }
  return out
}

/**
 * Nạp nội dung một tài liệu ĐÃ TỒN TẠI (dùng cho upload của admin).
 * Tạo chunk + embedding, đặt trạng thái READY.
 */
export async function ingestDocumentContent(opts: {
  documentId: string
  title: string
  text: string
  pages?: number
  embedder?: Embedder | null
}): Promise<{ chunkCount: number }> {
  const chunks = chunkText(opts.text)
  const progress: IngestProgress = { documents: 1, chunks: 0, unreadable: [], skipped: 0, embedded: 0, embedErrors: 0 }
  const vectors = await embedBatch(
    chunks.map((c) => c.content),
    opts.embedder ?? null,
    progress,
  )
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId: opts.documentId } }),
    prisma.knowledgeChunk.createMany({
      data: chunks.map((c, i) => ({
        documentId: opts.documentId,
        chunkIndex: i,
        page: c.page ?? opts.pages ?? null,
        heading: c.heading,
        content: c.content,
        ...(vectors[i] ? { embedding: vectors[i] } : {}),
      })),
    }),
    prisma.knowledgeDocument.update({
      where: { id: opts.documentId },
      data: { status: 'READY', errorMessage: null },
    }),
  ])
  return { chunkCount: chunks.length }
}

export interface IngestReport extends IngestProgress {
  formMap: FormMapEntry[]
}

/**
 * Nạp toàn bộ tài liệu thư viện (77 biểu mẫu) + dựng form-map.
 * Chỉ xử lý lại tài liệu khi content_hash thay đổi.
 */
export async function ingestLibraryDocuments(opts: {
  embedder?: Embedder | null
  onProgress?: (p: IngestProgress) => void
} = {}): Promise<IngestReport> {
  const progress: IngestProgress = { documents: 0, chunks: 0, unreadable: [], skipped: 0, embedded: 0, embedErrors: 0 }
  const libs = await prisma.libraryDocument.findMany({ where: { deletedAt: null } })
  const map = new Map(libs.map((l) => [l.url, l]))

  // 1) Với mỗi tài liệu thư viện: upsert KnowledgeDocument + thẻ biểu mẫu.
  for (const lib of libs) {
    const docCode = documentCode(lib.id, lib.ten)
    const cardText = [
      `THẺ BIỂU MẪU. Tên: ${lib.ten}. Nhóm: ${lib.nhom}.`,
      `Mô tả: ${lib.moTa || '(không có mô tả)'}.`,
      `Định dạng tải về: ${lib.loaiTep.toUpperCase()}. Đường dẫn tải: ${lib.url}.`,
    ].join('\n')
    const hash = sha256(cardText)

    const abs = libraryUrlToPath(lib.url)
    let fileText = ''
    let pages: number | undefined
    if (abs) {
      const ex = await extractTextFromFile(abs, lib.loaiTep)
      if (ex && ex.text.trim().length >= 40) {
        fileText = ex.text
        pages = ex.pages
      } else {
        progress.unreadable.push(`${lib.ten} (${lib.loaiTep})`)
      }
    } else {
      progress.unreadable.push(`${lib.ten} (url không hợp lệ: ${lib.url})`)
    }

    const existing = await prisma.knowledgeDocument.findUnique({ where: { ma: docCode } })
    if (existing && existing.contentHash === hash && existing.status === 'READY' && !existing.deletedAt) {
      progress.skipped += 1
      continue
    }

    const fullText = `${cardText}\n\n${fileText}`.trim()
    const doc = await prisma.knowledgeDocument.upsert({
      where: { ma: docCode },
      create: {
        ma: docCode,
        title: lib.ten,
        sourceType: 'LIBRARY',
        libraryDocumentId: lib.id,
        mime: lib.loaiTep,
        contentHash: hash,
        status: 'PROCESSING',
      },
      update: {
        title: lib.ten,
        libraryDocumentId: lib.id,
        mime: lib.loaiTep,
        contentHash: hash,
        status: 'PROCESSING',
        errorMessage: null,
        deletedAt: null,
      },
    })

    const chunks = chunkText(fullText)
    const vectors = await embedBatch(
      chunks.map((c) => c.content),
      opts.embedder ?? null,
      progress,
    )
    await prisma.$transaction([
      prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }),
      prisma.knowledgeChunk.createMany({
        data: chunks.map((c, i) => ({
          documentId: doc.id,
          chunkIndex: i,
          page: pages ?? null,
          heading: null,
          content: c.content,
          ...(vectors[i] ? { embedding: vectors[i] } : {}),
        })),
      }),
      prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: 'READY', errorMessage: null },
      }),
    ])
    progress.documents += 1
    progress.chunks += chunks.length
    opts.onProgress?.(progress)
  }

  // 2) Ánh xạ biểu mẫu ↔ loại đơn trực tuyến.
  const requestTypes = await prisma.requestType.findMany({ select: { ma: true, ten: true } })
  const entries = matchFormsToRequestTypes(
    libs.map((l) => ({ id: l.id, ten: l.ten })),
    requestTypes,
  )
  writeFormMap(entries)

  return { ...progress, formMap: entries }
}
