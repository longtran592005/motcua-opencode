# Báo cáo kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Docker | PASS, Docker 29.9.2 |
| PostgreSQL test | PASS, `motcua_test:5434`, migration + seed |
| PostgreSQL dev backup | PASS, `backend/backups/motcua_dev_verification.dump` |
| Smoke 3 cấp qua HTTP | PASS toàn bộ |
| PDF/hash | PASS |
| QR trực tiếp | Chưa giải mã được từ XObject; dựng lại QR đúng token PASS |
| Frontend mock/thật | PASS build cả hai |
| HTTP contract frontend | PASS envelope + pagination |
| Test tuần tự | 24 file: 22 PASS, 2 lỗi cũ |

## Smoke

Tạo/nộp đơn, Cố vấn duyệt, Trưởng khoa OTP, Phòng Đào tạo OTP,
`COMPLETED`, PDF, hash, verify HỢP LỆ, thu hồi, verify ĐÃ THU HỒI,
IDOR HTTP 403 và integrity 0 vi phạm đều PASS.

## Lỗi còn lại

- `tests/core/luong-don-day-du.test.ts`: 2 lỗi integrity cũ liên quan bước tương lai chưa có assignee.
- `tests/api/todo-openapi.test.ts`: 19 TODO.
- Full Vitest một lệnh gặp worker native exit; chạy tuần tự từng file cho số liệu trên.

## An toàn

`FOR UPDATE`, `transition()`, scope/IDOR, PII masking tại backend, thứ tự cấp
và không lộ OTP đều còn nguyên. `d2c.txt` đã xóa khỏi Git; không có `.env`,
dump, PDF, storage, backups hoặc node_modules được theo dõi.

Quay lại mốc: `git checkout backup-truoc-ban-dung-duoc`.
