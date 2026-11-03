# Báo cáo bản dùng được

| Hạng mục | Kết quả |
|---|---|
| Nhánh | `ban-dung-duoc` |
| Backup CSDL dev | `backend/backups/motcua_dev_verification.dump` (đã ignore) |
| CSDL test | `motcua_test` trên `localhost:5434`, migration PASS, seed PASS |
| Test tuần tự | 24 file: 22 PASS, 2 còn lỗi nghiệp vụ cũ; 19 TODO trong `todo-openapi.test.ts` |
| Lỗi worker Vitest | Full pool bị worker native thoát; chạy từng file xác nhận số liệu trên |
| Backend typecheck | PASS |
| Frontend build mock | PASS |
| Frontend build thật | PASS |
| HTTP contract probe | PASS: login, applications phân trang, request types |

## Smoke HTTP thật

| Bước | Kết quả |
|---|---|
| Chọn workflow 3 cấp | PASS |
| Sinh viên tạo/nộp đơn | PASS |
| Cố vấn duyệt | PASS |
| Trưởng khoa ký OTP | PASS |
| Phòng Đào tạo ký OTP | PASS |
| COMPLETED + PDF | PASS |
| SHA-256 khớp file | PASS |
| `/verify` HỢP LỆ | PASS |
| Thu hồi văn bản | PASS |
| `/verify` ĐÃ THU HỒI | PASS |
| IDOR sinh viên khác | PASS, HTTP 403 |
| Integrity | PASS, 0 step mồ côi |

PDF smoke gần nhất:
`backend/storage/documents/798bb184746203f32d61d44023adcfa8.pdf`.

## Kiểm tra PDF

- Trích xuất được câu tiếng Việt có dấu `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM`.
- Có image XObject QR trong PDF.
- Giải mã QR trực tiếp bằng bộ trích xuất hiện tại chưa thành công; đã dựng lại QR từ đúng URL/token và kiểm tra URL `http://localhost:5173/xac-thuc/{token}`.
- SHA-256 khớp `signed_documents.ma_bam_sha256`.
- Font: TTF Windows Arial hoặc Linux DejaVuSans; Linux triển khai nên đặt Tinos/Noto Serif tại `backend/assets/fonts`.

## Lỗi còn lại

- `tests/core/luong-don-day-du.test.ts`: 2 lỗi vi phạm integrity do engine tạo bước tương lai `PENDING` với `assignee_id=null`; đã có chú thích Q1 trong test, phân loại C (lỗi cũ, không thuộc thay đổi lần này).
- `tests/api/todo-openapi.test.ts`: 19 TODO theo thiết kế hiện tại.
- Full Vitest một lệnh còn lỗi worker native; chạy từng file không lặp lỗi worker.

## Rà soát an toàn

- Đã xóa `d2c.txt` khỏi Git và thêm ignore; `.env`, dump, PDF, storage, backups, node_modules không được theo dõi.
- (a) `FOR UPDATE`: còn nguyên.
- (b) Chuyển trạng thái đi qua `transition()`: còn nguyên.
- (c) Quyền xem đơn/PDF/file: còn kiểm tra scope hoặc signed token.
- (d) API công khai che PII tại backend: còn nguyên.
- (e) Thứ tự cấp: còn kiểm tra trong workflow engine.
- (f) OTP chỉ qua channel, không response/log/audit: test PASS.
- CẦN XỬ LÝ NGAY: không phát hiện secret thật bị commit.

## Quyết định tự chọn và chưa làm

- Dùng workflow tạm 3 cấp trong smoke vì seed hiện tại không có workflow 3 cấp.
- Không chạy `scripts/start-dev.ps1` trên CSDL dev để tuân thủ quy định dev chỉ SELECT/pg_dump; script đã được kiểm tra type/syntax.
- Không tạo migration mới vì `pdf_storage_key` đã tồn tại.
- Chưa giải mã trực tiếp QR từ XObject; đã kiểm tra image và dựng lại QR theo đúng token.

Quay lại mốc: `git checkout backup-truoc-ban-dung-duoc`, khôi phục bằng `pg_restore -d motcua backend/backups/motcua_dev_verification.dump`.
