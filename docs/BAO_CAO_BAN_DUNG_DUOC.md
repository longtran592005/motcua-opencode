# Báo cáo bản dùng được

| Hạng mục | Kết quả |
|---|---|
| Mốc backup | `backup-truoc-ban-dung-duoc` |
| Nhánh thực hiện | `ban-dung-duoc` |
| Test toàn bộ trước | CHƯA CHẠY: PostgreSQL test `localhost:5434` không hoạt động |
| Test toàn bộ sau | CHƯA CHẠY: Docker Desktop không khả dụng |
| Frontend build | PASS (`npm run build`) |
| Backend typecheck | PASS (`npm run typecheck`) |
| PDF mẫu độc lập | PASS (`backend/storage/documents/f0d3a44428939a70ecac146d7379e1b3.pdf`) |
| Smoke | CHƯA CHẠY: phụ thuộc CSDL test |

| Chức năng | Trạng thái |
|---|---|
| Nộp đơn, duyệt, ký OTP 3 cấp | Đã có backend |
| PDF + QR + hash PDF thật | Đã bổ sung |
| Tải PDF URL ký hạn 5 phút | Đã bổ sung |
| Xác thực công khai, thu hồi | Đã có backend |
| SMTP OTP | Đã bổ sung |
| Frontend chọn service theo nhóm | Đã bổ sung |
| Smoke end-to-end tự động | CHƯA LÀM: cần CSDL test chạy được |

## Quyết định tự chọn

- Dùng `pdfkit` và font hệ thống fallback, không dùng Chromium.
- Dùng `PUBLIC_DOMAIN` hiện có làm `PUBLIC_BASE_URL` tương thích.
- Không tạo migration mới vì cột `pdf_storage_key` đã có trong schema.

## Mục chưa làm

- PDF mẫu đã kiểm tra header `%PDF-`; chưa kiểm tra trích xuất văn bản/QR bằng luồng CSDL thật.
- Chưa chạy phá thử IDOR vì thiếu CSDL test.
- Chưa commit giai đoạn cuối do còn bước kiểm thử phụ thuộc Docker.

## Lỗi môi trường

- Docker Desktop không chạy: không kết nối được `dockerDesktopLinuxEngine`.
- Baseline `npm test` ở thư mục backend không thu được test vì PostgreSQL test từ chối kết nối.
