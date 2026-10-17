/**
 * Các thao tác OpenAPI chưa được cài trên backend.
 * Giữ trong bộ test dưới dạng it.todo — KHÔNG xóa khỏi ma trận.
 * File này được sinh bởi scripts/coverage-matrix.ts
 */
import { describe, it } from 'vitest'

describe('Thao tác OpenAPI chưa làm — giữ TODO', () => {
  it.todo('GET /documents/{id}/export — Xuất văn bản để tải/in (chưa làm; Giai đoạn báo cáo / xuất tệp (sau))')
  it.todo('GET /documents/report — Tổng quan báo cáo thống kê (chưa làm; Giai đoạn báo cáo / xuất tệp (sau))')
  it.todo('GET /documents/report/rows — Các bảng số liệu chi tiết của báo cáo (chưa làm; Giai đoạn báo cáo / xuất tệp (sau))')
  it.todo('GET /files/{fileToken} — Tải tệp nhị phân bằng liên kết có chữ ký (KHÔNG bọc phong bì) (chưa làm; Giai đoạn lưu trữ tệp (sau))')
  it.todo('GET /templates — Danh sách mẫu văn bản (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('POST /templates — Tạo mẫu văn bản (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('GET /templates/{ma} — Chi tiết mẫu theo mã (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('PATCH /templates/{ma} — Cập nhật mẫu văn bản (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('DELETE /templates/{ma} — Xoá mẫu văn bản (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('POST /templates/{ma}/render — Kết xuất mẫu với bộ giá trị cho trước (chưa làm; Giai đoạn mẫu văn bản (sau))')
  it.todo('GET /notifications/stream — Kênh SSE chuông thông báo realtime (KHÔNG bọc phong bì) (chưa làm; Giai đoạn thông báo realtime (sau))')
  it.todo('POST /chat/stream — Hỏi trợ lý ảo, trả lời dạng streaming SSE (KHÔNG bọc phong bì) (chưa làm; Giai đoạn trợ lý ảo (sau))')
  it.todo('GET /chat/suggestions — Câu hỏi gợi ý (chưa làm; Giai đoạn trợ lý ảo (sau))')
  it.todo('POST /chat/messages/{messageId}/feedback — Đánh giá câu trả lời hữu ích / không hữu ích (chưa làm; Giai đoạn trợ lý ảo (sau))')
  it.todo('GET /catalog/khoa/{ma} — Chi tiết khoa theo mã (chưa làm; Giai đoạn hoàn thiện danh mục (sau))')
  it.todo('GET /catalog/phong-ban/{ma} — Chi tiết phòng ban theo mã (chưa làm; Giai đoạn hoàn thiện danh mục (sau))')
  it.todo('GET /catalog/nganh/{ma} — Chi tiết ngành theo mã (chưa làm; Giai đoạn hoàn thiện danh mục (sau))')
  it.todo('GET /catalog/lop/{ma} — Chi tiết lớp theo mã (chưa làm; Giai đoạn hoàn thiện danh mục (sau))')
  it.todo('GET /catalog/khoa-hoc/{ma} — Chi tiết khóa học theo mã (chưa làm; Giai đoạn hoàn thiện danh mục (sau))')
})
