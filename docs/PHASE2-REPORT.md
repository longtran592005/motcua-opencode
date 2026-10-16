# Báo cáo GIAI ĐOẠN 2 — PostgreSQL + Prisma + ERD + seed + docker-compose

Trạng thái: **Hoàn thành** (CSDL, migration, seed, ERD, docker-compose).

## 1. Sản phẩm

| Tệp | Mô tả |
| --- | --- |
| `backend/prisma/schema.prisma` | Lược đồ CSDL: 31 bảng, 12 enum, UUID, snake_case ↔ camelCase, xóa mềm |
| `backend/prisma/migrations/20260101120000_init/migration.sql` | Migration khởi tạo (sinh bằng `prisma migrate diff`) |
| `backend/prisma/migrations/20260101120100_business_rules/migration.sql` | Quy tắc nghiệp vụ: sequence mã hồ sơ, CHECK, trigger append-only, chỉ mục |
| `backend/prisma/seed.ts` | Nạp dữ liệu thật từ snapshot mock, UUID v5 tất định |
| `backend/prisma/seed-data.json` | Snapshot dữ liệu mock (35 hồ sơ, 35 người dùng, 77 tài liệu…) |
| `backend/package.json`, `tsconfig.json`, `.env.example` | Cấu hình backend/Prisma |
| `frontend/scripts/dump-seed.ts` | Sinh `seed-data.json` từ dữ liệu mock frontend |
| `docker-compose.yml` | PostgreSQL 16 cho phát triển (cổng 5433) |
| `docs/erd.md` | ERD Mermaid + ghi chú thiết kế |
| `docs/QUYET_DINH.md` | 3 quyết định A + 3 quyết định B đã chốt |
| `docs/openapi.yaml` | Bổ sung quy tắc 409/idempotency, điều kiện định danh, `exportAs` |

## 2. Mô hình dữ liệu

### Nhóm bảng

| Nhóm | Bảng |
| --- | --- |
| Tổ chức | `faculties`, `departments`, `academic_years`, `majors`, `major_academic_years`, `staff_positions`, `classes`, `users`, `students` |
| Loại đơn & luồng | `request_types`, `request_type_fields`, `required_documents`, `workflow_definitions`, `workflow_steps` |
| Hồ sơ | `applications`, `application_attachments`, `step_instances`, `approvals`, `idempotency_keys`, `delegations` |
| Ký số & văn bản | `signatures`, `otp_challenges`, `document_templates`, `signed_documents`, `document_downloads` |
| Thông báo & nhật ký | `notifications`, `audit_logs`, `library_documents` |
| Trợ lý ảo & phiên | `chat_sessions`, `chat_messages`, `refresh_tokens` |

### Enum (khớp 100% kiểu frontend, không đổi tên)

`Role`, `UserStatus`, `Gender`, `ApplicationStatus`, `ApprovalMode` (`ONE_CLICK` | `OTP`),
`StepStatus`, `DocumentStatus`, `SignatureMethod`, `NotificationType`, `FieldType`,
`ApprovalActionType`, `ChatRole`.

> Lưu ý: bản nháp Giai đoạn 0 gọi chế độ duyệt là `ONE_TOUCH` / `OTP_SIGN`; để khớp frontend
> đã chốt, CSDL dùng `ApprovalMode` = `ONE_CLICK` / `OTP`.

### Định danh công khai (trường `ma`)

Theo yêu cầu, `ma` giữ **giá trị định danh cũ của mock** cho dữ liệu danh mục:

| Bảng | Giá trị `ma` | Ví dụ |
| --- | --- | --- |
| `faculties` | id mock | `k_cntt`, `k_kt` |
| `departments` | id mock | `p_pdt`, `p_ctsv` |
| `academic_years` | id mock | `kh_k18`, `kh_k19` |
| `majors` | id mock | `n_cntt` |
| `classes` | id mock | `l_cntt1_k19` |
| `request_types` | id mock | `rt_gxn`, `rt_dbt` |
| `users` | `maSo` | `20211234`, `CV001`, `TK001`, `PDT001`, `ADMIN` |
| `workflow_definitions` | `ma` sẵn có | `WF-01`, `WF-02`, `WF-03` |
| `document_templates` | `ma` sẵn có | `MVT-GXN`, `MVT-DBT` |

## 3. Quy tắc nghiệp vụ trong CSDL (migration thứ hai)

1. **Sequence mã hồ sơ:** `application_code_seq` (bắt đầu 1000) + hàm `next_ma_ho_so()` sinh
   `MC-YYYY-NNNNNN` (điều kiện B-c, an toàn đồng thời).
