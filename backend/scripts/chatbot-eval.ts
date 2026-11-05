/**
 * Đánh giá chất lượng truy xuất chatbot: npm run chatbot:eval
 * - Nạp bộ câu hỏi docs/chatbot-eval.json: 3 nhóm — (I) bamTen (bám tên tài
 *   liệu, 30 câu), (II) tuNhien (không sao tên tài liệu, 30 câu), (III)
 *   ngoaiPhamVi (20 câu — kỳ vọng BỊ TỪ CHỐI).
 * - Chạy ở chế độ từ-khóa (phủ-IDF + RRF) trên CSDL theo DATABASE_URL — chỉ
 *   nên chạy trên CSDL TEST. Từ chối = searchKnowledge không trả kết quả với
 *   minScore = CHAT_MIN_SCORE (giống thời điểm chạy thật).
 * - In 3 chỉ số riêng: (i) top-3 bamTen, (ii) top-3 tuNhien, (iii) tỷ lệ bị
 *   từ chối của ngoaiPhamVi. Không gọi mô hình, khỏi cần GEMINI_API_KEY.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prisma } from '../src/lib/prisma'
import { env } from '../src/config/env'
import { reloadKnowledgeIndex, searchKnowledge } from '../src/modules/chatbot/retrieval'

interface CauHoi {
  cauHoi: string
  taiLieu?: string
}
interface Bank {
  moTa: string
  mucTieu: { bamTen: number; tuNhien: number; ngoaiPhamVi: number }
  bamTen: CauHoi[]
  tuNhien: CauHoi[]
  ngoaiPhamVi: CauHoi[]
}

const MIN_SCORE = env.CHAT_MIN_SCORE

function bang(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

async function chamTop3(nhom: string, ds: CauHoi[]): Promise<{
  soCau: number
  dungTop3: number
  tyLe: number
  mucTieu: number
  dat: boolean
  chiTiet: Array<{ stt: number; cauHoi: string; taiLieu: string; top: Array<[string, number]>; haiTop3: boolean }>
}> {
  const chiTiet: Array<{ stt: number; cauHoi: string; taiLieu: string; top: Array<[string, number]>; haiTop3: boolean }> = []
  for (let i = 0; i < ds.length; i += 1) {
    const q = ds[i]!
    const results = await searchKnowledge(q.cauHoi, { topK: 3 })
    const mucTieu = bang(q.taiLieu ?? '')
    const hit = results.some((r) => bang(r.docTitle).includes(mucTieu) || mucTieu.includes(bang(r.docTitle)))
    chiTiet.push({
      stt: i + 1,
      cauHoi: q.cauHoi,
      taiLieu: q.taiLieu ?? '',
      top: results.map((r) => [r.docTitle, r.score]),
      haiTop3: hit,
    })
  }
  const dung = chiTiet.filter((r) => r.haiTop3).length
  const tyLe = chiTiet.length ? dung / chiTiet.length : 0
  const mucTieu = nhom === 'tuNhien' ? env_nhungMucTieu.tuNhien : env_nhungMucTieu.bamTen
  return {
    soCau: chiTiet.length,
    dungTop3: dung,
    tyLe: Number(tyLe.toFixed(4)),
    mucTieu,
    dat: tyLe >= mucTieu,
    chiTiet,
  }
}

// (đặt sau khi đọc bank — xem main())
let env_nhungMucTieu = { bamTen: 0.8, tuNhien: 0.7, ngoaiPhamVi: 0.85 }

interface ChiTietTuChoi {
  stt: number
  cauHoi: string
  top: Array<[string, number]>
  daTuChoi: boolean
}

async function chamNgoaiPhamVi(ds: CauHoi[]): Promise<{
  soCau: number
  tuChoiDung: number
  tyLe: number
  mucTieu: number
  dat: boolean
  chiTiet: ChiTietTuChoi[]
}> {
  const chiTiet: ChiTietTuChoi[] = []
  for (let i = 0; i < ds.length; i += 1) {
    const q = ds[i]!
    const results = await searchKnowledge(q.cauHoi, { topK: 3, minScore: MIN_SCORE })
    chiTiet.push({
      stt: i + 1,
      cauHoi: q.cauHoi,
      top: results.map((r) => [r.docTitle, r.score]),
      daTuChoi: results.length === 0,
    })
  }
  const dung = chiTiet.filter((r) => r.daTuChoi).length
  const tyLe = chiTiet.length ? dung / chiTiet.length : 0
  return {
    soCau: chiTiet.length,
    tuChoiDung: dung,
    tyLe: Number(tyLe.toFixed(4)),
    mucTieu: env_nhungMucTieu.ngoaiPhamVi,
    dat: tyLe >= env_nhungMucTieu.ngoaiPhamVi,
    chiTiet,
  }
}

function inKetQua(name: string, kq: { soCau: number; tyLe: number; mucTieu: number; dat: boolean }): void {
  process.stdout.write(
    `\n[chatbot:eval] ${name}: tỷ lệ = ${(kq.tyLe * 100).toFixed(1)}% (mục tiêu ≥ ${(kq.mucTieu * 100).toFixed(0)}% → ${kq.dat ? 'ĐẠT' : 'KHÔNG ĐẠT'})\n`,
  )
}

async function main(): Promise<void> {
  const bankPath = resolve(process.cwd(), '..', 'docs', 'chatbot-eval.json')
  const bank = JSON.parse(readFileSync(bankPath, 'utf8')) as Bank
  env_nhungMucTieu = bank.mucTieu
  // canh báo trùng tài liệu đích trong cùng nhóm
  for (const [ten, ds] of [['bamTen', bank.bamTen], ['tuNhien', bank.tuNhien]] as const) {
    const docs = ds.map((c) => bang(c.taiLieu ?? ''))
    if (new Set(docs).size !== docs.length) {
      process.stderr.write(`[eval] CẢNH BÁO: nhóm ${ten} có câu trỏ vào cùng một tài liệu.\n`)
    }
  }
  await reloadKnowledgeIndex()

  const resultBamTen = await chamTop3('bamTen', bank.bamTen)
  const resultTuNhien = await chamTop3('tuNhien', bank.tuNhien)
  const resultNgoai = await chamNgoaiPhamVi(bank.ngoaiPhamVi)

  const out: Record<string, unknown> = {
    thoiGian: new Date().toISOString(),
    minScore: MIN_SCORE,
    bamTen: resultBamTen,
    tuNhien: resultTuNhien,
    ngoaiPhamVi: resultNgoai,
  }
  const ketQuaPath = resolve(process.cwd(), '..', 'docs', 'chatbot-eval-results.json')
  writeFileSync(ketQuaPath, JSON.stringify(out, null, 2), 'utf8')

  process.stdout.write(`[chatbot:eval] Kết quả đánh giá truy xuất (phủ-IDF + RRF, minScore=${MIN_SCORE}):\n`)
  for (const r of resultBamTen.chiTiet) {
    process.stdout.write(
      `${r.haiTop3 ? '✓' : '✗'} I.${String(r.stt).padStart(2)} ${r.cauHoi.slice(0, 52).padEnd(54)} → ` +
        (r.top[0] ? `${r.top[0][0].slice(0, 38)} (${r.top[0][1].toFixed(2)})` : '(không có kết quả)') + '\n',
    )
  }
  for (const r of resultTuNhien.chiTiet) {
    process.stdout.write(
      `${r.haiTop3 ? '✓' : '✗'} II.${String(r.stt).padStart(2)} ${r.cauHoi.slice(0, 50).padEnd(54)} → ` +
        (r.top[0] ? `${r.top[0][0].slice(0, 38)} (${r.top[0][1].toFixed(2)})` : '(không có kết quả)') + '\n',
    )
  }
  for (const r of resultNgoai.chiTiet) {
    process.stdout.write(
      `${r.daTuChoi ? '✓(từ chối)' : '✗(trôi qua)'} III.${String(r.stt).padStart(2)} ${r.cauHoi.slice(0, 46).padEnd(54)} → ` +
        (r.top[0] ? `${r.top[0][0].slice(0, 36)} (${r.top[0][1]!.toFixed(2)})` : '') + '\n',
    )
  }
  inKetQua('(i) top-3 câu bám-tên-tài liệu', resultBamTen)
  inKetQua('(ii) top-3 câu tự nhiên', resultTuNhien)
  inKetQua('(iii) tỷ lệ câu ngoài phạm vi bị từ chối', resultNgoai)
  process.stdout.write('[chatbot:eval] Chi tiết lưu tại docs/chatbot-eval-results.json\n')

  await prisma.$disconnect()
  if (!resultBamTen.dat || !resultTuNhien.dat || !resultNgoai.dat) process.exitCode = 1
}

main().catch((e) => {
  process.stderr.write(`[chatbot:eval] LỖI: ${(e as Error).message}\n`)
  process.exit(1)
})
