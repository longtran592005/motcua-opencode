# Báo cáo GIAI ĐOẠN 1 — Hợp đồng API (OpenAPI 3.1)

Trạng thái: **Hoàn thành. Người dùng đã xác nhận 3 điểm ở mục 5 — Giai đoạn 2 đã bắt đầu.**

## 1. Sản phẩm

| Tệp | Mô tả |
| --- | --- |
| `docs/openapi.yaml` | Đặc tả OpenAPI 3.1 đầy đủ, sinh từ hợp đồng frontend + 3 quyết định A. |

Số liệu kiểm chứng bằng công cụ:

- 82 đường dẫn (paths), **112 thao tác** (operations)
- 76 schema, 19 tham số dùng chung, 13 mẫu phản hồi lỗi
- 106 tham chiếu `$ref`, **0 tham chiếu treo**
- `openapi_spec_validator`: **OPENAPI_VALID** (hợp lệ theo chuẩn OpenAPI 3.1)

Lệnh kiểm tra (đã cài `openapi-spec-validator`):

```powershell
py -c "from openapi_spec_validator import validate; from openapi_spec_validator.readers import read_from_filename; s,_=read_from_filename(r'docs\openapi.yaml'); validate(s); print('OPENAPI_VALID')"
```

Nhóm endpoint (theo `tags`):

| Nhóm | Số thao tác |
| --- | --- |
| Công khai (verify + thư viện) | 8 |
| Danh mục (khoa/phòng/ngành/lớp/khóa) | 25 |
| Hồ sơ một cửa | 11 |
| Phê duyệt | 9 |
| Ký OTP | 3 |
| Ủy quyền | 4 |
| Văn bản | 8 |
| Mẫu văn bản | 6 |
| Xác thực | 6 |
| Thông báo | 6 |
| Nhật ký | 3 |
| Trợ lý ảo | 3 |
| Loại đơn | 7 |
| Luồng duyệt | 6 |
| Người dùng | 7 |

## 2. Quy ước phong bì & các ngoại lệ

Áp dụng quyết định **A1**:

- Thành công đối tượng đơn: `{ "success": true, "data": <T> }`
- Thành công danh sách: `{ "success": true, "data": [<T>], "meta": { "page", "pageSize", "total" } }`
  (frontend tự suy ra `totalPages = ceil(total / pageSize)`)
- Lỗi: HTTP status đúng + `{ "success": false, "error": { "code", "message", "details" } }`
  - `code`: mã nghiệp vụ dạng chuỗi (`ErrorCode`)
  - `details`: dữ liệu bổ sung tùy lỗi (`soLanConLai`, `khoaDenLuc`, `giayToThieu`, `truongThieu`…)

**Ba endpoint KHÔNG bọc phong bì** (đã xác nhận bằng kiểm tra tự động — chỉ đúng 3 endpoint):

| Endpoint | Kiểu trả về |
| --- | --- |
| `GET /files/{fileToken}` | tệp nhị phân (PDF/HTML) |
| `GET /notifications/stream` | `text/event-stream` (chuông realtime) |
| `POST /chat/stream` | `text/event-stream` (chatbot RAG) |

> Ghi chú thiết kế: `GET /documents/{id}/export` **có** bọc phong bì vì trả mô tả JSON
> `{ ten, mime, url }`; `url` trỏ tới `GET /files/{fileToken}` (không phong bì) — giống
> cách `POST /library/{id}/download` trả `url`. Nhờ vậy tải tệp vẫn không bọc phong bì,
> mà phần JSON thì nhất quán.

## 3. Ánh xạ 3 quyết định A

**A1 — Phong bì thống nhất:** mọi schema thành công kế thừa `SuccessEnvelope`/`PaginatedEnvelope`,
mọi lỗi dùng `ErrorResponse`. Mã lỗi chuỗi giữ nguyên.

**A2 — UUID nội bộ + mã nghiệp vụ:**