2. **Mã nghiệp vụ không được có dạng UUID:** 11 ràng buộc `CHECK` trên `ma` / `ma_so` / `ma_ho_so`
   (điều kiện B1-a); thêm ràng buộc định dạng `^MC-[0-9]{4}-[0-9]{6}$` cho `ma_ho_so`.
3. **Bảo vệ dữ liệu nhạy cảm:**
   - `signed_documents.token_xac_thuc` ≥ 32 ký tự (≈ 128 bit);
   - `signed_documents.ma_bam_sha256` đúng 64 ký tự hex (SHA-256);
   - `otp_challenges.otp_hash` ≥ 32 ký tự (chỉ lưu băm, không bao giờ lưu mã thô).
4. **`audit_logs` chỉ ghi thêm:** trigger `audit_logs_append_only` chặn `UPDATE`/`DELETE`.
5. **Chỉ mục phục vụ truy vấn nóng:** hộp thư theo vai trò (`step_instances`), thông báo chưa đọc
   (partial index), văn bản còn hiệu lực (partial index), hồ sơ đang xử lý (partial index).

## 4. Kết quả nạp dữ liệu (số liệu thực tế từ CSDL)

| Nhóm | Số bản ghi |
| --- | --- |
| Khoa / Phòng ban / Vị trí viên chức | 6 / 5 / 5 |
| Khóa học / Ngành / Ngành–khóa / Lớp | 4 / 10 / 32 / 9 |
| Người dùng / Hồ sơ sinh viên | 35 / 20 |
| Loại đơn / Trường biểu mẫu / Giấy tờ bắt buộc | 5 / 61 / 6 |
| Luồng duyệt / Bước duyệt | 3 / 6 |
| Mẫu văn bản / Thư viện tài liệu | 5 / 77 |
| Hồ sơ / Tệp đính kèm / Bước xử lý | 35 / 34 / 67 |
| Phê duyệt (lịch sử) / Chữ ký | 82 / 28 |
| Văn bản đã cấp / Lượt tải | 12 / 27 |
| Thông báo / Nhật ký | 15 / 20 |

Phân bố trạng thái hồ sơ: `COMPLETED` 12, `PENDING_APPROVAL` 9, `NEED_SUPPLEMENT` 4,
`REJECTED` 3, `SUBMITTED` 3, `DRAFT` 2, `CANCELLED` 2.
Trạng thái văn bản: `VALID` 10, `REVOKED` 1, `INVALID` 1.
Trạng thái bước duyệt: `APPROVED` 28, `PENDING` 22, `IN_PROGRESS` 9, `SKIPPED` 5, `REJECTED` 3.

Giá trị `ma` kiểm chứng: `request_types.ma` = `rt_gxn, rt_dbt, rt_dht, rt_dbl, rt_dcn`;
`faculties.ma` = `k_cntt, k_dn, k_kt, k_ktcn, k_nn, k_sp`; `users.ma_so` = `20211234, CV001, TK001, PDT001, ADMIN`. `token_xac_thuc` dài 64 ký tự (256 bit).

## 4b. Bổ sung theo yêu cầu xác nhận (đã áp dụng và kiểm chứng)

| Yêu cầu | Thực hiện |
| --- | --- |
| Thêm mã ngành chính thức | Cột `majors.ma_chinh_thuc` (nullable, **unique khi có giá trị**) — migration `20260101130000_demo_flag_and_major_code`; seed điền đủ 10/10 ngành (vd `n_cntt`→`7480201`); OpenAPI thêm `maChinhThuc` vào `Nganh` và `NganhInput` |
| CHECK + unique cho workflow/mẫu văn bản | Đã có sẵn: `workflow_definitions` unique `(ma, version)`, `document_templates` unique `ma`, cả hai có CHECK `ma` ≠ UUID — đã kiểm chứng bằng truy vấn và test chèn |
| Cờ dữ liệu demo | `is_demo` trên 17 bảng được seed; seed đặt `true` cho toàn bộ bản ghi demo; chỉ mục hỗ trợ xóa gọn |
| Xóa gọn dữ liệu demo | `backend/prisma/purge-demo.sql` + `npm run demo:purge` |
| Chặn seed ở production | `prisma/seed.ts` thoát với thông báo rõ ràng khi `NODE_ENV=production` (đã kiểm chứng: exit code 1) |
| Tài khoản demo | Mật khẩu bcrypt; danh sách tài khoản ghi trong `README.md` (ghi rõ chỉ môi trường dev) |
| Hướng dẫn vận hành | `docs/QUY_TRINH_VAN_HANH.md` (cổng 5433 + cách đổi, xóa demo, sao lưu/phục hồi, hash/token tạm) |
| Cổng dev 5433 | Ghi vào `docs/QUYET_DINH.md` mục C1 |

