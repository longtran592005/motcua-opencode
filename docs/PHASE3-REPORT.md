# Báo cáo GIAI ĐOẠN 3 — Backend API (Node/Express + TypeScript + Prisma + Zod + RBAC)

Trạng thái: **Hoàn thành** — biên dịch sạch, 50/50 ca kiểm thử đạt trên PostgreSQL thật.

## 1. Tổng quan

Hiện thực tầng API thật theo `docs/openapi.yaml` và `docs/QUYET_DINH.md`: khuôn phản hồi thống nhất,
xác thực JWT + xoay vòng refresh token, phân quyền theo vai trò (RBAC) và theo **phạm vi dữ liệu**
(scope), định danh kép (mã nghiệp vụ *hoặc* UUID), ba loại xung đột 409, `Idempotency-Key`,
máy trạng thái hồ sơ, chữ ký OTP, cấp/thu hồi văn bản, che PII ở API công khai, nhật ký kiểm toán.

**Không có thay đổi nào ở frontend trong Giai đoạn 3** — tầng đọc (read) khớp 100% với
`frontend/src/services/http/routes.ts`. Các thay đổi cần cho frontend được liệt kê ở mục 8.

## 2. Công nghệ

| Thành phần | Chọn | Ghi chú |
| --- | --- | --- |
| HTTP | `express@4` | Ổn định, hệ sinh thái lớn |
| Ngôn ngữ | TypeScript (ESM, `moduleResolution: Bundler`) | Chạy trực tiếp bằng `tsx`, không cần bước build |
| ORM | Prisma 6 | Đã dựng ở Giai đoạn 2 |
| Kiểm tra dữ liệu | Zod | Sinh thông báo lỗi tiếng Việt |
| Xác thực | `jsonwebtoken` (HS256) | Access 15 phút + refresh 7 ngày (xoay vòng) |
| Ghi log | `pino` + `pino-http` | **Tự động che** tiêu đề `Authorization`, `Cookie` |
| Bảo mật | `helmet`, `cors`, `express-rate-limit` | HSTS/CSP mặc định; rate-limit riêng cho `/auth/*` |
| Kiểm thử | `vitest` + `supertest` | Chạy tuần tự trên CSDL thật |

## 3. Tệp đã tạo (backend/)

### 3.1 Hạ tầng dùng chung — `src/lib/`

| Tệp | Nội dung |
| --- | --- |
| `errors.ts` | `AppError` + `ERROR_HTTP` (bảng ánh xạ mã lỗi → HTTP) + các hàm tiện dụng `validation/notFound/forbidden/invalidTransition/…` |
| `envelope.ts` | `send()` gói `{success, data, error, meta}`; chuẩn hoá phân trang |
| `scope.ts` | `scopeWhere(user)` — mệnh đề Prisma theo vai trò (điểm duy nhất quyết định phạm vi) |
| `crypto.ts` | `sha256`, `randomToken`, `safeEqual`, `isUuid`, băm/so khớp mật khẩu |
| `jwt.ts` | Ký/kiểm access token; phát và kiểm refresh token (chỉ lưu băm) |
| `mask.ts` | `maskName`, `maskMssv`, `maskEmail`, `maskPhone`, **`scrubText`** (che trong văn bản tự do) |
| `ids.ts` | `nextMaHoSo()` (gọi `next_ma_ho_so()`), sinh `soVanBan` |
| `audit.ts` | `recordAudit()` — chỉ ghi thêm, không sửa/xoá |
| `notify.ts` | `notify()` tạo thông báo trong CSDL |
| `context.ts` | Dựng `Ctx` (người dùng + IP + thiết bị) cho tầng nghiệp vụ |
| `prisma.ts`, `logger.ts` | Client Prisma dùng chung; logger pino có che dữ liệu nhạy cảm |

### 3.2 Middleware — `src/middleware/`

| Tệp | Nội dung |
| --- | --- |
| `requestId.ts` | Gắn `x-request-id` cho mọi phản hồi và log |
| `auth.ts` | `authenticate` (Bearer), `requireRole(...)` |
| `validate.ts` | Kiểm tra Zod cho `body`/`query`/`params` (dùng `Object.defineProperty` cho getter `query` của Express) |
| `idempotency.ts` | `idempotent()` — giữ chỗ/ghi lại kết quả/`DUPLICATE_ACTION`; `purgeExpiredIdempotencyKeys()` |
| `errorHandler.ts` | Bắt lỗi tập trung → khuôn lỗi thống nhất + `asyncHandler` |
| `rateLimit.ts` | Giới hạn chung và giới hạn siết cho `/auth/*` |

