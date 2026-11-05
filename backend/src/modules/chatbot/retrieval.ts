/**
 * Truy xuất kiến thức lai (Q3): BM25 tự cài + cosine vector (embedding lưu
 * jsonb) hợp nhất bằng Reciprocal Rank Fusion.
 *
 * - Chỉ mục dựng trong bộ nhớ từ bảng knowledge_chunks (JOIN knowledge_documents
 *   có trạng thái READY, chưa xóa mềm). Nạp lại được khi kiến thức thay đổi.
 * - Chunk chưa có embedding vẫn tìm được bằng BM25.
 * - Điểm cuối trong [0,1] để so với CHAT_MIN_SCORE: điểm BM25 là "độ phủ từ
 *   khóa hữu ích có trọng số IDF" (tuyệt đối, không chuẩn hóa theo max); hợp
 *   cả hai nguồn thì 0.6*phủ-từ-khóa + 0.4*cosine; chỉ vector thì dùng cosine
 *   clamp [0,1]. Thứ tự chọn ứng viên theo RRF, thứ hạng cuối theo điểm.
 */
import { prisma } from '../../lib/prisma'
import { keywords, tokenize } from './vietnamese'

export interface RetrievedChunk {
  chunkId: string
  documentId: string
  docMa: string
  docTitle: string
  sourceType: string
  libraryDocumentId: string | null
  page: number | null
  heading: string | null
  content: string
}

export interface SearchResult extends RetrievedChunk {
  score: number
  /** Điểm phủ từ khóa hữu ích tuyệt đối [0,1] (trọng số IDF + bão hòa tf). */
  kwScore: number
  /** Cosine similarity clamp [0,1], null khi chunk/query không có embedding. */
  vecScore: number | null
  /** Hạng theo RRF (bắt đầu 1). */
  rank: number
}

interface IndexedChunk {
  chunkId: string
  documentId: string
  docMa: string
  docTitle: string
  sourceType: string
  libraryDocumentId: string | null
  page: number | null
  heading: string | null
  content: string
  /** Token đã lọc từ đệm. */
  tokens: string[]
  tf: Map<string, number>
  length: number
  embedding: number[] | null
}

interface IndexState {
  chunks: IndexedChunk[]
  /** Tần suất token xuất hiện ở bao nhiêu chunk (BM25 IDF). */
  df: Map<string, number>
  avgLen: number
  loadedAt: number
}

const K1 = 1.5
const B = 0.75
/** Hằng số RRF chuẩn. */
const RRF_K = 60
const MAX_CONTENT_CHARS = 12_000

let index: IndexState | null = null
let loading: Promise<{ chunkCount: number; documentCount: number }> | null = null

export function getIndexStatus(): { loaded: boolean; chunkCount: number; documentCount: number; loadedAt: number } {
  if (!index) return { loaded: false, chunkCount: 0, documentCount: 0, loadedAt: 0 }
  const docs = new Set(index.chunks.map((c) => c.documentId))
  return { loaded: true, chunkCount: index.chunks.length, documentCount: docs.size, loadedAt: index.loadedAt }
}

/**
 * Nạp lại chỉ mục từ CSDL. Gọi lúc khởi động, sau khi nạp kiến thức,
 * sau tải lên/xóa/bật-tắt tài liệu, và sau lập chỉ mục lại.
 */
export async function reloadKnowledgeIndex(): Promise<{ chunkCount: number; documentCount: number }> {
  // Tránh nạp song song: dùng chung một promise.
  if (loading) return loading
  loading = (async () => {
    const rows = await prisma.knowledgeChunk.findMany({
      where: { document: { status: 'READY', deletedAt: null } },
      select: {
        id: true,
        documentId: true,
        page: true,
        heading: true,
        content: true,
        embedding: true,
        document: { select: { ma: true, title: true, sourceType: true, libraryDocumentId: true } },
      },
      orderBy: { documentId: 'asc' },
    })
    const chunks: IndexedChunk[] = []
    const df = new Map<string, number>()
    let totalLen = 0
    for (const r of rows) {
      let embedding: number[] | null = null
      if (Array.isArray(r.embedding) && r.embedding.every((x) => typeof x === 'number')) {
        embedding = r.embedding as number[]
      }
      const content = r.content.length > MAX_CONTENT_CHARS ? r.content.slice(0, MAX_CONTENT_CHARS) : r.content
      const terms = tokenize(`${r.heading ?? ''} ${content}`).filter((t) => t.length > 1)
      const tf = new Map<string, number>()
      const seen = new Set<string>()
      for (const t of terms) {
        tf.set(t, (tf.get(t) ?? 0) + 1)
        if (!seen.has(t)) seen.add(t)
      }
      for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1)
      totalLen += terms.length
      chunks.push({
        chunkId: r.id,
        documentId: r.documentId,
        docMa: r.document.ma,
        docTitle: r.document.title,
        sourceType: r.document.sourceType,
        libraryDocumentId: r.document.libraryDocumentId,
        page: r.page,
        heading: r.heading,
        content,
        tokens: terms,
        tf,
        length: terms.length,
        embedding,
      })
    }
    index = { chunks, df, avgLen: chunks.length ? totalLen / chunks.length : 0, loadedAt: Date.now() }
    const docs = new Set(chunks.map((c) => c.documentId))
    return { chunkCount: chunks.length, documentCount: docs.size }
  })()
  try {
    return await loading
  } catch (e) {
    index = null
    throw e
  } finally {
    loading = null
  }
}