Kiểm chứng bổ sung: `majors.ma_chinh_thuc` đủ 10 giá trị; `users/applications/signed_documents/audit_logs/
library_documents` có `is_demo = true` toàn bộ, `0` bản ghi ngoài demo; chèn `workflow_definitions.ma`
dạng UUID bị chặn (`23514`); chèn trùng `document_templates.ma` bị chặn (`23505`).

## 5. Thay đổi ở frontend trong giai đoạn này

| Thay đổi | Chi tiết |
| --- | --- |
| Chuyển sang monorepo | Toàn bộ mã frontend chuyển vào `frontend/` **giữ nguyên giao diện**; `tsc -b` và `vite build` vẫn đạt sau khi chuyển |
| Thêm `frontend/scripts/dump-seed.ts` | Script kết xuất dữ liệu mock ra JSON phục vụ seed (không ảnh hưởng giao diện) |
| Thêm mã lỗi `DUPLICATE_ACTION` | Bổ sung vào `ERROR_CODES` trong `frontend/src/types/common.ts` để khớp quyết định B2 (chỉ thêm vào union, không đổi hành vi) |
| `README.md` ở gốc | Viết lại theo monorepo (README cũ giữ ở `frontend/`) |

> **Chưa sửa giao diện.** Các thay đổi tầng gọi API (`httpClient`, bỏ che PII trên 3 trang, bỏ OTP
> demo…) vẫn để nguyên cho **Giai đoạn 8** như kế hoạch.

## 6. Cách kiểm thử

```powershell
# 1) Cơ sở dữ liệu
docker compose up -d postgres          # PostgreSQL 16, cổng 5433

# 2) Backend
cd backend
npm install
npx prisma migrate deploy              # tạo bảng + quy tắc nghiệp vụ
npm run seed                           # nạp dữ liệu

# 3) Kiểm tra nhanh bằng Prisma Studio
npm run studio
```

Sinh lại snapshot dữ liệu mock (khi dữ liệu frontend thay đổi):

```powershell
cd frontend
npx tsx --tsconfig tsconfig.app.json scripts/dump-seed.ts
```

## 7. Kết quả kiểm chứng (đã chạy thật trên PostgreSQL 16)

| Hạng mục | Lệnh / cách kiểm | Kết quả |
| --- | --- | --- |
| Lược đồ hợp lệ | `npx prisma validate` | ✅ *The schema is valid* |
| Kiểu TypeScript backend | `npx tsc --noEmit` | ✅ 0 lỗi |
| Áp dụng migration | `npx prisma migrate deploy` | ✅ 2 migration áp dụng thành công |
| Nạp dữ liệu | `npm run seed` | ✅ khớp số liệu mục 4 |
| Sequence mã hồ sơ | `SELECT next_ma_ho_so()` | ✅ trả `MC-2026-001000` |
| Ràng buộc mã ≠ UUID | `INSERT faculties(ma='1111…')` | ✅ chặn, SQLSTATE `23514` |
| Ràng buộc định dạng mã hồ sơ | `INSERT applications(ma_ho_so='SAI-MA')` | ✅ chặn, SQLSTATE `23514` |
| Chỉ lưu băm OTP | `INSERT otp_challenges(otp_hash='123456')` | ✅ chặn, SQLSTATE `23514` |
| `audit_logs` chỉ ghi thêm | `UPDATE` / `DELETE` trên `audit_logs` | ✅ chặn cả hai, SQLSTATE `42501` |
| Chỉ mục truy vấn nóng | `pg_indexes` | ✅ đủ 4 chỉ mục + trigger `audit_logs_append_only` |
| Token ≥ 128 bit | `min/max(char_length(token_xac_thuc))` | ✅ `64..64` (256 bit) |
| Giao diện không đổi sau khi chuyển monorepo | `npm run build` (frontend) | ✅ `tsc -b` sạch, `vite build` thành công |

## 8. Việc còn lại của giai đoạn này / chuyển sang Giai đoạn 3

- `signed_documents.ma_bam_sha256` trong seed là giá trị của mock (chưa phải SHA-256 thật của tệp PDF);
  **Giai đoạn 5** sẽ tính SHA-256 thật khi render PDF.
- `token_xac_thuc` của seed đã được sinh lại thành 256 bit (mock chỉ 96 bit) để thoả ràng buộc ≥ 128 bit.
- Prisma 6.19 cảnh báo `package.json#prisma` sẽ bị bỏ ở Prisma 7; sẽ chuyển sang `prisma.config.ts`
  ở Giai đoạn 3 (không ảnh hưởng hoạt động hiện tại).
- **Giai đoạn 3:** dựng API Node/Express + Zod + RBAC + xác thực, dùng trực tiếp lược đồ này;
  mọi `ma`/`ma_so`/`ma_ho_so` là tham số đường dẫn công khai, UUID chỉ là khóa nội bộ.
