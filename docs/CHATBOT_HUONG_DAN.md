# HƯỚNG DẪN VẬN HÀNH TRỢ LÝ ẢO (CHATBOT)

Tài liệu này hướng dẫn bật tính năng Trợ lý ảo (chatbot) trong môi trường phát triển:
áp migration (chỉ bổ sung), nạp kho tri thức từ 77 tài liệu thư viện, cấu hình khoá
Gemini và kiểm thử tay 8 bước. Quyết định thiết kế: xem `docs/QUYET_DINH.md` (Nhóm F).

---

## 1. CSDL phát triển — áp migration (CHỈ THÊM)

Migration mới (không sửa migration cũ): `backend/prisma/migrations/20261104010000_chatbot_knowledge_handoff/`.

**Đối tượng DO MIGRATION NÀY TẠO** (đối chiếu từng dòng với `migration.sql`):
- 5 enum: `KnowledgeSourceType`, `KnowledgeStatus`, `FeedbackRating`, `HandoffStatus`, `ChatMode`.
- 4 bảng: `knowledge_documents`, `knowledge_chunks`, `chat_feedback`, `chat_handoffs`;
  + bảng phụ mã `chat_handoff_code_year`.
- 2 hàm: `next_ma_chat_handoff()`, `sync_chat_handoff_sequence()`.
- 5 cột nullable thêm vào `chat_messages` (bảng CÓ SẴN của dự án): `hanh_dong`, `che_do`, `mo_hinh`, `thoi_gian_ms`, `nguoi_dung_id`.
- 7 index.

> `chat_sessions` và `chat_messages` là bảng CÓ SẴN của dự án — migration **KHÔNG tạo**
> hai bảng này, chỉ Thêm cột nullable vào `chat_messages`.

> ⚠️ Trong giai đoạn phát triển, migration **chỉ đã áp cho CSDL TEST**
> (`localhost:5434/motcua_test`). Áp cho dev bằng đúng QUY TRÌNH DUY NHẤT dưới đây.

### 1.1. Quy trình áp lên dev (duy nhất 1 cách — qua Prisma, ghi `_prisma_migrations`)

```powershell
# BƯỚC 0 (bắt buộc): sao lưu dev trước
$env:PGPASSWORD='<mật khẩu dev>'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h localhost -p 5433 -U motcua -d motcua -F c `
  -f "D:\1_Tran Van Long\NCKH\motcua-opencode\backend\backups\dev-truoc-chatbot-$stamp.dump"

# BƯỚC 1: áp migration bằng Prisma (chỉ áp cái CHƯA được ghi, tự ghi _prisma_migrations)
Set-Location backend
$env:DATABASE_URL='postgresql://motcua:<mật khẩu dev>@localhost:5433/motcua?schema=public'
npx prisma migrate deploy
npx prisma generate

# BƯỚC 2: đối chiếu đã ghi đúng
npx prisma migrate status
# hoặc:
$env:PGPASSWORD='<mật khẩu dev>'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U motcua -d motcua `
  -c "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '20261104010000%';"
```

KHÔNG dùng `psql -f migration.sql` — cách này KHÔNG ghi `_prisma_migrations`, làm
Prisma tưởng migration chưa áp và có thể re-apply gây mâu thuẫn.

### 1.2. Khôi phục dev từ bản sao lưu (khi sai/cần lùi)

Chiến lược an toàn: khôi phục vào DB MỚI, đối chiếu, rồi mới hoán đổi. `motcua_lv`
là "bản lưu hiện trạng" — sau khi chạy ổn có thể giữ lại hoặc xóa sau.