### 3.3 Ứng dụng

| Tệp | Nội dung |
| --- | --- |
| `src/config/env.ts` | Kiểm tra biến môi trường bằng Zod; `assertProductionSecrets()` từ chối khởi động ở production nếu `JWT_SECRET` còn giá trị mặc định |
| `src/app.ts` | Nhà máy `createApp()`: helmet, cors, json, pino-http, gắn `/api/v1`, 404 + errorHandler |
| `src/server.ts` | Khởi động HTTP, dọn khóa idempotency hết hạn, tắt êm |
| `src/routes.ts` | Gắn 13 nhóm route dưới `/api/v1` |
| `src/types/express.d.ts` | Bổ sung `req.user`, `req.requestId`, `req.idempotencyReplay` |

### 3.4 Các mô-đun nghiệp vụ — `src/modules/`

| Mô-đun | Tệp | Nội dung |
| --- | --- | --- |
| `auth` | `schemas.ts`, `service.ts`, `routes.ts` | Đăng nhập/đăng xuất/làm mới token/`me`/cập nhật hồ sơ; phát hiện dùng lại refresh token → thu hồi toàn bộ phiên |
| `applications` | `schemas.ts`, `service.ts`, `routes.ts` | Danh sách của tôi (gồm `recent`, `stats`), tạo/sửa/xoá nháp, nộp, rút, bổ sung, kiểm tra bắt buộc, `next-approver-roles`, văn bản của hồ sơ |
| `approvals` | `schemas.ts`, `service.ts`, `routes.ts` | `pending`/`processed`/`stats`/`overdue`/`pending-count`, `batch`, `approve`/`reject`/`request-supplement`; `assertCanApprove`, `isWaitingAt`, "chiếm" bước nguyên tử |
| `otp` | `service.ts`, `routes.ts` | `send`/`resend`/trạng thái; `consumeOtp` phân biệt `OTP_INVALID`/`OTP_EXPIRED`/`OTP_LOCKED`; `devOtp` chỉ ngoài production |
| `documents` | `issuer.ts`, `dto.ts`, `service.ts`, `routes.ts` | Cấp văn bản (sinh `soVanBan`, `tokenXacThuc`, `maBamSha256`), thu hồi, ghi vết tải, danh sách văn bản; `signedDocumentDto(mask)` |
| `public` | `verify.ts` | Tra cứu theo mã QR/số văn bản, đối chiếu mã băm, danh sách mới cấp — **tất cả đều che PII** |
| `notifications`, `audit`, `library` | `index.ts` | Thông báo (đọc/đánh dấu/đếm chưa đọc/xoá), nhật ký kiểm toán (đọc), tài liệu thư viện |
| `catalog` | `index.ts` | CRUD 5 danh mục (`khoa`, `phong-ban`, `nganh`, `lop`, `khoa-hoc`) qua khuôn dùng chung |
| `requestTypes`, `workflows`, `users` | `index.ts` | Đọc loại đơn (gồm `stats`), luồng duyệt, người dùng (gồm `advisors`, loại đơn được phép) |
| `shared` | `dto.ts`, `userDto.ts`, `workflow.ts` | Bộ chuyển đổi Prisma → DTO khớp tên trường camelCase của frontend; logic luồng duyệt dùng chung |

## 4. API đã hiện thực — 83/112 thao tác