/** Bảo đảm chỉ mục đã nạp (nạp lười khi chưa). */
export async function ensureKnowledgeIndex(): Promise<void> {
  if (!index) await reloadKnowledgeIndex()
}

/** Băm IDF chuẩn BM25. */
function idf(df: number, n: number): number {
  return Math.log(1 + (n - df + 0.5) / (df + 0.5))
}

/** BM25 của một chunk với bộ token truy vấn (chỉ token không đệm). */
function bm25Score(chunk: IndexedChunk, queryTerms: string[], dfs: Map<string, number>, n: number, avgLen: number): number {
  if (!queryTerms.length || chunk.length === 0) return 0
  let s = 0
  for (const t of queryTerms) {
    const f = chunk.tf.get(t)
    if (!f) continue
    const d = dfs.get(t) ?? 0
    s += idf(d, n) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (chunk.length / (avgLen || 1)))))
  }
  return s
}

/** Chẩn đoán: điểm BM25 tuyệt đối của top-5 chunk cho một truy vấn. */
export function bm25Debug(query: string): Array<{ docTitle: string; raw: number }> {
  const state = index
  if (!state) return []
  const qTerms = keywords(query)
  if (!qTerms.length) return []
  const out: Array<{ docTitle: string; raw: number }> = []
  for (const c of state.chunks) {
    const raw = bm25Score(c, qTerms, state.df, state.chunks.length, state.avgLen)
    if (raw > 0) out.push({ docTitle: c.docTitle, raw: Number(raw.toFixed(3)) })
  }
  return out.sort((a, b) => b.raw - a.raw).slice(0, 5)
}

function cosine(a: number[] | null, b: number[] | null): number | null {
  if (!a || !b || a.length === 0 || a.length !== b.length) return null
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (!denom) return null
  return Math.max(-1, Math.min(1, dot / denom))
}

export interface SearchOptions {
  topK?: number
  minScore?: number
  /** Embeddings truy vấn (nếu có) — cùng chiều với embedding chunk. */
  queryEmbedding?: number[] | null
}

/**
 * Điểm BM25 KHÔNG còn chuẩn hóa theo max của tập truy xuất (nguồn điểm giả
 * nhường đầu bảng). Thay bằng "độ phủ từ khóa hữu ích có trọng số IDF":
 * - Từ khóa hữu ích = từ không đệm và tần suất tài liệu df < 60% số đoạn.
 * - Trọng số w(t) = min(1, idf(t)/idfRef), idfRef = idf của từ hiếm nhất có thể
 *   đạt (df=1) — từ phổ biến ("điều kiện", "quy trình", "xin", "đơn") trọng số
 *   thấp, từ hiếm ~1.
 * - Điểm đoạn = Σ w(t) với t CÓ TRONG đoạn / Σ w(t) toàn bộ từ hữu ích
 *   (tỷ lệ trọng số từ khóa được phủ; tf/độ dài để dành cho BM25 thô xếp hạng).
 * ⇒ Điểm nằm trong [0,1] TUYỆT ĐỐI: ngưỡng CHAT_MIN_SCORE có nghĩa thật,
 * câu hỏi ngoài phạm vi không thể đạt ngưỡng chỉ nhờ xếp đầu.
 */
/**
 * Tìm kiếm lai: trả tối đa topK kết quả có điểm >= minScore.
 * Không bao giờ ném lỗi — lỗi nạp chỉ mục trả về danh sách rỗng (an toàn).
 */