```powershell
$env:PGPASSWORD='<mật khẩu dev>'
$dump = 'D:\1_Tran Van Long\NCKH\motcua-opencode\backend\backups\dev-truoc-chatbot-<stamp>.dump'

# B1: giữ hiện trạng dev sang DB tạm, rồi tạo dev sạch
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U postgres `
  -c "ALTER DATABASE motcua RENAME TO motcua_lv;" `
  -c "CREATE DATABASE motcua OWNER motcua;"

# B2: khôi phục bản sao lưu vào dev (đầy đủ schema + data checkpoint trước chatbot)
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' -h localhost -p 5433 -U motcua -d motcua $dump

# B3: đối chiếu xong, ổn thì có thể xóa DB tạm (tự quyết khi nào)
# & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U postgres `
#   -c "DROP DATABASE motcua_lv;"
```

### 1.3. Rollback thủ công (khi THẬT SỰ cần — chỉ gỡ đúng đối tượng do migration chatbot tạo)

```sql
-- Gỡ bảng tri thức/handoff/feedback + bảng phụ mã (FK cascade xử lý chunk)
DROP TABLE IF EXISTS chat_feedback CASCADE;
DROP TABLE IF EXISTS chat_handoffs CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
DROP TABLE IF EXISTS chat_handoff_code_year CASCADE;
-- Gỡ 5 cột nullable khỏi chat_messages (bảng CÓ SẴN, KHÔNG xóa bảng)
ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS hanh_dong, DROP COLUMN IF EXISTS che_do, DROP COLUMN IF EXISTS mo_hinh,
  DROP COLUMN IF EXISTS thoi_gian_ms, DROP COLUMN IF EXISTS nguoi_dung_id;
-- Gỡ hàm sinh mã handoff và bảng phụ mã
DROP FUNCTION IF EXISTS next_ma_chat_handoff();
DROP FUNCTION IF EXISTS sync_chat_handoff_sequence();
-- Gỡ enum (chỉ khi chắc chắn không còn cột nào tham chiếu)
DROP TYPE IF EXISTS "KnowledgeSourceType";
DROP TYPE IF EXISTS "KnowledgeStatus";
DROP TYPE IF EXISTS "FeedbackRating";
DROP TYPE IF EXISTS "HandoffStatus";
DROP TYPE IF EXISTS "ChatMode";
-- Đồng bộ sách lược: QUAN TRỌNG — KHÔNG bao giờ xóa chat_sessions, chat_messages,
-- users hoặc bất kỳ bảng nào khác; rollback ở trên chỉ gỡ đúng đối tượng do migration chatbot tạo.
DELETE FROM _prisma_migrations WHERE migration_name = '20261104010000_chatbot_knowledge_handoff';
```

---

## 2. Khoá Gemini (KHÔNG RÒ KHOÁ)

- Khoá **chỉ** đặt trong `backend/.env`, biến `GEMINI_API_KEY=…` (+ tùy chọn
  `GEMINI_MODEL=gemini-2.5-flash`, `GEMINI_EMBED_MODEL=text-embedding-004`).
- KHÔNG đặt khoá vào frontend, không commit, không in ra log.
- Không có khoá: chatbot vẫn chạy ở **chế độ chỉ-tìm-kiếm SEARCH_ONLY**
  (trả danh sách tài liệu + nút chuyển cán bộ) — lỗi mô hình không làm chết tính năng.

```powershell
Add-Content backend\.env "GEMINI_API_KEY=<khoá của bạn>"
# Khởi động lại backend sau khi thêm khoá
```

Sau khi **lần đầu** có khoá, nạp lại tri thức để sinh embedding thật:

```powershell
Set-Location backend
$env:DATABASE_URL='postgresql://motcua:<mật khẩu>@localhost:5434/motcua_test?schema=public'
npm run chatbot:ingest     # 67 tài liệu mới/cập nhật, 2 tệp .xls không đọc được (bỏ qua)
```

Script `chatbot:ingest` an toàn để chạy lại (bỏ qua tài liệu không đổi theo `content_hash`).

---

## 3. Nạp kho tri thức (77 tài liệu thư viện)

**Hai mẫu lệnh — PHẢI đổi `DATABASE_URL` đúng CSDL đang nạp** (kho tri thức nằm trong
CSDL, nạp vào CSDL nào chỉ phục vụ CSDL đó):

```powershell
# MẪU A — nạp vào CSDL TEST (dùng khi phát triển/kiểm thử; hiện đã nạp xong):
Set-Location backend
$env:DATABASE_URL='postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'
npm run chatbot:ingest