| Nhóm | Số thao tác | Đường dẫn |
| --- | --- | --- |
| `auth` | 6 | `POST /auth/login`, `POST /auth/quick-login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/profile` |
| `applications` | 12 | `GET /applications/mine`, `/mine/recent`, `/mine/stats`, `POST /applications`, `GET|PUT|DELETE /applications/{maHoSo}`, `POST …/submit`, `…/cancel`, `…/supplement`, `GET …/next-approver-roles`, `GET …/document` |
| `approvals` | 9 | `GET /approvals/pending`, `/processed`, `/stats`, `/overdue`, `/pending-count`, `POST /approvals/batch`, `POST /approvals/{maHoSo}/{approve,reject,request-supplement}` |
| `otp` | 3 | `POST /otp/send`, `POST /otp/{challengeId}/resend`, `GET /otp/{challengeId}` |
| `documents` | 4 | `GET /documents`, `GET /documents/{id}`, `POST /documents/{id}/revoke`, `POST /documents/{id}/download-log` |
| `public` | 4 | `GET /public/verify/token/{token}`, `GET /public/verify/so-van-ban/{so}`, `POST /public/verify/token/{token}/compare`, `GET /public/verify/recent` |
| `notifications` | 5 | `GET /notifications`, `/unread-count`, `POST /read-all`, `POST /{id}/read`, `DELETE /{id}` |
| `audit-logs` | 3 | `GET /audit-logs`, `/actions`, `/{id}` |
| `library` | 4 | `GET /library`, `/groups`, `/{id}`, `POST /{id}/download` |
| `request-types` | 3 | `GET /request-types`, `/stats`, `/{ma}` |
| `workflows` | 2 | `GET /workflows`, `/{ma}` |
| `users` | 4 | `GET /users`, `/advisors`, `/{maSo}`, `/{maSo}/request-types` |
| `catalog` | 20 | 5 danh mục × (`GET /`, `POST /`, `PATCH /{ma}`, `DELETE /{ma}`) |

`/auth/quick-login` chỉ hoạt động khi `ENABLE_QUICK_LOGIN=true` (mặc định trả 404).

### Định danh kép (quyết định B1)

Mọi endpoint đã xác thực nhận **mã nghiệp vụ** (ưu tiên) **hoặc UUID**:

| Tài nguyên | Mã nghiệp vụ | Ví dụ |
| --- | --- | --- |
| Hồ sơ | `maHoSo` | `MC-2026-001000` |
| Người dùng | `maSo` | `CV001` hoặc `20211234` |
| Loại đơn | `ma` | `rt_gxn` |
| Luồng duyệt | `ma` | `WF-01` |
| Danh mục | `ma` | `k_cntt`, `n_cntt`, `l_cntt01` |
| Văn bản | `soVanBan` (URL-encode vì có dấu `/`) | `1000/MVT-GXN-ĐHTB` |

Điều kiện (a) của B1 được ép ở tầng Zod: mã nghiệp vụ **không được có dạng UUID** → `VALIDATION_ERROR` (422).

## 5. Quyết định đã chốt khi hiện thực

Chi tiết ở `docs/QUYET_DINH.md` **Nhóm D (D1–D9)**:

| Mã | Nội dung |
| --- | --- |
| D1 | Danh sách chính xác endpoint bắt buộc `Idempotency-Key` (và các endpoint cố ý không bắt buộc) |
| D2 | Che PII cả trong phần chữ `trichYeu`/`noiDung` của văn bản công khai |
| D3 | Bộ đếm OTP ghi ngoài transaction nghiệp vụ (sửa lỗi chống dò mã) |
| D4 | `maHoSo` sinh ngay khi tạo nháp |
| D5 | `devOtp` chỉ trả về khi `NODE_ENV !== 'production'` |
| D6 | Đăng nhập không phân biệt hoa/thường với `maSo` |
| D7 | "Chiếm" bước phê duyệt nguyên tử → `ALREADY_PROCESSED` |
| D8 | Lọc hộp thư chờ duyệt bằng bộ nhớ (chưa denormalize `current_step_role`) |
| D9 | Phạm vi 83/112 thao tác; 29 thao tác hoãn sang Giai đoạn 3b/5/6/7 |

## 6. Kiểm thử — 50/50 ca đạt

Yêu cầu 5 bộ kiểm thử bắt buộc đều **đã có và đạt**:

| # | Yêu cầu | Tệp | Số ca |
| --- | --- | --- | --- |
| a | IDOR theo **mã nghiệp vụ** *và* **UUID** | `tests/idor.test.ts` | 9 |
| b | Phạm vi theo vai trò (SV, CVHT, trưởng khoa, Phòng Đào tạo) | `tests/scope.test.ts` | 7 |
| c | Xoay vòng refresh token + phát hiện dùng lại | `tests/refresh.test.ts` | 6 |
| d | API công khai **không** chứa họ tên/MSSV/email/SĐT đầy đủ | `tests/public-pii.test.ts` | 7 |
| e | Khuôn phản hồi + ánh xạ mã lỗi → HTTP | `tests/envelope.test.ts` | 15 |
| + | Vòng đời hồ sơ đầu-cuối (nộp → duyệt/OTP → cấp văn bản → tra cứu → thu hồi) | `tests/lifecycle.test.ts` | 6 |
| | **Tổng** | | **50** |

