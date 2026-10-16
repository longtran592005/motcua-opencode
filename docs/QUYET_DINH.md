# QUYẾT ĐỊNH THIẾT KẾ — Cổng Một cửa điện tử TBU

Ghi lại các quyết định đã chốt giữa chủ dự án và nhóm phát triển. Mọi thay đổi sau này
phải cập nhật tại đây.

---

## Nhóm A — Ba quyết định nền tảng (đã chốt)

### A1. Phong bì phản hồi thống nhất

Mọi endpoint trả **JSON** đều dùng:

- Thành công đối tượng đơn: `{ "success": true, "data": <T> }`
- Thành công danh sách phân trang: `{ "success": true, "data": [<T>], "meta": { "page", "pageSize", "total" } }`
  (frontend tự suy ra `totalPages = ceil(total / pageSize)`)
- Lỗi: **HTTP status đúng** + `{ "success": false, "error": { "code", "message", "details" } }`

**Ngoại lệ — KHÔNG bọc phong bì** (đúng 3 endpoint):

| Endpoint | Kiểu |
| --- | --- |
| `GET /files/{fileToken}` | tệp nhị phân PDF/HTML |
| `GET /notifications/stream` | `text/event-stream` |
| `POST /chat/stream` | `text/event-stream` |

Các endpoint ngoại lệ **vẫn** trả phong bì lỗi với HTTP status đúng khi có lỗi.

- Mã lỗi nghiệp vụ là **chuỗi**, giữ nguyên: `OTP_EXPIRED`, `OTP_LOCKED`, `OTP_INVALID`,
  `INVALID_TRANSITION`, `FORBIDDEN_SCOPE`, `VALIDATION_ERROR`, `NOT_FOUND`, `DUPLICATE_ACTION`
  (và các mã mở rộng `ALREADY_PROCESSED`, `MISSING_ATTACHMENT`, `DOCUMENT_REVOKED`, `UNAUTHORIZED`).
- `chiTiet` của bản mock được ánh xạ sang `error.details` tại **một chỗ duy nhất** trong
  `frontend/src/services/http/client.ts`; không rải việc ánh xạ ra component.
- Mock service phải trả **cùng hình dạng** để chế độ mock và chế độ thật hành xử giống nhau.

### A2. Khóa UUID nội bộ + mã nghiệp vụ công khai

- Khóa chính/khóa ngoại trong CSDL là **UUID**.
- API trả thêm **mã nghiệp vụ đọc được** cạnh `id`: `Application.maHoSo`, `RequestType.ma`,
  `User.maSo`, `Khoa/PhongBan/Nganh/Lop/KhoaHoc.ma`, `Workflow.ma`, `DocumentTemplate.ma`.
- URL và form chọn dùng **mã nghiệp vụ**; backend tự đổi sang UUID nội bộ.
- Giá trị mock cũ (`rt_gxn`, `k_cntt`…) trở thành giá trị của trường `ma` trong seed.
- Kiểm tra quyền **luôn theo bản ghi**, không tin định danh client gửi lên (chống IDOR).

### A3. Che PII ở máy chủ

- Mọi API **công khai** trả dữ liệu cá nhân đã che ở phía máy chủ:
  họ tên `Nguyễn V** A`, mã số `2021***`.
- **Bỏ** logic che ở client (`maskName`/`maskMssv`) để không che hai lần; client chỉ hiển thị
  chuỗi nhận được.
- API công khai không trả họ tên/MSSV/email/SĐT đầy đủ ở **bất kỳ trường nào**, kể cả trong
  `message` lỗi hay log.
- Có test khẳng định response công khai không chứa dữ liệu đầy đủ.

---

## Nhóm B — Ba quyết định bổ sung (đã chốt, kèm điều kiện)

### B1. "Mã chính, chấp nhận UUID" cho endpoint cần đăng nhập

Các endpoint cần đăng nhập nhận **mã nghiệp vụ** làm dạng chính; backend **cũng** chấp nhận
UUID nội bộ để giảm thay đổi frontend. Kèm **4 điều kiện bắt buộc**:

| # | Điều kiện | Cách thực thi |
| --- | --- | --- |
| (a) | Mã nghiệp vụ không bao giờ có dạng UUID | Ràng buộc + trigger CSDL; Zod kiểm tra khi tạo; nếu khớp regex UUID ⇒ `VALIDATION_ERROR` |
| (b) | Phân quyền theo **bản ghi** tìm được | Sau khi tra cứu theo mã/UUID ⇒ chạy scope-check trên bản ghi, bỏ qua dạng định danh client gửi |
| (c) | Response trả mã nghiệp vụ làm định danh công khai | Mọi DTO ra ngoài kèm `maHoSo`/`ma`/`maSo`; không dùng UUID trong liên kết điều hướng UI |
| (d) | API công khai chỉ nhận token xác thực | `/public/verify/*` chỉ nhận `{token}` hoặc số văn bản; **từ chối** UUID nội bộ |

**Yêu cầu test:** có test IDOR cho **cả hai dạng ID** (mã nghiệp vụ và UUID) — người dùng
khác khoa/lớp/vai trò đều bị `403 FORBIDDEN_SCOPE`.

