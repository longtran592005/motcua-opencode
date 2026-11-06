/**
 * Script nạp kiến thức: npm run chatbot:ingest [-- --force]
 * - Chỉ nối CSDL theo DATABASE_URL — chạy trên CSDL TEST (hoặc DEV khi đổi
 *   DATABASE_URL, xem docs/CHATBOT_HUONG_DAN.md mục 3).
 * - Không có GEMINI_API_KEY → chạy chế độ từ-khóa (bỏ qua embedding).
 * - --force: xử lý lại TẤT CẢ tài liệu kể cả không đổi nội dung (bắt buộc khi
 *   đổi GEMINI_EMBED_MODEL — embedding cũ theo mô hình khác phải nạp lại).
 *   ChẶN --force khi không có khóa: sẽ xoá vector cũ mà không tạo được vector
 *   mới.
 * - Phát hiện embedding cũ (mô hình khác mô hình hiện tại) → cảnh báo chạy
 *   --force.
 */
import { getLlmProvider } from '../src/modules/chatbot/llm/provider'
import { ingestLibraryDocuments } from '../src/modules/chatbot/ingest'

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const provider = getLlmProvider()
  const embedder = provider.available() ? provider : null
  if (embedder) {
    process.stdout.write(
      `[chatbot] Có khoá LLM — tạo embedding bằng ${embedder.name}/${(embedder as { embedModel?: string }).embedModel ?? embedder.model}\n`,
    )
  } else {
    process.stdout.write('[chatbot] KHÔNG có GEMINI_API_KEY — chạy chế độ từ-khóa (bỏ qua embedding)\n')
    if (force) {
      process.stderr.write('[chatbot] TỪ CHỐI --force khi không có khóa: sẽ XÓA embedding cũ mà không tạo được vector mới.\n')
      process.exit(1)
    }
  }

  const t0 = Date.now()
  const report = await ingestLibraryDocuments({ embedder, force })
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
  if (report.moHinhEmbedding) {
    process.stdout.write(`[chatbot] Mô hình embedding đã ghi trên chunk: ${report.moHinhEmbedding}\n`)
    if (report.embeddingLao > 0 && !force) {
      process.stderr.write(
        `[chatbot] CẢNH BÁO: ${report.embeddingLao} đoạn có embedding cũ (mô hình và/hoặc số chiều khác ${report.moHinhEmbedding}) — embedding cũ, hãy chạy chatbot:ingest --force để nạp lại.\n`,
      )
    }
  }
  await import('../src/lib/prisma').then((m) => m.prisma.$disconnect())
}

main().catch((e) => {
  process.stderr.write(`[chatbot] LỖI nạp kiến thức: ${(e as Error).message}\n`)
  process.exit(1)
})
