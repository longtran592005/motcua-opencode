/**
 * Đánh giá chất lượng truy xuất chatbot: npm run chatbot:eval
 * - Bám bộ câu hỏi docs/chatbot-eval.json (30 câu).
 * - Chạy ở chế độ từ-khóa (BM25 + RRF) trên CSDL theo DATABASE_URL — chỉ nên
 *   chạy trên CSDL TEST. Tiêu chí: tài liệu đúng nằm trong top-3 cho ≥ 80% câu.
 * - Không gọi mô hình, khỏi cần GEMINI_API_KEY.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prisma } from '../src/lib/prisma'
import { reloadKnowledgeIndex, searchKnowledge } from '../src/modules/chatbot/retrieval'

interface CauHoi {
  cauHoi: string
  taiLieu: string
}
interface Bank {
  moTa: string
  tiêuChiTop3: number
  cauHoi: CauHoi[]
}

function bang(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

async function main(): Promise<void> {
  const bankPath = resolve(process.cwd(), '..', 'docs', 'chatbot-eval.json')
  const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as Bank
  const docs = bank.cauHoi.map((c) => bang(c.taiLieu))
  if (new Set(docs).size !== docs.length) {
    process.stderr.write('[eval] CẢNH BÁO: một số câu hỏi trỏ vào cùng một tài liệu.\n')
  }
  await reloadKnowledgeIndex()

  const rows: Array<{ stt: number; cauHoi: string; taiLieu: string; top: Array<[string, number]>; haiTop3: boolean }> = []
  for (let i = 0; i < bank.cauHoi.length; i += 1) {
    const q = bank.cauHoi[i]!
    const results = await searchKnowledge(q.cauHoi, { topK: 3 })
    const hit = results.some((r) => bang(r.docTitle).includes(bang(q.taiLieu)) || bang(q.taiLieu).includes(bang(r.docTitle)))
    rows.push({
      stt: i + 1,
      cauHoi: q.cauHoi,
      taiLieu: q.taiLieu,
      top: results.map((r) => [r.docTitle, r.score]),
      haiTop3: hit,
    })
  }

  const hits = rows.filter((r) => r.haiTop3).length
  const tyLe = hits / rows.length
  const out: Record<string, unknown> = {
    thoiGian: new Date().toISOString(),
    soCauHoi: rows.length,
    dungTop3: hits,
    tyLe: Number(tyLe.toFixed(4)),
    tiêuChi: bank.tiêuChiTop3,
    dat: tyLe >= bank.tiêuChiTop3,
    chiTiet: rows,
  }
  const ketQuaPath = resolve(process.cwd(), '..', 'docs', 'chatbot-eval-results.json')
  writeFileSync(ketQuaPath, JSON.stringify(out, null, 2), 'utf8')

  process.stdout.write('[chatbot:eval] Kết quả đánh giá truy xuất (chế độ từ-khóa):\n')
  for (const r of rows) {
    process.stdout.write(
      `${r.haiTop3 ? '✓' : '✗'} ${String(r.stt).padStart(2)}. ${r.cauHoi.slice(0, 52).padEnd(54)} → ` +
        (r.top[0] ? `${r.top[0][0].slice(0, 38)} (${r.top[0][1].toFixed(2)})` : '(không có kết quả)') +
        '\n',
    )
  }
  process.stdout.write(`\n[chatbot:eval] Top-3 đúng: ${hits}/${rows.length} = ${(tyLe * 100).toFixed(1)}% (tiêu chí ≥ ${(bank.tiêuChiTop3 * 100).toFixed(0)}% → ${tyLe >= bank.tiêuChiTop3 ? 'ĐẠT' : 'KHÔNG ĐẠT'})\n`)
  process.stdout.write(`[chatbot:eval] Chi tiết lưu tại docs/chatbot-eval-results.json\n`)

  await prisma.$disconnect()
  if (tyLe < bank.tiêuChiTop3) process.exitCode = 1
}

main().catch((e) => {
  process.stderr.write(`[chatbot:eval] LỖI: ${(e as Error).message}\n`)
  process.exit(1)
})
