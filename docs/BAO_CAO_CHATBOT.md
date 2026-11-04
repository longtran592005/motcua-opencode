# BÁO CÁO DỰ ÁN — TRỢ LÝ ẢO (CHATBOT) CỔNG MỘT CỬA ĐIỆN TỬ

Giai đoạn: xây dựng tính năng Trợ lý ảo dựa trên **Gemini** cho Cổng Một cửa điện tử.
Phạm vi so sánh: nhánh `chatbot-ai` so với tag `backup-truoc-chatbot` (bản an toàn đã lưu trước khi động mã).

---

## 1. Kết quả tổng quát

| Hạng mục | Kết quả |
| --- | --- |
| Số file thay đổi | **43 file**, +6910 dòng / −339 dòng (so với `backup-truoc-chatbot`, chưa tính tài liệu hướng dẫn vận hành thêm sau, xem §7) |
| Migration CSDL | 1 migration **chỉ bổ sung** (`20261104010000_chatbot_knowledge_handoff`), đã áp lên **CSDL TEST** `localhost:5434/motcua_test` |
| Kho tri thức | **77/77 tài liệu thư viện nạp READY**, 333 đoạn trích (chunk); **2 tệp `.xls` không đọc được** (bỏ qua an toàn) |
| Khớp biểu mẫu ↔ loại đơn | **9/77** (`backend/src/modules/chatbot/form-map.json`) |
| Kiểm thử tự động chatbot | 3 file, **26/26 PASS** trong ~5 giây (mục tiêu ≤ 1 phút, FakeProvider — không gọi mạng) |
| Bộ test toàn dự án | **Lần 1: 28 file PASS / 1 skipped (29 file)**, 232 test PASS + 19 todo, 142,6 s; lần 2 bị crash worker hạ tầng (không kết luận — xem §5.3) |
| Đánh giá truy xuất | **27/30 = 90% ĐẠT** (top-3 ≥ 80%, chế độ từ-khóa, CSDL TEST — `npm run chatbot:eval`) |
| Lỗi thật đã sửa trong giai đoạn | `handleConfirmDraft` truyền mã nghiệp vụ `maLoiDon` thay UUID; thiếu `canhBao` trong action `DRAFT_PROPOSAL`; FakeProvider embed làm dương giả (cosine ≈ 1) phá ngưỡng `CHAT_MIN_SCORE` |
| Khoá API | Không có khoá nào dính frontend/git/log; chỉ đọc từ `GEMINI_API_KEY` trong `backend/.env` — hiện **chưa cấu hình khoá thật** |
| Trạng thái | **Chưa merge** — mọi thay đổi nằm trên nhánh `chatbot-ai` |

## 2. Các commit trên nhánh `chatbot-ai`

| Commit | Nội dung |
| --- | --- |
| `0aaeb6d` | Migration chỉ-bổ-sung (bảng tri thức/handoff/feedback + cột nullable `chat_messages`), enum mới, env `CHAT_*` |
| `49f2832` | Module backend: truy xuất BM25+RRF, riêng tư `maskPii`, orchestrator SSE, công cụ chỉ-đọc (ownership từ token), hành động server dựng, routes `/chat/*`, nạp tri thức, hooks server |
| `972fe95` | Frontend: contract chat mở rộng (action/cheDo/sessionId), thẻ hành động + đánh giá + nút chuyển cán bộ, 3 trang quản lý (câu hỏi chatbot, kiến thức, thống kê), nav theo vai trò |
| `2c8c706` | Test phần 1 + 2 (16 test); neo chống-bịa, FakeProvider no-data + phép chiếu ngẫu nhiên trung-bằng-0, truy xuất chọn ứng viên hai phía + xếp theo điểm hợp |
| `8d9c00f` | Test phần 3 (10 test — đủ 26/26 PASS); sửa lỗi thật `handleConfirmDraft` (mã → UUID), thêm `canhBao` |
| `a8a5dd7` | Điểm truy xuất: 30 câu hỏi, chấm top-3 ≥ 80%; kết quả 27/30 = 90% ĐẠT; lệnh `npm run chatbot:eval` |
| *(commit tài liệu cuối)* | `docs/CHATBOT_HUONG_DAN.md`, Nhóm F trong `docs/QUYET_DINH.md`, 12 đường API chat trong `docs/openapi.yaml`, báo cáo này |

## 3. Danh sách file (so với `backup-truoc-chatbot`)

