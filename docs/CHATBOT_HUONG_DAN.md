# HƯỚNG DẪN VẬN HÀNH TRỢ LÝ ẢO (CHATBOT)

Tài liệu này hướng dẫn bật tính năng Trợ lý ảo (chatbot) trong môi trường phát triển:
áp migration (chỉ bổ sung), nạp kho tri thức từ 77 tài liệu thư viện, cấu hình khoá
Gemini và kiểm thử tay 8 bước. Quyết định thiết kế: xem `docs/QUYET_DINH.md` (Nhóm F).

---

## 1. CSDL phát triển — áp migration (CHỈ THÊM)

Migration mới (không sửa migration cũ): `backend/prisma/migrations/20261104010000_chatbot_knowledge_handoff/`.

Bảng/cột được tạo: `chat_sessions`, `chat_messages` (cột nullable mới),
`knowledge_documents`, `knowledge_chunks`, `chat_feedback`, `chat_handoffs`
(mã `CH-YYYY-NNNNNN`), hàm `next_ma_chat_handoff()`, các index phục vụ truy xuất.

> ⚠️ Trong giai đoạn phát triển, migration **chỉ đã áp cho CSDL TEST**
> (`localhost:5434/motcua_test`). Áp cho dev bằng lệnh dưới đây — chỉ chạy khi
> bạn chắc chắn (không có thao tác phá dữ liệu cũ):

```powershell
# CSDL dev mặc định: localhost:5433/motcua (docker: motcua-postgres)
$env:PGPASSWORD='<mật khẩu dev>'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U motcua -d motcua `
  -f 'D:\1_Tran Van Long\NCKH\motcua-opencode\backend\prisma\migrations\20261104010000_chatbot_knowledge_handoff\migration.sql'

# Đối chiếu trạng thái:
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U motcua -d motcua `
  -c "SELECT * FROM _prisma_migrations WHERE migration_name LIKE '20261104010000%';"
```

Hoặc bằng Prisma (tự ghi `_prisma_migrations`):

```powershell
Set-Location backend
$env:DATABASE_URL='postgresql://motcua:<mật khẩu>@localhost:5433/motcua?schema=public'
npx prisma migrate deploy          # chỉ áp migration CHƯA được ghi
npx prisma generate
```

Rollback (chỉ áp trên môi trường phát triển, dùng khi thật sự cần):

```sql
-- Xóa đúng các đối tượng chatbot, không đụng bảng khác (xem DDL trong BAO_CAO_CHATBOT.md)
DROP TABLE IF EXISTS chat_feedback CASCADE;
DROP TABLE IF EXISTS chat_handoffs CASCADE;
DROP TABLE IF EXISTS knowledge_chunks CASCADE;
DROP TABLE IF EXISTS knowledge_documents CASCADE;
ALTER TABLE chat_messages
  DROP COLUMN IF EXISTS hanh_dong, DROP COLUMN IF EXISTS che_do, DROP COLUMN IF EXISTS mo_hinh,
  DROP COLUMN IF EXISTS thoi_gian_ms, DROP COLUMN IF EXISTS nguoi_dung_id;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP FUNCTION IF EXISTS next_ma_chat_handoff();
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

```powershell
Set-Location backend
$env:DATABASE_URL='postgresql://motcua:<mật khẩu>@localhost:5434/motcua_test?schema=public'
npm run chatbot:ingest
```

Kết quả tham chiếu (chạy trên CSDL TEST, không có khoá Gemini):
tài liệu mới/cập nhật 67, bỏ qua 10; 77/77 nạp thành công READY, 333 đoạn trích;
2 tệp `.xls` bỏ qua; khớp biểu mẫu ↔ loại đơn 9/77 (bảng `backend/src/modules/chatbot/form-map.json`).

Chấm điểm truy xuất (30 câu, tiêu chí top-3 ≥ 80%):

```powershell
npm run chatbot:eval    # kết quả hiện tại: 27/30 = 90% — ĐẠT
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
4. **Đề xuất bản nháp** — hỏi *“giúp em làm đơn GD-BANG-DIEM”* (mã loại đơn thật):
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