export async function searchKnowledge(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResult[]> {
  const topK = Math.max(1, opts.topK ?? 5)
  const minScore = opts.minScore ?? 0
  let state = index
  if (!state) {
    try {
      await reloadKnowledgeIndex()
      state = index
    } catch {
      return []
    }
  }
  if (!state || state.chunks.length === 0) return []

  const qTerms = keywords(query)
  const n = state.chunks.length
  const dfs = state.df
  const avgLen = state.avgLen

  // Q3: TỪ KHÓA HỮU ÍCH = token không đệm của truy vấn có df < 60% số đoạn —
  // loại bỏ từ phổ biến ("điều kiện", "quy trình", "xin", "đơn") hiện ở hầu hết
  // đoạn. Trọng số IDF chuẩn hóa theo idfRef = idf của từ HIẾM NHẤT CÓ THỂ ĐẠT
  // (df=1 đoạn/334→≈5.4): từ xuất hiện ở 1 đoạn w=1, từ phổ biến w thấp.
  const idfRef = Math.log(1 + (n - 0.5) / 1.5)
  const useful: Array<{ t: string; w: number }> = []
  let weightSum = 0
  for (const t of new Set(qTerms)) {
    const df = dfs.get(t) ?? 0
    if (df >= 0.6 * n) continue
    const w = Math.min(1, idf(df, n) / idfRef)
    useful.push({ t, w })
    weightSum += w
  }

  // Barem BM25 thô cho mọi chunk có term trùng — dùng cho RRF xếp hạng (không
  // phải để chuẩn hóa theo max như cũ).
  const kwScores = new Map<string, number>()
  if (qTerms.length) {
    const qSet = new Set(qTerms)
    for (const c of state.chunks) {
      let has = false
      for (const t of qSet) if (c.tf.has(t)) { has = true; break }
      if (!has) continue
      const s = bm25Score(c, qTerms, dfs, n, avgLen)
      if (s > 0) kwScores.set(c.chunkId, s)
    }
  }

  // Điểm phủ từ khóa TUYỆT ĐỐI [0,1] của một chunk: Σ w(t) với t xuất hiện trong
  // chunk / Σ w(t) trên TẤT CẢ từ hữu ích (= tỷ lệ trọng số từ khóa được phủ).
  // Nghĩa tuyệt đối: ô trọn mọi từ hiếm → ~1; chỉ tràn từ phổ biến → thấp (bị
  // lọc df hoặc trọng số nhỏ). TF/độ dài không vào điểm này — đó là việc của
  // BM25 thô ở phần xếp hạng RRF.
  const coverageScore = (c: IndexedChunk): number => {
    if (weightSum <= 0) return 0
    let sum = 0
    for (const { t, w } of useful) if (c.tf.has(t)) sum += w
    return sum / weightSum
  }

  // Vector: cosine truy vấn/chunk.
  const vecScores = new Map<string, number>()
  if (opts.queryEmbedding && opts.queryEmbedding.length) {
    for (const c of state.chunks) {
      const sim = cosine(opts.queryEmbedding, c.embedding)
      if (sim !== null && sim > 0) vecScores.set(c.chunkId, sim)
    }
  }

  // RRF: xếp hạng hai danh sách rồi hợp nhất.
  const kwRank = [...kwScores.entries()].sort((a, b) => b[1] - a[1])
  const vecRank = [...vecScores.entries()].sort((a, b) => b[1] - a[1])
  const rrf = new Map<string, { rrf: number; vec: number | null }>()
  kwRank.forEach(([id], i) => {
    const cur = rrf.get(id) ?? { rrf: 0, vec: null as number | null }
    cur.rrf += 1 / (RRF_K + i + 1)
    rrf.set(id, cur)
  })
  vecRank.forEach(([id, s], i) => {
    const cur = rrf.get(id) ?? { rrf: 0, kw: 0, vec: null as number | null }
    cur.rrf += 1 / (RRF_K + i + 1)
    cur.vec = s
    rrf.set(id, cur)
  })

  // Ứng viên = hợp của top BM25 và top vector (mỗi phía cắt topK) — bảo đảm
  // chunk khớp từ khóa mạnh nhất và chunk vector-gần nhất đều vào vòng chấm điểm.
  const candIds = [...new Set([...kwRank.slice(0, topK), ...vecRank.slice(0, topK)].map(([id]) => id))]
  const candidates = [...rrf.entries()].filter(([id]) => candIds.includes(id))
  const byId = new Map(state.chunks.map((c) => [c.chunkId, c]))
  const out: SearchResult[] = []
  for (const [id, m] of candidates) {
    const c = byId.get(id)
    if (!c) continue
    const kwAbs = weightSum > 0 ? coverageScore(c) : 0
    const vec = m.vec
    let score: number
    if (vec !== null && kwAbs > 0) score = 0.6 * kwAbs + 0.4 * vec
    else if (kwAbs > 0) score = kwAbs
    else if (vec !== null) score = vec
    else score = 0
    if (score < minScore) continue
    out.push({
      chunkId: c.chunkId,
      documentId: c.documentId,
      docMa: c.docMa,
      docTitle: c.docTitle,
      sourceType: c.sourceType,
      libraryDocumentId: c.libraryDocumentId,
      page: c.page,
      heading: c.heading,
      content: c.content,
      score: Number(score.toFixed(4)),
      kwScore: Number(kwAbs.toFixed(4)),
      vecScore: vec === null ? null : Number(vec.toFixed(4)),
      rank: 0,
    })
  }
  // Cắt topK theo ĐIỂM (RRF chỉ để chọn ứng viên; điểm quyết định thứ hạng).
  out.sort((a, b) => b.score - a.score)
  const final = out.slice(0, topK)
  final.forEach((r, i) => {
    r.rank = i + 1
  })
  return final
}