Đã phủ **đủ 12 mã lỗi** trong bảng ánh xạ: `UNAUTHORIZED` 401, `FORBIDDEN_SCOPE` 403,
`NOT_FOUND` 404, `INVALID_TRANSITION` 409, `ALREADY_PROCESSED` 409, `DUPLICATE_ACTION` 409,
`VALIDATION_ERROR` 422, `MISSING_ATTACHMENT` 422, `OTP_INVALID` 400, `OTP_EXPIRED` 410,
`DOCUMENT_REVOKED` 410, `OTP_LOCKED` 423.

### Lệnh chạy lại kiểm thử

```powershell
# 1) Bật PostgreSQL (Docker Desktop phải đang chạy)
cd <gốc dự án>
docker compose up -d postgres
docker compose ps            # chờ tới khi cột trạng thái là "healthy"

# 2) Chuẩn bị backend (chỉ lần đầu)
cd backend
npm install
npm run generate             # prisma generate
npm run migrate:deploy       # áp migration lên CSDL
npm run seed                 # nạp dữ liệu mẫu (mật khẩu demo: demo1234)

# 3) Kiểm tra kiểu + chạy toàn bộ kiểm thử
npm run typecheck            # tsc --noEmit
npm test                     # vitest run  → 6 tệp, 50 ca
```

Kết quả mong đợi:

```
 Test Files  6 passed (6)
      Tests  50 passed (50)
```

Chạy riêng một bộ:

```powershell
npx vitest run tests/idor.test.ts
npx vitest run tests/scope.test.ts tests/refresh.test.ts
```

> **Lưu ý:** kiểm thử chạy trên **CSDL thật** (cổng 5433) và tự dọn dẹp hồ sơ do nó tạo
> (`tests/helpers.ts` → `cleanupTracked`). Nhật ký kiểm toán do kiểm thử sinh ra **vẫn còn**
> vì bảng `audit_logs` là chỉ-ghi-thêm (đúng thiết kế). Chạy `npm run seed` để trả CSDL về mốc sạch.

## 7. Lỗi phát hiện trong khi kiểm thử (đã sửa)

| # | Lỗi | Ảnh hưởng | Cách sửa |
| --- | --- | --- | --- |
| 1 | Bộ đếm nhập sai OTP nằm trong cùng transaction với phê duyệt | Lỗi `OTP_INVALID` làm rollback → bộ đếm **không bao giờ tăng**, mất tác dụng chống dò mã | Ghi lượt sai bằng kết nối riêng (ngoài transaction) — quyết định **D3** |
| 2 | Phản hồi API công khai chỉ che `sinhVien`, nhưng `trichYeu`/`noiDung` vẫn chèn họ tên + MSSV đầy đủ | Rò rỉ PII qua API công khai, vi phạm A3 | Thêm `scrubText()` che ngay trong chuỗi — quyết định **D2** |
| 3 | `POST /catalog/*/{ma}` và `PATCH` yêu cầu UUID, trong khi `openapi.yaml` ghi `{ma}` | Sai hợp đồng B1 (không dùng được mã nghiệp vụ) | Thêm `findId()` quy đổi mã ↔ UUID cho cả 5 danh mục |
| 4 | Hồ sơ nháp chưa gắn `workflowId` → `submit` báo "Loại đơn chưa được gắn luồng duyệt" | Không thể nộp hồ sơ | Gán `workflowId` ngay khi tạo/sửa nháp |
| 5 | Truy vấn người dùng theo `maSo` phân biệt hoa/thường (`tk001` ≠ `TK001`) | Đăng nhập/kiểm thử bằng mã viết thường thất bại | So khớp không phân biệt hoa thường — quyết định **D6** |

Ngoài ra, khóa idempotency được ghi **đồng bộ trước khi xử lý** (giữ chỗ) và cập nhật kết quả sau;
yêu cầu trùng khóa chờ tối đa 2 giây để trả lại nguyên kết quả cũ — loại bỏ tình trạng tranh chấp
thời điểm trong kiểm thử.

## 8. Thay đổi phía frontend

### Trong Giai đoạn 3: **không có**