### B2. Phân biệt ba mã lỗi HTTP 409

| Mã | Ngữ nghĩa | Khi nào trả |
| --- | --- | --- |
| `INVALID_TRANSITION` | Trạng thái **hiện tại** không cho phép hành động | Hồ sơ không ở trạng thái hợp lệ cho thao tác |
| `ALREADY_PROCESSED` | Bước đã có **người khác** xử lý xong | Tranh chấp đồng thời trên cùng bước |
| `DUPLICATE_ACTION` | Cùng `Idempotency-Key` nhưng **nội dung yêu cầu khác** | Khoá đã dùng cho payload khác |

**Quy tắc `Idempotency-Key`:**

- Bắt buộc với mọi **thao tác ghi nghiệp vụ**.
- Gửi lại **đúng** yêu cầu cũ với cùng khoá ⇒ trả lại **kết quả ban đầu** (cùng HTTP status và
  body), **không** báo lỗi, **không** tạo hiệu ứng mới.
- Cùng khoá nhưng nội dung khác ⇒ `409 DUPLICATE_ACTION`.
- Bản ghi khoá lưu tối đa **24 giờ**.

Đã ghi vào `docs/openapi.yaml` (mô tả `info` + mẫu phản hồi `DuplicateAction`,
`AlreadyProcessed`, `InvalidTransition`).

### B3. `exportAs` trả URL có chữ ký

- Trả **URL có chữ ký**, **hết hạn 5 phút**, **gắn với người dùng đã yêu cầu**.
- **Ghi log** mỗi lần tải (bảng `document_downloads`).
- **Không** nhúng nội dung tệp trong JSON (`ExportedFile` chỉ có `ten`, `mime`, `url`, `hetHanLuc`).
- Chế độ mock trả **blob URL** để frontend xử lý đồng nhất với chế độ thật.

---

## Phụ lục — Ánh xạ mã lỗi → HTTP

| Mã | HTTP |
| --- | --- |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN_SCOPE` | 403 |
| `NOT_FOUND` | 404 |
| `INVALID_TRANSITION` | 409 |
| `ALREADY_PROCESSED` | 409 |
| `DUPLICATE_ACTION` | 409 |
| `VALIDATION_ERROR` | 422 |
| `MISSING_ATTACHMENT` | 422 |
| `OTP_INVALID` | 400 |
| `OTP_EXPIRED` | 410 |
| `DOCUMENT_REVOKED` | 410 |
| `OTP_LOCKED` | 423 |

---

## Nhóm C — Vận hành & dữ liệu demo (đã chốt)

### C1. Cổng PostgreSQL khi phát triển là 5433

`docker-compose.yml` ánh xạ **`"5433:5432"`** (host 5433 → container 5432) để không đụng PostgreSQL
cục bộ thường đã chiếm 5432. Vì vậy `DATABASE_URL` khi phát triển dùng cổng **5433**:

```
postgresql://motcua:motcua@localhost:5433/motcua?schema=public
```

**Cách đổi cổng:** sửa `ports` trong `docker-compose.yml` và `DATABASE_URL` trong `backend/.env`
cho khớp — chỉ là thay đổi cấu hình, không cần sửa migration hay mã nguồn. Trên máy chủ thật, đặt
`DATABASE_URL` qua biến môi trường/bí mật. Chi tiết: `docs/QUY_TRINH_VAN_HANH.md`.

### C2. Mã ngành: `ma` giữ giá trị mock, thêm `ma_chinh_thuc`

- `majors.ma` giữ mã cũ của mock (`n_cntt`, `n_khmt`…) để tra cứu ổn định.
- Thêm cột **`majors.ma_chinh_thuc`** (nullable, **duy nhất khi có giá trị**) lưu mã ngành chính thức
  của Bộ GD&ĐT (ví dụ `7480201`). Seed điền sẵn cho 10 ngành.
- API trả thêm trường `maChinhThuc` trong schema `Nganh` (và `NganhInput` khi tạo/sửa).

### C3. Workflow và mẫu văn bản

Giữ `ma` sẵn có (`WF-01`, `MVT-GXN`). Hai bảng này **đã có** ràng buộc duy nhất
(`workflow_definitions` duy nhất theo `(ma, version)`; `document_templates` duy nhất theo `ma`)
và **đã có** ràng buộc `ma` không được có định dạng UUID như các bảng khác.

### C4. Dữ liệu demo

- Mọi bản ghi do seed tạo được đánh dấu **`is_demo = true`**; dữ liệu thật mặc định `false`.
- Xóa gọn: `npm run demo:purge` (chạy `prisma/purge-demo.sql`).
- `prisma/seed.ts` **từ chối chạy khi `NODE_ENV=production`**.
- Mật khẩu tài khoản demo được băm bcrypt; danh sách tài khoản demo ghi trong `README.md` (chỉ dev).
- `ma_bam_sha256`, `token_xac_thuc`, `ma_bam`/`ma_chu_ky` của dữ liệu demo là giá trị tạm,
  **không dùng ở production** — Giai đoạn 4/5 sẽ sinh giá trị thật.