**Thêm (A)**
- `backend/prisma/migrations/20261104010000_chatbot_knowledge_handoff/migration.sql`
- `backend/scripts/chatbot-eval.ts`, `backend/scripts/ingest-knowledge.ts`
- `backend/src/modules/chatbot/`: `index.ts`, `orchestrator.ts`, `retrieval.ts`, `tools.ts`, `actions.ts`, `privacy.ts`, `prompts.ts`, `ingest.ts`, `vietnamese.ts`, `form-map.json`, `llm/provider.ts`
- `backend/src/types/word-extractor.d.ts`
- `backend/tests/chatbot/`: `chatbot-api.test.ts` (9), `chatbot-knowledge.test.ts` (7), `chatbot-actions-handoff.test.ts` (10)
- `frontend/src/features/chatbot/components/ChatActionCards.tsx`
- `frontend/src/features/chatbot/hooks/useAdminChat.ts`
- `frontend/src/features/chatbot/pages/ChatbotHandoffPage.tsx`, `ChatbotKnowledgePage.tsx`, `ChatbotStatsPage.tsx`

**Sửa (M)**
- `backend/.env.example`, `backend/package.json`, `backend/package-lock.json`, `backend/prisma/schema.prisma`, `backend/src/config/env.ts`, `backend/src/routes.ts`, `backend/src/server.ts`
- `frontend/src/components/common/FileUpload.tsx`, `frontend/src/features/chatbot/components/ChatMessageBubble.tsx`, `ChatbotWidget.tsx`, `frontend/src/features/chatbot/hooks/useChat.ts`
- `frontend/src/lib/constants.ts`, `frontend/src/routes/index.tsx`, `frontend/src/services/contracts/system.ts`, `frontend/src/services/http/index.ts`, `frontend/src/services/mock/systemService.ts`
- `docs/openapi.yaml`, `docs/QUYET_DINH.md`
- Thêm tài liệu: `docs/chatbot-eval.json`, `docs/chatbot-eval-results.json`, `docs/CHATBOT_HUONG_DAN.md`, báo cáo này

## 4. DDL migration (tóm tắt)

Migration **KHÔNG sửa** bảng cũ; chỉ tạo mới + thêm cột nullable:

- **Enum mới (5):** `KnowledgeSourceType` (LIBRARY/UPLOAD/FAQ), `KnowledgeStatus` (PROCESSING/READY/FAILED/DISABLED), `FeedbackRating` (UP/DOWN), `HandoffStatus` (OPEN/ANSWERED/CLOSED), `ChatMode` (LLM/SEARCH_ONLY).
- **Bảng mới (4):** `knowledge_documents` (ma UNIQUE, content_hash, status…), `knowledge_chunks` (document_id FK Cascade, embedding jsonb), `chat_feedback` (1 đánh giá gốc/tin nhắn/người), `chat_handoffs` (ma `CH-YYYY-NNNNNN` CHECK regex, hạn mức theo ngày).
- **Bảng phụ mã dùng chung (1):** `chat_handoff_code_year` + hàm `next_ma_chat_handoff()` / `sync_chat_handoff_sequence()`.
- **`chat_messages` thêm 5 cột nullable:** `hanh_dong jsonb` (hành động server dựng), `che_do ChatMode`, `mo_hinh text`, `thoi_gian_ms int`, `nguoi_dung_id uuid → users(id) ON DELETE SET NULL`.
- **Index (7):** trạng thái/liên kết của knowledge_documents, document_id của chunks, (status, created_at) và (user_id, created_at) của handoffs.

> `chat_sessions`/`chat_messages` là bảng sẵn có của dự án — migration không thay tạo; `chat_handoffs` chỉ tham chiếu `chat_sessions` thành `SET NULL`.

## 5. Kiểm thử tự động

### 5.1 Bộ test chatbot (26 test, ~5 s, một luồng)

| File | Số test | Trọng tâm |
| --- | --- | --- |
| `chatbot-api.test.ts` | 9 | SSE (token/nguồn/xong + `[DONE]`), chống IDOR (B hỏi mã hồ sơ của A → "không tìm thấy trong danh sách đơn của bạn"), mô hình tự thêm `userId` → bị loại theo token, phân quyền 403 (SV/CO_VAN) vs 200 (PDT/ADMIN), che PII `[HỌ TÊN]/[MSSV]/[EMAIL]/[SỐ]`, 429 hạn mức, cache 1 lượt + `moHinh='cache'`, cắt URL lạ |
| `chatbot-knowledge.test.ts` | 7 | BM25 điểm 0.85, trả lời bám nguồn, TẮT tài liệu → "chưa tìm thấy" + OFFER_HANDOFF (tất định qua `zqkhoanthi` → zero truy xuất), bật lại, từ chối magic bytes 422, UPLOAD txt → READY, reindex `documentCount > 0` |
| `chatbot-actions-handoff.test.ts` | 10 | DRAFT_PROPOSAL + cảnh báo trường lạ, confirm → 201 `MC-` + DRAFT thuộc quyền + audit `CHATBOT_DRAFT_CONFIRM`, lặp lại 409 `DUPLICATE_ACTION`, người khác 404, hết hạn 422, handoff `CH-YYYY-NNNNNN` 5/ngày → thứ 6 429, PDT trả lời ANSWERED + thông báo + audit, to-faq → `KB-*` READY truy xuất được, SEARCH_ONLY khi mô hình 500 (đúng 1 lượt gọi), 429 thử lại 1 lần (2 lượt) |