Toàn bộ endpoint ở tầng đọc (mà frontend đang gọi) giữ nguyên đường dẫn, tham số và tên trường
camelCase. Backend đã được viết để khớp `frontend/src/services/http/routes.ts` và các kiểu trong
`frontend/src/types`.

### Cần làm ở Giai đoạn 8 (đã ghi nhận, chưa đụng tới)

1. `client.ts`: bỏ lớp bao ngoài (`data`), dựng lại `Paginated` từ `meta`, đọc `error.details`
   (giữ tên `ApiError.chiTiet` để `OtpDialog.tsx` không phải sửa), tự làm mới token khi 401,
   đổi base URL thành `/api/v1`, bổ sung ánh xạ mã trạng thái 400/410/423.
2. `client.ts`: sinh `Idempotency-Key` (UUID) cho **mọi** `POST`/`PUT`/`PATCH` — nhờ vậy các
   endpoint không bắt buộc khóa vẫn nhận tiêu đề dư một cách an toàn (quyết định D1).
3. Bỏ `maskName`/`maskMssv` ở 3 trang công khai (đã che ở máy chủ — quyết định A3).
4. Nối OTP/SSE/tiến trình tải tệp thật; đặt `VITE_USE_MOCK=false`.

## 9. Hoãn sang giai đoạn sau (29/112 thao tác)

| Nhóm | Thao tác hoãn | Giai đoạn dự kiến |
| --- | --- | --- |
| Quản trị danh mục động | `POST|PATCH|DELETE /request-types`; `POST|PATCH|DELETE /workflows`; `POST /workflows/validate`; `POST|PATCH|DELETE /users`; `POST /users/{maSo}/reset-password` | 3b |
| Mẫu văn bản | `GET|POST /templates`, `GET|PATCH|DELETE /templates/{ma}`, `POST /templates/{ma}/render` | 3b/5 |
| Uỷ quyền | `GET|POST /delegations`, `DELETE /delegations/{id}`, `GET /delegations/eligible-users` | 3b |
| Văn bản (xuất/tải thật) | `GET /documents/{id}/export` (URL có chữ ký — B3), `GET /documents/report`, `GET /documents/report/rows`, `GET /files/{fileToken}` | 5 |
| Thời gian thực | `GET /notifications/stream` (SSE) | 6 |
| Trợ lý ảo | `POST /chat/stream`, `GET /chat/suggestions`, `POST /chat/messages/{messageId}/feedback` | 7 |

**Đã biết là còn thiếu (chưa có trong hợp đồng):**

- `429` (vượt giới hạn tần suất) chưa có mã lỗi trong hợp đồng → hiện dùng `UNKNOWN`, ghi nhận là lỗ hổng hợp đồng.
- Lọc hộp thư chờ duyệt bằng bộ nhớ (D8) — cần thêm cột `current_step_role` khi dữ liệu lớn.
- Tệp đính kèm hiện chỉ lưu **siêu dữ liệu** (tên/loại/kích thước); kho tệp thật ở Giai đoạn 5.
- `maBamSha256` đang băm nội dung văn bản dạng chuỗi; băm tệp PDF thật ở Giai đoạn 5.

## 10. Biến môi trường mới

Đã cập nhật `backend/.env.example` (không commit `.env` thật):

```
NODE_ENV, PORT,
JWT_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL,
PUBLIC_DOMAIN, CORS_ORIGINS, LOG_LEVEL,
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX,
ENABLE_QUICK_LOGIN, SIGNED_URL_TTL_MINUTES
```

Ở `NODE_ENV=production`, backend **từ chối khởi động** nếu `JWT_SECRET` vẫn là giá trị mặc định
(`assertProductionSecrets()`), và `npm run seed` **từ chối chạy**.

## 11. Cách chạy backend khi phát triển

```powershell
cd backend
npm run dev        # tsx watch src/server.ts  → http://localhost:8080/api/v1
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

Thử nhanh sau khi chạy `npm run dev`:

```powershell
$b = 'http://localhost:8080/api/v1'
$login = Invoke-RestMethod -Method Post -Uri "$b/auth/login" -ContentType 'application/json' `
  -Body (@{dinhDanh='20211234';matKhau='demo1234'} | ConvertTo-Json)
Invoke-RestMethod -Uri "$b/applications/mine?pageSize=5" -Headers @{Authorization="Bearer $($login.data.token)"}
Invoke-RestMethod -Uri "$b/public/verify/recent?limit=3"   # họ tên/MSSV đã được che
```