# MẪU B — nạp vào CSDL DEV (SAU KHI đã áp migration §1.1; đổi mật khẩu đúng dev):
$env:DATABASE_URL='postgresql://motcua:<mật khẩu dev>@localhost:5433/motcua?schema=public'
npm run chatbot:ingest
```

Kết quả tham chiếu (chạy trên CSDL TEST, không có khoá Gemini):
tài liệu mới/cập nhật 67, bỏ qua 10; 77/77 nạp thành công READY, 333 đoạn trích;
2 tệp `.xls` bỏ qua; khớp biểu mẫu ↔ loại đơn (bảng `backend/src/modules/chatbot/form-map.json`).

Chấm điểm truy xuất (3 chỉ số: bám-tên-tài liệu / tự nhiên / ngoài-phạm-vi):

```powershell
# CSDL TEST:
$env:DATABASE_URL='postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'
npm run chatbot:eval
# CSDL DEV: đổi DATABASE_URL sang dev rồi chạy lại lệnh trên
```

---

## 4. Kiểm thử tay 8 bước

Dùng tài khoản demo (mật khẩu `demo1234`): sinh viên — mã số `SINH_VIEN` trong seed
(ví dụ `20211234`), Phòng Đào tạo `PDT001`, admin `admin`.

1. **Hỏi tri thức** — vào tab Trợ lý ảo, hỏi *“xin cấp bảng điểm cần gì?”*:
   nhận câu trả lời trích nguồn (tên tài liệu + nút tải biểu mẫu).
2. **Tra cứu đơn của mình** — tạo 1 bản nháp, hỏi *“tra cứu trạng thái MC-2026-000xxx”*:
   chatbot đọc đúng mã + nút “Mở hồ sơ”.
3. **Chống IDOR** — dùng người dùng khác hỏi cùng mã trên → chatbot trả “không tìm thấy
   trong danh sách đơn của bạn”, không tiết lộ trạng thái của người khác.
4. **Đề xuất bản nháp** — hỏi *“giúp em làm đơn có mã rt_dbt”* (mã loại đơn CÓ SẴN trong seed:
   `rt_dbt` — Đơn xin cấp bảng điểm; xem danh sách mã tại `/api/v1/request-types`):
   nhận thẻ đề xuất với trường từ biểu mẫu; bấm **Tạo bản nháp** → hệ thống tạo đơn
   `MC-` mới ở trang *Hồ sơ của tôi* (trạng thái NHÁP, chưa nộp); bấm lần hai → thông báo đã thực hiện.
5. **Chuyển cán bộ** — hỏi câu ngoài tri thức, bấm nút chuyển cán bộ (hoặc tự soạn):
   mã `CH-2026-NNNNNN` được sinh; **câu thứ 6 trong ngày** → từ chối 429.
6. **Cán bộ trả lời** — đăng nhập `PDT001`, trang *Câu hỏi chatbot*: thấy câu mới,
   trả lời → sinh viên nhận thông báo; bấm đưa vào FAQ → câu hỏi này sau đó được
   chatbot trả lời bằng được (hỏi lại theo bước 6).
7. **Hạn mức chat** — hỏi liên tục trên 15 câu / 10 phút → nhận 429 RATE_LIMITED.
8. **Admin hiệu chỉnh tri thức** — trang *Kiến thức chatbot* (Admin):
   thêm tài liệu TEXT, chờ READY rồi hỏi lại được; TẮT tài liệu → câu hỏi về nó
   trả lời “chưa tìm thấy” + nút chuyển cán bộ; XÓA → mất hẳn.

---

## 5. Biết lỗi thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
| --- | --- | --- |
| Chat chỉ trả “tra cứu nhanh” (SEARCH_ONLY) | Không có `GEMINI_API_KEY` hoặc gọi mô hình lỗi/429 | Thêm khoá vào `backend/.env`, khởi động lại |
| Trả lời “chưa tìm thấy” dù tài liệu có | Tài liệu đang DISABLED, hoặc chưa chạy `chatbot:ingest` | Check trang tri thức, chạy ingest, bấm “Tải lại chỉ mục” |
| Không tạo được bản nháp từ chatbot | Mã loại đơn trong đề xuất đã ngừng nhận hồ sơ | Kiểm tra `request_types.hoatDong` của mã trong đề xuất |
| 429 khi gửi câu hỏi handoff | Trả đủ 5 câu/ngày | Chờ qua ngày, hoặc tăng `CHAT_HANDOFF_PER_DAY` trong env |
| Embedding cũ/không khớp | Đã đổi khoá/mô hình sau khi ingest | Chạy lại `npm run chatbot:ingest` để nạp embedding mới |
