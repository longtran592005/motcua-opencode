/**
 * Script nạp kiến thức: npm run chatbot:ingest
 * - Chỉ nối CSDL theo DATABASE_URL — chạy trên CSDL TEST (không đụng dev).
 * - Không có GEMINI_API_KEY → chạy chế độ từ-khóa (bỏ qua embedding).
 */
import { getLlmProvider } from '../src/modules/chatbot/llm/provider'
import { ingestLibraryDocuments } from '../src/modules/chatbot/ingest'

async function main(): Promise<void> {
  const provider = getLlmProvider()
  const embedder = provider.available() ? provider : null
  if (embedder) process.stdout.write(`[chatbot] Có khoá LLM — tạo embedding bằng ${embedder.name}/${embedder.model}\n`)
  else process.stdout.write('[chatbot] KHÔNG có GEMINI_API_KEY — chạy chế độ từ-khóa (bỏ qua embedding)\n')

  const t0 = Date.now()
  const report = await ingestLibraryDocuments({ embedder })
  process.stdout.write(
    [
      `[chatbot] Xong sau ${Date.now() - t0}ms`,
      ` tài liệu mới/cập nhật: ${report.documents}`,
      ` bỏ qua (không đổi): ${report.skipped}`,
      ` chunk: ${report.chunks}`,
      ` embedding tạo được: ${report.embedded} / lỗi: ${report.embedErrors}`,
      ` không đọc được nội dung: ${report.unreadable.length}`,
    ].join('\n') + '\n',
  )
  for (const u of report.unreadable) process.stdout.write(`  - KHÔNG ĐỌC ĐƯỢC: ${u}\n`)
  const matched = report.formMap.filter((f) => f.maLoaiDon)
  process.stdout.write(`[chatbot] Khớp biểu mẫu ↔ loại đơn: ${matched.length}/${report.formMap.length} (chi tiết backend/src/modules/chatbot/form-map.json)\n`)

  await import('../src/lib/prisma').then((m) => m.prisma.$disconnect())
}

main().catch((e) => {
  process.stderr.write(`[chatbot] LỖI nạp kiến thức: ${(e as Error).message}\n`)
  process.exit(1)
})
