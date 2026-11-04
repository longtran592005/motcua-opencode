/**
 * Nhà cung cấp mô hình ngôn ngữ (Q2):
 * - LLMProvider: interface chung { generate(), embed() }.
 * - GeminiProvider: gọi REST chính thức Google Generative Language API.
 * - FakeProvider: giả lập để kiểm thử (không gọi mạng, ghi lại prompt).
 *
 * Khoá API CHỈ đọc từ biến môi trường GEMINI_API_KEY (backend/.env).
 * Không có khoá hoặc lỗi/hết hạn mức → caller chuyển MODE chỉ-tìm-kiếm,
 * provider không ném lỗi trần trụi ra ngoài giao diện.
 */

import { env } from '../../../config/env'

export interface GenerateInput {
  /** Lời nhắc hệ thống (vai trò + luật). */
  system: string
  /** Câu hỏi + dữ liệu NGUỒN + KẾT QUẢ CÔNG CỤ. */
  prompt: string
  /** Giới hạn token đầu ra. */
  maxOutputTokens?: number
  /** JSON thô để mô hình trả về dạng JSON. */
  jsonMode?: boolean
}

export interface LLMProvider {
  readonly name: string
  readonly model: string
  /** Có sẵn để gọi thật không (khoá hợp lệ). */
  available(): boolean
  generate(input: GenerateInput): Promise<string>
  /** Mỗi lượt gọi trả về một vector float. */
  embed(texts: string[]): Promise<number[][]>
}

const GENERATE_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
const EMBED_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`

/** Lỗi HTTP/HTTP2 từ Gemini — dùng để phân loại suy giảm. */
export class LlmError extends Error {
  readonly status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'LlmError'
    this.status = status
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini'
  readonly model: string
  private readonly apiKey: string | undefined
  private readonly embedModel: string

  constructor(opts?: { apiKey?: string; model?: string; embedModel?: string }) {
    this.apiKey = opts?.apiKey ?? env.GEMINI_API_KEY
    this.model = opts?.model ?? env.GEMINI_MODEL
    this.embedModel = opts?.embedModel ?? env.GEMINI_EMBED_MODEL
  }

  available(): boolean {
    return Boolean(this.apiKey)
  }

  async generate(input: GenerateInput): Promise<string> {
    if (!this.apiKey) throw new LlmError('Thiếu GEMINI_API_KEY', 503)
    const res = await fetch(`${GENERATE_URL(this.model)}?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        systemInstruction: { parts: [{ text: input.system }] },
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: input.maxOutputTokens ?? 1024,
          ...(input.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (res.status === 429) throw new LlmError('Gemini hết hạn mức (429)', 429)
    if (!res.ok) throw new LlmError(`Gemini trả HTTP ${res.status}`, res.status)
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text.trim()) throw new LlmError('Gemini trả nội dung rỗng', 502)
    return text
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) throw new LlmError('Thiếu GEMINI_API_KEY', 503)
    const out: number[][] = []
    for (const t of texts) {
      const res = await fetch(`${EMBED_URL(this.embedModel)}?key=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.embedModel}`,
          content: { parts: [{ text: t.slice(0, 6000) }] },
        }),
        signal: AbortSignal.timeout(20_000),
      })
      if (res.status === 429) throw new LlmError('Gemini hết hạn mức (429)', 429)
      if (!res.ok) throw new LlmError(`Gemini embed trả HTTP ${res.status}`, res.status)
      const data = (await res.json()) as { embedding?: { values?: number[] } }
      out.push(data.embedding?.values ?? [])
    }
    return out
  }

  /** Liệt kê mô hình có sẵn — dùng lúc khởi động để cảnh báo tên sai. */
  async listModels(): Promise<string[]> {
    if (!this.apiKey) return []
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}&pageSize=100`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) throw new LlmError(`Liệt kê mô hình trả HTTP ${res.status}`, res.status)
    const data = (await res.json()) as { models?: Array<{ name?: string }> }
    return (data.models ?? []).map((m) => (m.name ?? '').replace(/^models\//, ''))
  }
}

/**
 * Nhà cung cấp giả cho kiểm thử: KHÔNG gọi mạng.
 * - generate(): trả JSON {answer, can_answer, cited_source_ids} dựa trên dữ liệu
 *   NGUỒN có trong prompt; ghi lại toàn bộ prompt để test kiểm tra đã che PII.
 * - embed(): băm đơn giản 32 chiều (deterministic) để thử vector.
 */
export class FakeProvider implements LLMProvider {
  readonly name = 'fake'
  readonly model = 'fake-model'
  available(): boolean {
    return true
  }
  /** Prompt gần nhất (mục đích kiểm thử riêng tư). */
  lastPrompt: { system: string; prompt: string } | null = null
  prompts: Array<{ system: string; prompt: string }> = []

  async generate(input: GenerateInput): Promise<string> {
    this.prompts.push({ system: input.system, prompt: input.prompt })
    this.lastPrompt = { system: input.system, prompt: input.prompt }
    const noData = /chưa có đoạn nào|<NGUỒN-rỗng>/.test(input.prompt)
    if (noData) {
      return JSON.stringify({
        answer: 'Tôi chưa tìm thấy thông tin này trong tài liệu của trường.',
        can_answer: false,
        cited_source_ids: [],
      })
    }
    return JSON.stringify({
      answer: '(Giả lập) Câu trả lời dựa trên nguồn truy xuất ở phía dưới.',
      can_answer: true,
      cited_source_ids: [],
    })
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      // Phép chiếu ngẫu nhiên 32 chiều (deterministic) có trung bình ~0:
      // chữ trùng nhau → giống hệt nhau; chữ không liên quan → cosine ~0.
      // (nếu chỉ đếm vào 1 bucket thì chữ RẤT khác nhau vẫn cho cosine cao
      // do sai lệch dương — sẽ phá ngưỡng CHAT_MIN_SCORE trong kiểm thử).
      const v = new Array<number>(32).fill(0)
      for (const tok of t.toLowerCase().split(/\s+/)) {
        if (!tok) continue
        let h = 0
        for (let i = 0; i < tok.length; i += 1) h = (h * 31 + tok.charCodeAt(i)) >>> 0
        v[h % 32] += 1
        v[(h >>> 8) % 32] -= 1
      }
      const norm = Math.hypot(...v) || 1
      return v.map((x) => x / norm)
    })
  }
}

/* ------------------------------------------------------------------ *
 * Chọn provider theo runtime.
 * ------------------------------------------------------------------ */

type ProviderFactory = () => LLMProvider

let providerOverride: LLMProvider | null = null

export function setLlmProviderForTest(p: LLMProvider | null): void {
  providerOverride = p
}

export function getLlmProvider(): LLMProvider {
  if (providerOverride) return providerOverride
  return new GeminiProvider()
}

/** Kiểm tra tên mô hình lúc khởi động — không làm sập ứng dụng. */
export async function warnIfModelMissing(provider: LLMProvider): Promise<void> {
  const p = provider as GeminiProvider
  if (p.name !== 'gemini' || !p.available()) return
  try {
    const names = await p.listModels()
    if (names.length && !names.includes(p.model)) {
      process.stderr.write(
        `[chatbot] CẢNH BÁO: mô hình "${p.model}" không có trong danh sách mô hình Gemini.\n`,
      )
    }
  } catch (e) {
    process.stderr.write(`[chatbot] Không kiểm tra được danh sách mô hình Gemini: ${(e as Error).message}\n`)
  }
}