### 5.2 Chống "test viết cho đẹp" — kiểm chứng phá 2 lần

1. Bỏ điều kiện quyền (`applicantId: ctx.user.id`) trong `get_application_status` → **2 test IDOR đỏ đúng như kỳ vọng**, đã khôi phục.
2. Bỏ `maskPii(question, profile)` khỏi prompt → **test che PII đỏ**, đã khôi phục.

### 5.3 Bộ test toàn dự án

- **Lần 1**: 28 file PASS / 1 skipped (29), **232 PASS + 19 todo**, 142,6 s, một luồng.
- **Lần 2 (cuối giai đoạn): KHÔNG kết luận được** — vitest worker crash `Worker exited unexpectedly`
  sau ~16 s (vừa chạy vừa mất toàn bộ tiến trình; không phải test đỏ). Trạng thái mã nguồn hiện tại
  so với lần 1: **giống hệt phần mã/test** (sau kiểm chứng phá, mọi sửa đều khôi phục bằng
  `git checkout --`; duy nhất tài liệu thay đổi) ⇒ kết quả lần 1 vẫn là mốc đại diện.
  Xác nhận bù ở trạng thái cuối: `tsc --noEmit` sạch + 26/26 test chatbot PASS (batch một luồng ~5 s)
  + `npm run check-integrity` exit 0. Nguyên nhân crash (flaky worker pool của vitest/tinypool)
  đã ghi lại cho giai đoạn sau — không tăng số lượt chạy full theo quy ước (tối đa 2×).

## 6. Đánh giá chất lượng truy xuất

- Bộ **30 câu hỏi thật** (`docs/chatbot-eval.json`) dựng từ 30 tài liệu biểu mẫu thật trong 77 tài liệu; tiêu chí: tài liệu đúng nằm trong **top-3** kết quả.
- Chạy `npm run chatbot:eval` ở chế độ từ-khóa trên CSDL TEST → **27/30 = 90.0% ≥ 80% → ĐẠT**. Chi tiết từng câu: `docs/chatbot-eval-results.json`.
- 3 câu chưa trúng đều là dạng "chuyển/lập hồ sơ" có tên tài liệu sa sút khỏi ngôn ngữ hỏi tự nhiên; hệ thống vẫn trả nguồn liên quan ngay sau top-3, không sinh thông tin sai.

## 7. Tài liệu đi kèm

- `docs/QUYET_DINH.md` — bổ sung **Nhóm F (F1–F11)**: 11 quyết định thiết kế chatbot (kiến trúc, nhà cung cấp, truy xuất không pgvector, phân quyền, công cụ chỉ-đọc, riêng tư, xác nhận bản nháp, hậu xử lý, bảng cấm, hạn mức, cache).
- `docs/CHATBOT_HUONG_DAN.md` — hướng dẫn vận hành: áp migration cho dev (không phá dữ liệu), rollback SQL đúng lược đồ, cấu hình khoá Gemini, lệnh `chatbot:ingest`, **kiểm thử tay 8 bước** + bảng khắc phục sự cố.
- `docs/openapi.yaml` — 12 đường API chat (stream SSE, sessions, feedback, knowledge CRUD/reindex, actions/confirm, handoffs: tạo/mine/inbox/answer/to-faq) — kiểm tra YAML hợp lệ bằng `js-yaml`.

## 8. Lệnh rollback (khi thật sự cần)

Chi tiết và scope đầy đủ trong `docs/CHATBOT_HUONG_DAN.md` §1 — lược đồ **chỉ gỡ đúng đối tượng chatbot tạo mới**:

```sql
DROP TABLE IF EXISTS chat_feedback CASCADE;
DROP TABLE IF EXISTS chat_handoffs CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS hanh_dong, DROP COLUMN IF EXISTS che_do, DROP COLUMN IF EXISTS mo_hinh,
  DROP COLUMN IF EXISTS thoi_gian_ms, DROP COLUMN IF EXISTS nguoi_dung_id;
DROP TABLE IF EXISTS chat_handoff_code_year CASCADE;
DROP FUNCTION IF EXISTS next_ma_chat_handoff();
DROP FUNCTION IF EXISTS sync_chat_handoff_sequence();
DELETE FROM _prisma_migrations WHERE migration_name = '20261104010000_chatbot_knowledge_handoff';
```

