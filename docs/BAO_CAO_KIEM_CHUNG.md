# Báo cáo kiểm chứng

Cập nhật: 2026-11-03 — nhánh `ban-dung-duoc`, Node v24.15.0, Vitest 2.1.9.

## Bảng kết quả

| Hạng mục | Kết quả thật |
|---|---|
| Docker | PASS, Docker 29.9.2 |
| PostgreSQL test | PASS, `motcua_test:5434`, migration + seed |
| PostgreSQL dev backup | PASS, `backend/backups/motcua_dev_verification.dump` |
| Smoke 3 cấp qua HTTP | PASS toàn bộ |
| PDF/hash | PASS |
| QR trực tiếp | Chưa giải mã được từ XObject; dựng lại QR đúng token PASS |
| Frontend mock/thật | PASS build cả hai |
| HTTP contract frontend | PASS envelope + pagination |
| `npm test` MỘT lệnh (vitest run) | PASS: 24 file passed + 1 skipped (25), 199 passed + 19 todo (218), 0 fail, 75.5s |
| `tests/core/luong-don-day-du.test.ts` | PASS: 8/8 (trước đó 2 test đỏ) |
| `tests/core/thieu-nguoi-duyet.test.ts` (mới) | PASS: 3/3 |
| `tests/db/integrity-fuzz.test.ts` | PASS: 8/8 |
| Sequence mã hồ sơ dev (chỉ SELECT) | Không lệch: `application_code_seq` next = 1334, max mã 2026 = 1332 (36 hồ sơ năm 2026); dư 2 số, an toàn |

## Kiểm chứng đợt này (ba việc đã chạy thật)

1. **2 test đỏ trong `luong-don-day-du.test.ts`** — lỗi integrity cũ do quy tắc
   `STEP_PENDING_THIEU_ASSIGNEE` đòi assignee ở MỌI bước PENDING. Thiết kế engine:
   nộp đơn chỉ gán assignee cho bước đầu; các bước sau được gán **khi tới lượt**
   (`backend/src/modules/workflow/engine.ts` dòng ~460–490 tạo bước tương lai
   `assigneeId: null`, dòng ~824 gán khi chuyển bước). Do đó quy tắc được sửa để
   chỉ yêu cầu assignee ở **bước đang mở** (`step_order = current_step_order`,
   trạng thái `PENDING/IN_PROGRESS`) — vẫn phát hiện bước đang mở thiếu assignee;
   ca fuzz `STEP_PENDING_THIEU_ASSIGNEE` giữ nguyên và đặt vi phạm đúng ở bước
   đang mở (`tests/db/integrity-fuzz.test.ts`, bước 1 = current_step_order 1).
   Không bỏ ca nào. Sau sửa: luong-don 8/8, integrity-fuzz 8/8.
   Commit: `d537753`.
2. **Thiếu người duyệt** — hành vi TRƯỚC: nộp đơn khi thiếu cố vấn/trưởng khoa
   tạo hồ sơ kẹt im lặng (bước không ai phụ trách); không báo lỗi rõ.
   SAU (commit `935b7d7`): khi NỘP, engine kiểm tra **mọi bước** đều tìm được ít
   nhất một người duyệt (kể cả đường ủy quyền); thiếu → từ chối nộp, HTTP 422,
   mã `VALIDATION_ERROR`, thông báo tiếng Việt nêu rõ vai trò thiếu:
   "Chưa có {Cố vấn học tập|Trưởng khoa|Phòng Đào tạo} cho hồ sơ này, vui lòng
   liên hệ Phòng Đào tạo". Khi CHUYỂN bước mà thật sự không có người: giữ đơn ở
   bước hiện tại và trả lỗi 422, không làm hỏng trạng thái.
   3 ca test mới trong `tests/core/thieu-nguoi-duyet.test.ts` đều PASS.
3. **Vitest chạy được bằng một lệnh** — `npm test` một lần: exit 0, tổng kết
   `24 passed | 1 skipped (25)` file, `199 passed | 19 todo (218)` test, 75.5s.
   Root cause của lỗi "worker native exit": pool `threads` (tinpooool/nhịp
   pthread) treo native trên Node v24.15.0 khi nạp đủ 25 file; danh mục test
   tách lô đều xanh riêng, gộp một worker threads thì crash `0xC0000409`.
   Giải pháp: giữ `pool: 'forks'` + `singleFork: true` (giữ nguyên cấu hình DB
   riêng `vitest.db.config.ts`). KHÔNG tự nâng Node.

## An toàn

`FOR UPDATE`, `transition()`, scope/IDOR, PII masking tại backend, thứ tự cấp
và không lộ OTP đều còn nguyên. `d2c.txt` đã xóa khỏi Git; không có `.env`,
dump, PDF, storage, backups hoặc node_modules được theo dõi.

Quay lại mốc: `git checkout backup-truoc-ban-dung-duoc`.

## Quyết định tự chọn

- Fuzz không cần sửa ca: ca `STEP_PENDING_THIEU_ASSIGNEE` hiện có gây vi phạm ở
  bước 1 (bước đang mở) nên giữ nguyên, chỉ siết quy tắc trong
  `backend/scripts/check-integrity.ts` + `scripts/check-integrity.ts`.
- Kiểm tra sequence dev chạy bằng `docker exec` vào container
  `motcua-postgres` (cổng 5433 chưa publish), toàn bộ chỉ SELECT.