- Khóa chính/khóa ngoại = UUID; API trả thêm mã nghiệp vụ (`maHoSo`, `ma`, `maSo`).
- Đường dẫn `Application` dùng `{maHoSo}` (khớp route `/don/:ma` và `getByCode`).
- Loại đơn / luồng / mẫu / người dùng / danh mục dùng `{ma}` / `{maSo}`.
- **Tương thích ngược:** backend cũng chấp nhận UUID nội bộ tại các tham số đường dẫn này
  (định dạng UUID không trùng mã nghiệp vụ), nên frontend hiện tại *không bị chặn*; nên
  chuyển dần sang mã nghiệp vụ. Ủy quyền `{id}`.
- Quyền luôn kiểm tra theo bản ghi (scope khoa/lớp/cố vấn/người tạo), không tin định danh client.
- Bổ sung trường mã đồng hành để dựng URL: `RequestType.workflowMa`, `RequestType.templateMa`,
  `Workflow.requestTypeMas`.

**A3 — Che PII ở máy chủ:**

- Mọi API công khai trả `PublicSignedDocument` (họ tên `Nguyễn V** A`, MSSV `2021***`).
- Không trả `id` nội bộ, `applicationId`, `maHoSo`, HTML `noiDung`, lịch sử tải, email, SĐT.
- Giữ `tokenXacThuc` (token QR công khai, cần cho đối chiếu mã băm).
- Lỗi/log công khai không chứa dữ liệu đầy đủ (ràng buộc ở Giai đoạn 3 + test ở Giai đoạn 5).

## 4. ĐIỂM CẦN CHỈNH Ở FRONTEND

Đây là danh sách đầy đủ; **sẽ thực thi ở Giai đoạn 8**, chỉ ghi nhận ở đây.

### 4.1 `src/services/http/client.ts` (thay đổi trọng tâm)

1. **Bóc phong bì khi thành công:** trả `payload.data` thay vì `payload`.
2. **Danh sách phân trang:** 8 phương thức trả `Paginated<T>` cần dựng lại
   `{ items, total, page, pageSize, totalPages }` từ `payload.data` + `payload.meta`:
   `applications.listMine`, `listForApproval`, `listProcessed`; `documents.listIssued`;
   `audit.list`; `users.list`. Cần thêm cờ `paginate` (hoặc hàm `map`) vào `RouteSpec`.
3. **Lỗi:** đọc `payload.error.code` / `.message` / `.details` (thay vì `payload.code` /
   `.message` / `.chiTiet`). Mapping `error.details → ApiError.chiTiet` tại **một chỗ duy nhất**
   này, nên `OtpDialog.tsx` (`e.chiTiet`) không phải sửa.
4. **`mapStatus` (dự phòng khi backend thiếu mã):** bổ sung `410 → DOCUMENT_REVOKED`
   (hoặc `OTP_EXPIRED` theo ngữ cảnh), `423 → OTP_LOCKED`, `400 → VALIDATION_ERROR`/`OTP_INVALID`.
5. **Tự refresh khi 401:** gọi `POST /auth/refresh` (cookie httpOnly) rồi thử lại 1 lần.
6. **Base URL:** `API_URL` mặc định đang là `http://localhost:8080/api` → cần `/api/v1`
   (đặt `VITE_API_URL` gồm `/api/v1`).
7. **Endpoint không phong bì:** `exportAs`/tệp nhị phân phải xử lý riêng (không bóc phong bì).

### 4.2 Mã lỗi & kiểu dữ liệu

8. `src/types/common.ts`: thêm `DUPLICATE_ACTION` vào `ERROR_CODES`.
   - Phân biệt: `DUPLICATE_ACTION` = khoá idempotency phát lại; `ALREADY_PROCESSED` = hồ sơ
     đã do người khác xử lý ở bước hiện tại.
9. `src/services/contracts/document.ts`: `exportAs` trả thêm `url` →
   `Promise<{ ten: string; mime: string; url: string; noiDung?: string }>`.