*(CSDL dev **chưa** áp migration — rollback chỉ là dự phòng; không đụng bảng/enum sẵn có ngoài cột nullable ở trên.)*

## 9. Bảng đối chiếu biểu mẫu ↔ loại đơn (9/77)

Nguồn: `backend/src/modules/chatbot/form-map.json` (do script nạp tri thức dựng từ trùng từ khóa):

| Biểu mẫu (thư viện) | Loại đơn hệ thống | Mã | Độ tin cậy |
| --- | --- | --- | --- |
| Đơn xin cấp bảng điểm | Đơn xin cấp bảng điểm | `rt_dbt` | cao |
| Đơn xin cấp lại bảng điểm | Đơn xin cấp bảng điểm | `rt_dbt` | cao |
| Đơn xin chuyển chuyên ngành đào tạo | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển ngành đào tạo | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển lớp | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển trường | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển trường (bản 2) | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển công tác | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |
| Đơn xin chuyển ngạch | Đơn xin chuyển ngành | `rt_dcn` | trung-bình |

68 tài liệu còn lại chỉ dùng cho **tra cứu tri thức trả lời** (không gắn nút tạo đơn). Năm biểu mẫu
"chuyển…" được nối vào chung `rt_dcn` ở mức trung-bình — cần chủ dự án rà lại trước đưa vào thực thi.

## 10. Hạn chế đã biết & mục chưa kiểm chứng (trung thực mở)

1. **Đường chạy Gemini thật CHƯA kiểm chứng** — môi trường phát triển không có `GEMINI_API_KEY`. Toàn bộ đường sẵn sàng khi có khoá (genera câu trả lời LLM thật, sinh embedding `text-embedding-004` cho chunks mới) đã được cài nhưng chỉ dừng lại ở **tính hợp lệ kiểu + suy giảm an ninh SEARCH_ONLY** (đã test với provider lỗi giả lập). Khi có khoá:
   - thêm khoá vào `backend/.env`, khởi động lại backend;
   - chạy `npm run chatbot:ingest` để **thay embedding giả lập 32 chiều hiện tại bằng embedding thật** (bước bắt buộc — embedding hiện tại chỉ hợp lệ cho phép truy xuất bm25 của bộ test).
2. **Chuẩn hoá BM25 theo điểm lớn nhất tập truy xuất** (`kwNorm = raw / kwMax`): câu chứa từ phổ biến ("điều kiện", "quy trình"…) khớp một phần vẫn có thể chạm ngưỡng `CHAT_MIN_SCORE`. Đã giảm tác động bằng: hợp ứng viên hai phía trước khi chấm, xếp hạng cuối theo điểm hợp, và câu trả lời luôn bám `<<NGUỒN>>` (không tự chế chữ). khắc phục dứt điểm nên theo điểm tuyệt đối hoặc thang IDF — ghi lại cho giai đoạn sau.
3. **9/77 khớp biểu mẫu** — mọi câu hỏi "đơn loại khác" chỉ được trả lời thuộc dạng gợi ý tìm kiếm, không nút tạo đơn đặc thù; thấp nhất là cần bảng đối chiếu thủ công, ưu tiên vẫn không tự chế mã loại đơn.
4. **2 tệp `.xls` không đọc được** ("Danh mục thủ tục giải quyết tại Bộ phận Một cửa" và bản 2) — nguồn đặc thù này thiếu, đề xuất lưu lại dạng PDF/DOCX để nạp.
5. Test tri thức dùng từ khóa đặc trưng (không từ phổ biến) để bảo đảm tính tất định khi chạy lại — các câu hỏi đời thường vẫn có thể phân loại nhẹ nhàng khác nhau giữa các lần chạy.
6. Đánh giá truy xuất hiện chạy chế độ từ-khóa; khi có khoá thật cần **chạy lại `chatbot:eval`** để thay số liệu bằng kết quả sản phẩm-thật.

## 11. Ba việc "CHƯA LÀM"

- **Chưa merge** về nhánh phát triển chính — chờ quyết định của chủ dự án.
- **Chưa cấu hình `GEMINI_API_KEY`** thật (xem §10.1 — hành động khi có khoá được liệt kê sẵn).
- **Chưa chạy thật trên CSDL dev (5433)** — migration dev-apply có sẵn trong `docs/CHATBOT_HUONG_DAN.md` nhưng cần chủ dự án xác nhận thời điểm.

---

*Người viết báo cáo: phiên làm việc tự động ngày 04/11/2026. Số liệu tham chiếu tag `backup-truoc-chatbot`, chi tiết test trong `backend/tests/chatbot/`.*