10. `src/services/contracts/document.ts`: `VerifyService.byToken` / `bySoVanBan` / `compareFileHash`
    trả `VerifyResult` với `vanBan: PublicSignedDocument`; `recentDocuments` trả `PublicSignedDocument[]`.
    Bổ sung kiểu `PublicSignedDocument` (thiếu `id`, `applicationId`, `maHoSo`, `noiDung`,
    `luotTai`, `templateId`).

### 4.3 Bỏ che PII ở client (theo A3)

11. `src/features/verify/pages/VerifyResultPage.tsx` (dòng 118): bỏ `maskName`/`maskMssv`,
    hiển thị trực tiếp chuỗi server đã che.
12. `src/features/verify/pages/VerifyLookupPage.tsx` (dòng 107): bỏ `maskName`.
13. `src/features/admin/pages/IssuedDocumentsPage.tsx` (dòng 94): bỏ `maskName` — API nội bộ
    trả đủ họ tên cho cán bộ.
14. `src/lib/utils.ts`: có thể giữ `maskName`/`maskMssv` cho mock; khi `VITE_USE_MOCK=false`
    không dùng nữa.

### 4.4 Ghi chú nối API không phải sửa code

- Đường dẫn `{ma}` cho loại đơn/luồng/mẫu/người dùng/danh mục: nhờ backend chấp nhận UUID,
  frontend hiện tại chạy được ngay; khuyến nghị chuyển sang mã nghiệp vụ sau.
- `PATCH /auth/profile` phải giới hạn trường (không cho đổi `role`/`maSo`/`donViId`) — backend ép.
- `POST /auth/quick-login` tắt ở production.

## 5. Ba điểm đã được xác nhận (kèm điều kiện)

1. **Mã nghiệp vụ trong URL — ĐÃ CHỐT "mã chính, chấp nhận UUID"** cho endpoint cần đăng nhập, với 4 điều kiện:
   (a) mã nghiệp vụ không bao giờ có dạng UUID (ràng buộc cả ở Zod và CSDL);
   (b) phân quyền luôn theo bản ghi tìm được, không theo dạng định danh client gửi;
   (c) mọi response trả mã nghiệp vụ làm định danh công khai;
   (d) API công khai chỉ nhận token xác thực, không nhận UUID nội bộ.
   Bổ sung: test IDOR cho **cả hai dạng ID**.
2. **Mã lỗi 409 — ĐÃ CHỐT phân biệt 3 mã:** `INVALID_TRANSITION` (trạng thái hiện tại không cho phép
   hành động), `ALREADY_PROCESSED` (bước đã bị người khác xử lý — tranh chấp đồng thời),
   `DUPLICATE_ACTION` (cùng `Idempotency-Key` nhưng nội dung yêu cầu khác). Gửi lại **đúng** yêu cầu cũ
   với cùng khoá phải trả lại **kết quả ban đầu**, không báo lỗi. Đã ghi vào `openapi.yaml` và `docs/QUYET_DINH.md`.
3. **`exportAs` — ĐÃ CHỐT trả `url` có chữ ký:** hết hạn 5 phút, gắn với người dùng đã yêu cầu, ghi log
   mỗi lượt tải (`document_downloads`), không nhúng nội dung tệp trong JSON. Chế độ mock trả blob URL
   để frontend xử lý đồng nhất.

Toàn bộ 3 quyết định A + 3 quyết định B được ghi tại **[docs/QUYET_DINH.md](QUYET_DINH.md)**.

## 6. Việc tiếp theo (Giai đoạn 2)

Sau khi bạn xác nhận: thiết kế CSDL Postgres + Prisma theo đặc tả này —
`prisma/schema.prisma` (UUID, snake_case số nhiều ↔ camelCase, soft delete), migration,
seed, `docs/erd.md` (Mermaid), và `docker-compose` kèm Postgres.
