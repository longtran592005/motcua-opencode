# Hợp đồng API Frontend — Cổng Một cửa điện tử TBU

Tài liệu này là **hợp đồng giữa frontend và backend** cho Cổng dịch vụ một cửa điện tử
của Trường Đại học Thái Bình (`motcua.tbu.edu.vn`).

Frontend hiện chạy hoàn toàn bằng **dữ liệu giả lập (mock)** trong `src/services/mock`.
Mọi truy cập dữ liệu của component đều đi qua một registry duy nhất:

```ts
import { services } from '@/services'

const hoSo = await services.applications.listMine({ page: 1, trangThai: 'PENDING_APPROVAL' })
```

Backend chỉ cần hiện thực đúng các interface trong `src/services/contracts/*.ts`
(danh sách đầy đủ ở mục 5) rồi đặt `VITE_USE_MOCK=false` là cổng chạy thật.

---

## 1. Cấu hình môi trường

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_USE_MOCK` | `true` | `false` → dùng service thật gọi HTTP tới `VITE_API_URL`. |
| `VITE_API_URL` | `http://localhost:8080/api` | Gốc API của backend. |
| `VITE_MOCK_ERROR_RATE` | `0.03` | Tỉ lệ lỗi ngẫu nhiên cho các thao tác **đọc** ở bản mock (để thử giao diện lỗi). |

Bản mock mô phỏng thêm:

- Độ trễ 300–600 ms cho mọi lời gọi.
- Lỗi ngẫu nhiên **chỉ với thao tác đọc**; thao tác ghi (nộp, duyệt, thu hồi…) luôn thành công để tiện trình diễn.
- Mã OTP chấp nhận là `123456` (hằng `MOCK_OTP_CODE`, **không bao giờ hiển thị trên giao diện**).
- Mật khẩu chung của các tài khoản demo là `demo1234`.
- Phiên đăng nhập lưu ở `localStorage` khoá `motcua.session.userId` và được khôi phục khi tải lại trang.

---

## 2. Mô hình lỗi

Mọi lỗi từ service ném ra `ApiError` (khai báo tại `src/types/common.ts`):

```ts
class ApiError extends Error {
  code: ErrorCode      // mã nghiệp vụ, xem bảng dưới
  status: number       // HTTP status tương ứng (0 = không kết nối được)
  chiTiet?: Record<string, unknown>  // dữ liệu bổ sung, ví dụ số lần OTP còn lại
}
```

### 2.1 Bảng mã lỗi

| `code` | HTTP gợi ý | Ý nghĩa |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Sai thông tin đăng nhập hoặc phiên hết hạn. |
| `FORBIDDEN_SCOPE` | 403 | Người dùng hợp lệ nhưng ngoài phạm vi được phép (không phải cấp duyệt của hồ sơ, khác khoa…). |
| `NOT_FOUND` | 404 | Không tìm thấy hồ sơ / văn bản / người dùng / danh mục. |
| `VALIDATION_ERROR` | 422 | Dữ liệu đầu vào không hợp lệ (thiếu trường bắt buộc, sai định dạng). |
| `INVALID_TRANSITION` | 409 | Chuyển trạng thái không hợp lệ (rút đơn đã duyệt, duyệt hồ sơ đã xử lý, thu hồi văn bản đã thu hồi…). |
| `OTP_INVALID` | 400 | Mã OTP nhập sai. `chiTiet.soLanConLai` = số lần thử còn lại. |
| `OTP_EXPIRED` | 410 | Phiên OTP hết hạn hoặc không tồn tại. |
| `OTP_LOCKED` | 423 | Khoá tạm 15 phút sau 5 lần nhập sai. `chiTiet.khoaDenLuc` = thời điểm mở khoá (ISO). |
| `MISSING_ATTACHMENT` | 422 | Thiếu giấy tờ bắt buộc khi nộp hồ sơ. `chiTiet.thieu` = danh sách `key` còn thiếu. |
| `ALREADY_PROCESSED` | 409 | Hồ sơ đã được người khác xử lý ở bước hiện tại. |
| `DOCUMENT_REVOKED` | 410 | Văn bản đã bị thu hồi, không còn hiệu lực để tra cứu/tải. |
| `NETWORK_ERROR` | 0 | Không kết nối được tới máy chủ. |
| `UNKNOWN` | — | Lỗi không xác định. |

### 2.2 Ánh xạ HTTP → mã lỗi (phía frontend)

`src/services/http/client.ts` suy ra mã lỗi từ HTTP status khi backend không trả `code`:

```
401 → UNAUTHORIZED      403 → FORBIDDEN_SCOPE     404 → NOT_FOUND
409 → INVALID_TRANSITION 422 → VALIDATION_ERROR    lỗi khác → UNKNOWN
mất kết nối → NETWORK_ERROR (status 0)
```

Backend **nên** trả JSON dạng `{ "code": "OTP_LOCKED", "message": "…", "chiTiet": { … } }`
để frontend hiển thị đúng thông điệp tiếng Việt.

---

## 3. Kiểu dữ liệu dùng chung

```ts
interface Paginated<T> {
  items: T[]
  total: number       // tổng số bản ghi
  page: number        // trang hiện tại, bắt đầu từ 1
  pageSize: number
  totalPages: number
}
```

`pageSize` mặc định `10` (hằng `PAGE_SIZE`). Mọi danh sách đều phân trang phía server.

### 3.1 Vai trò — `Role`

| Giá trị | Nhãn hiển thị | Phạm vi dữ liệu |
| --- | --- | --- |
| `SINH_VIEN` | Sinh viên | Chỉ hồ sơ của chính mình. |
| `CO_VAN` | Cố vấn học tập | Hồ sơ của sinh viên thuộc lớp mình phụ trách (`sinhVien.coVanId`). |
| `TRUONG_KHOA` | Trưởng khoa | Hồ sơ của sinh viên thuộc khoa mình (`sinhVien.donViId`). |
| `PHONG_DAO_TAO` | Phòng Đào tạo | Toàn trường. |
| `ADMIN` | Quản trị hệ thống | Toàn trường + cấu hình hệ thống. |

Thứ tự cấp duyệt: `APPROVAL_ROLES = ['CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO']`.

### 3.2 Trạng thái hồ sơ — `ApplicationStatus`

| Giá trị | Nhãn | Ghi chú |
| --- | --- | --- |
| `DRAFT` | Bản nháp | Sinh viên đang soạn, chưa nộp. `buocHienTai = null`. |
| `SUBMITTED` | Đã nộp | Vừa nộp, đang ở bước 1 (`currentStepOrder = 1`). |
| `PENDING_APPROVAL` | Đang chờ duyệt | Đang trong luồng, chờ một cấp duyệt. |
| `NEED_SUPPLEMENT` | Cần bổ sung | Quay về sinh viên; lưu `yeuCauBoSung.quayVeBuocOrder`. |
| `REJECTED` | Từ chối | Kết thúc; lưu `lyDoTuChoi`. |
| `COMPLETED` | Hoàn thành | Đã phát hành văn bản có QR; lưu `vanBanId`, `tokenXacThuc`, `soVanBan`. |
| `CANCELLED` | Đã rút | Sinh viên tự rút khi chưa cấp nào duyệt. |

### 3.3 Các enum khác

| Enum | Giá trị |
| --- | --- |
| `ApprovalMode` | `ONE_CLICK` (Một chạm), `OTP` (Ký OTP) |
| `DocumentStatus` | `VALID` (Hợp lệ), `REVOKED` (Đã thu hồi), `INVALID` (Không hợp lệ) |
| `SignatureMethod` | `OTP` (Ký số OTP), `ELECTRONIC` (Duyệt điện tử) |
| `UserStatus` | `ACTIVE`, `LOCKED` |
| `ApprovalActionType` | `SUBMIT`, `APPROVE`, `REJECT`, `REQUEST_SUPPLEMENT`, `SUPPLEMENT`, `CANCEL`, `ISSUE_DOCUMENT`, `REVOKE_DOCUMENT` |
| `NotificationType` | `INFO`, `SUCCESS`, `WARNING`, `DANGER` |
| `Gender` | `NAM`, `NU`, `KHAC` |
| `FieldType` (biểu mẫu động) | `text`, `textarea`, `number`, `date`, `select`, `radio`, `checkbox`, `upload` |

### 3.4 Kiểu thực thể chính

Các interface đầy đủ nằm trong `src/types/`:

| Kiểu | File | Ghi chú |
| --- | --- | --- |
| `User`, `Session`, `LoginPayload` | `User.ts` | Người dùng + phiên đăng nhập. |
| `Application`, `ApplicationDetail`, `Attachment`, `StudentSummary`, `SupplementRequest`, `CreateApplicationPayload`, `ApplicationListQuery` | `Application.ts` | `ApplicationDetail = Application + workflow + requestTypeFull`. |
| `ApprovalAction`, `Signature` | `ApprovalAction.ts`, `Signature.ts` | Lịch sử xử lý và chữ ký. |
| `Workflow`, `WorkflowStep` | `WorkflowStep.ts` | Luồng duyệt nhiều cấp. |
| `RequestType`, `AttachmentRequirement`, `FormField`, `FieldOption` | `RequestType.ts`, `FormField.ts` | Loại đơn + biểu mẫu động. |
| `SignedDocument`, `DocumentTemplate`, `VerifyResult`, `DocumentDownloadLog` | `SignedDocument.ts` | Văn bản đã cấp, mẫu, kết quả xác thực. |
| `Notification` | `Notification.ts` | Thông báo trong hệ thống. |
| `AuditLog` | `AuditLog.ts` | Nhật ký hệ thống. |
| `Khoa`, `PhongBan`, `Nganh`, `Lop`, `KhoaHoc` | `Catalog.ts` | Danh mục dùng chung. |
| `Delegation` | `contracts/delegation.ts` | Ủy quyền duyệt tạm thời. |

### 3.5 `ApplicationListQuery` — tham số lọc dùng cho mọi danh sách hồ sơ

```ts
{
  page?: number
  pageSize?: number
  trangThai?: ApplicationStatus | 'ALL'
  requestTypeId?: string
  tuKhoa?: string                 // tìm theo mã hồ sơ, họ tên, MSSV (không phân biệt dấu)
  khoa?: string
  lop?: string
  hanXuLy?: 'ALL' | 'SAP_HET_HAN' | 'QUA_HAN'
  sapXep?: 'MOI_NHAT' | 'CU_NHAT' | 'HAN_GAN_NHAT'
  choVaiTro?: string              // phía duyệt: chỉ lấy hồ sơ đang chờ vai trò này
}
```

---

## 4. Quy tắc nghiệp vụ backend phải đảm bảo

1. **Sinh mã hồ sơ**: `MC-<năm>-<6 chữ số>`, ví dụ `MC-2026-000123`. Mã bắt đầu từ `120`
   ở dữ liệu mẫu và tăng dần, không tái sử dụng.
2. **Sinh số văn bản**: `<số>/<mã loại đơn>-ĐHTB`, ví dụ `132/GXN-ĐHTB`.
3. **Chuyển bước tuần tự**: duyệt cấp 1 → cấp 2 → cấp 3 theo `WorkflowStep.order`.
   Chỉ người có `role` đúng với bước hiện tại mới được duyệt (`FORBIDDEN_SCOPE` nếu sai).
4. **Từ chối** kết thúc hồ sơ (`REJECTED`) và bắt buộc có lý do.
5. **Yêu cầu bổ sung** chuyển hồ sơ về `NEED_SUPPLEMENT`, lưu `quayVeBuocOrder`.
   Khi sinh viên bổ sung, hồ sơ quay lại **đúng bước đã yêu cầu**, không bắt đầu lại từ cấp 1.
6. **Rút đơn** chỉ cho phép khi chưa có cấp nào duyệt (`DRAFT`/`SUBMITTED`/`PENDING_APPROVAL`
   với `buocDaDuyet = 0`); ngược lại `INVALID_TRANSITION`.
7. **Nộp hồ sơ** phải kiểm tra đủ giấy tờ bắt buộc; thiếu → `MISSING_ATTACHMENT`.
8. **Hoàn thành hồ sơ** ở cấp cuối phải tự động phát hành văn bản, tạo `tokenXacThuc`
   duy nhất, mã băm SHA-256 nội dung và các bản ghi `Signature` cho từng cấp đã duyệt.
9. **OTP**: hạn 3 phút, chặn gửi lại 30 giây, sai tối đa 5 lần thì khoá 15 phút.
   Bước `mode: 'ONE_CLICK'` không cần OTP; bước `mode: 'OTP'` bắt buộc có `challengeId` + `otp`.
10. **Thu hồi văn bản** bắt buộc có lý do; sau khi thu hồi, tra cứu công khai trả
    trạng thái `ĐÃ THU HỒI` và tải tệp trả `DOCUMENT_REVOKED`.
11. **Xác thực công khai** không cần đăng nhập; che thông tin cá nhân theo quy tắc
    `Nguyễn V** A` và `2021***`.
12. **Ủy quyền duyệt**: trong khoảng `tuNgay`–`denNgay`, người nhận ủy quyền được xử lý
    hồ sơ đúng vai trò được ủy quyền.
13. **Nhật ký (audit)**: mọi thao tác ghi đều phải sinh bản ghi audit gồm người thực hiện,
    vai trò, hành động, đối tượng, giá trị trước/sau, IP, thiết bị.

---

## 5. Danh sách service (hợp đồng backend)

Quy ước: **Lỗi** liệt kê các mã nghiệp vụ có thể phát sinh ngoài lỗi chung
(`NETWORK_ERROR`, `UNKNOWN`). Endpoint ở cột cuối là gợi ý REST đã khai báo sẵn trong
`src/services/http/routes.ts`.

### 5.1 `services.auth` — Xác thực & phiên (`AuthService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `login` | `{ dinhDanh: string; matKhau: string }` | `Session` | `UNAUTHORIZED`, `VALIDATION_ERROR` | `POST /auth/login` |
| `quickLogin` | `role: Role` | `Session` | `NOT_FOUND` | `POST /auth/quick-login` |
| `me` | — | `User` | `UNAUTHORIZED` | `GET /auth/me` |
| `logout` | — | `void` | — | `POST /auth/logout` |
| `updateProfile` | `patch: Partial<User>` | `User` | `UNAUTHORIZED`, `VALIDATION_ERROR` | `PATCH /auth/profile` |

`Session = { token: string; user: User; hetHan: string }` (`hetHan` ISO 8601).

### 5.2 `services.applications` — Hồ sơ một cửa (`ApplicationService`)

Phía sinh viên:

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `listMine` | `query: ApplicationListQuery` | `Paginated<Application>` | `FORBIDDEN_SCOPE` | `GET /applications/mine` |
| `recentMine` | `limit?: number` (mặc định 5) | `Application[]` | — | `GET /applications/mine/recent` |
| `statsMine` | — | `MyStats` | — | `GET /applications/mine/stats` |
| `getByCode` | `maHoSo: string` | `ApplicationDetail` | `NOT_FOUND`, `FORBIDDEN_SCOPE` | `GET /applications/{ma}` |
| `createDraft` | `payload: CreateApplicationPayload` | `Application` | `VALIDATION_ERROR`, `FORBIDDEN_SCOPE` | `POST /applications` |
| `updateDraft` | `maHoSo, payload` | `Application` | `NOT_FOUND`, `INVALID_TRANSITION` | `PUT /applications/{ma}` |
| `deleteDraft` | `maHoSo: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` | `DELETE /applications/{ma}` |
| `submit` | `maHoSo: string` | `Application` | `NOT_FOUND`, `MISSING_ATTACHMENT`, `INVALID_TRANSITION` | `POST /applications/{ma}/submit` |
| `cancel` | `maHoSo, lyDo?: string` | `Application` | `INVALID_TRANSITION`, `FORBIDDEN_SCOPE` | `POST /applications/{ma}/cancel` |
| `supplement` | `maHoSo, input: SupplementInput` | `Application` | `NOT_FOUND`, `INVALID_TRANSITION`, `FORBIDDEN_SCOPE` | `POST /applications/{ma}/supplement` |

`MyStats = { nhap; dangXuLy; canBoSung; hoanThanh; tong }` (tất cả `number`).
`SupplementInput = { duLieu?: Record<string, unknown>; tepDinhKem?: Attachment[]; ghiChu?: string }`.

Phía người phê duyệt:

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `listForApproval` | `query: ApplicationListQuery` | `Paginated<Application>` | `FORBIDDEN_SCOPE` | `GET /approvals/pending` |
| `listProcessed` | `query: ApplicationListQuery` | `Paginated<Application>` | `FORBIDDEN_SCOPE` | `GET /approvals/processed` |
| `statsApproval` | — | `ApprovalStats` | `FORBIDDEN_SCOPE` | `GET /approvals/stats` |
| `listOverdue` | `limit?: number` | `Application[]` | `FORBIDDEN_SCOPE` | `GET /approvals/overdue` |

`ApprovalStats = { choToiDuyet; sapHetHan; quaHan; daXuLyTuanNay; theoTrangThai[]; theoLoaiDon[]; theoKhoa[]; xuHuong7Ngay[] }`.

Dùng chung:

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `requestTypes` | — | `RequestType[]` (chỉ loại đang hoạt động) | — | `GET /request-types?hoatDong=true` |
| `allowedRequestTypes` | `userId: string` | `RequestType[]` | `NOT_FOUND`, `FORBIDDEN_SCOPE` | `GET /users/{userId}/request-types` |
| `nextApproverRoles` | `maHoSo: string` | `Role[]` | `NOT_FOUND` | `GET /applications/{ma}/next-approver-roles` |

### 5.3 `services.approvals` — Phê duyệt nhiều cấp (`ApprovalService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `approve` | `ApproveInput` | `ApplicationDetail` | `FORBIDDEN_SCOPE`, `INVALID_TRANSITION`, `ALREADY_PROCESSED`, `VALIDATION_ERROR`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED` | `POST /approvals/{ma}/approve` |
| `reject` | `maHoSo, lyDo: string` | `ApplicationDetail` | `FORBIDDEN_SCOPE`, `INVALID_TRANSITION`, `VALIDATION_ERROR` | `POST /approvals/{ma}/reject` |
| `requestSupplement` | `maHoSo, noiDung: string` | `ApplicationDetail` | `FORBIDDEN_SCOPE`, `INVALID_TRANSITION`, `VALIDATION_ERROR` | `POST /approvals/{ma}/request-supplement` |
| `approveBatch` | `maHoSoList: string[], ghiChu?: string` | `BatchApproveResult` | `FORBIDDEN_SCOPE` | `POST /approvals/batch` |
| `pendingCount` | — | `number` | — | `GET /approvals/pending-count` |

```ts
ApproveInput = { maHoSo: string; ghiChu?: string; challengeId?: string; otp?: string }
BatchApproveResult = {
  thanhCong: string[]
  thatBai: { maHoSo: string; maLoi: string; lyDo: string }[]  // lỗi từng hồ sơ, không ném ra ngoài
}
```

`approveBatch` **không** ném lỗi khi một hồ sơ thất bại — trả về danh sách `thatBai`.

### 5.4 `services.otp` — Ký OTP (`OtpService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `gui` | `maHoSo: string` | `OtpChallenge` | `NOT_FOUND`, `FORBIDDEN_SCOPE`, `INVALID_TRANSITION` | `POST /otp/send` |
| `guiLai` | `challengeId: string` | `OtpChallenge` | `OTP_EXPIRED`, `OTP_LOCKED` | `POST /otp/{id}/resend` |
| `trangThai` | `challengeId: string` | `OtpChallenge` | `OTP_EXPIRED` | `GET /otp/{id}` |

```ts
OtpChallenge = {
  challengeId: string
  hetHanLuc: string        // ISO
  conLaiGiay: number       // đếm ngược hiển thị
  choGuiLaiGiay: number    // 0 khi đã được gửi lại
  soLanConLai: number      // số lần nhập sai còn lại
  khoaDenLuc?: string      // ISO, chỉ có khi đang bị khoá tạm
}
```

### 5.5 `services.delegations` — Ủy quyền duyệt (`DelegationService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | — | `Delegation[]` | `FORBIDDEN_SCOPE` | `GET /delegations` |
| `create` | `{ nguoiNhanId; vaiTro: Role; tuNgay; denNgay; lyDo }` | `Delegation` | `VALIDATION_ERROR`, `FORBIDDEN_SCOPE` | `POST /delegations` |
| `cancel` | `id: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` | `DELETE /delegations/{id}` |
| `eligibleUsers` | `vaiTro: Role` | `User[]` | `FORBIDDEN_SCOPE` | `GET /delegations/eligible-users?vaiTro=` |

### 5.6 `services.documents` — Văn bản đã cấp (`DocumentService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `getByApplication` | `maHoSo: string` | `SignedDocument` | `NOT_FOUND`, `INVALID_TRANSITION` (chưa cấp) | `GET /applications/{ma}/document` |
| `listIssued` | `query: DocumentListQuery` | `Paginated<SignedDocument>` | `FORBIDDEN_SCOPE` | `GET /documents` |
| `revoke` | `id, lyDo: string` | `SignedDocument` | `NOT_FOUND`, `INVALID_TRANSITION`, `VALIDATION_ERROR` | `POST /documents/{id}/revoke` |
| `logDownload` | `id: string` | `SignedDocument` | `NOT_FOUND`, `DOCUMENT_REVOKED` | `POST /documents/{id}/download-log` |
| `exportAs` | `id, dinhDang: 'pdf' \| 'html'` | `{ ten; noiDung; mime }` | `NOT_FOUND`, `DOCUMENT_REVOKED` | `GET /documents/{id}/export?dinhDang=` |
| `report` | — | `ReportOverview` | `FORBIDDEN_SCOPE` | `GET /documents/report` |
| `reportRows` | — | `{ theoLoaiDon; theoKhoa; theoTrangThai; thoiGianTungBuoc }` | `FORBIDDEN_SCOPE` | `GET /documents/report/rows` |

```ts
DocumentListQuery = {
  page?: number; pageSize?: number; tuKhoa?: string
  trangThai?: DocumentStatus | 'ALL'; loaiVanBan?: string
  khoa?: string; tuNgay?: string; denNgay?: string
}
ReportOverview = {
  tongHoSo; hoanThanh; dangXuLy; tuChoi; quaHan: number
  tyLeDungHan: number                  // %
  thoiGianXuLyTrungBinhGio: number
  theoLoaiDon: ReportRow[]; theoKhoa: ReportRow[]; theoTrangThai: ReportRow[]
  thoiGianTungBuoc: AvgStepDuration[]
  theoThang: { thang: string; nop: number; hoanThanh: number }[]
}
ReportRow = { ten: string; soLuong: number; tyLe: number }
AvgStepDuration = { buoc: string; vaiTro: string; gioTrungBinh: number; soHoSo: number }
```

`exportAs` ở bản mock trả HTML in được dùng với hộp thoại in của trình duyệt (“Lưu thành PDF”);
backend có thể trả PDF nhị phân (base64) hoặc URL tải.

### 5.7 `services.templates` — Mẫu văn bản (`TemplateService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | — | `DocumentTemplate[]` | — | `GET /templates` |
| `get` | `id: string` | `DocumentTemplate` | `NOT_FOUND` | `GET /templates/{id}` |
| `create` | `Omit<DocumentTemplate, 'id' \| 'capNhatLuc'>` | `DocumentTemplate` | `VALIDATION_ERROR` | `POST /templates` |
| `update` | `id, patch: Partial<DocumentTemplate>` | `DocumentTemplate` | `NOT_FOUND`, `VALIDATION_ERROR` | `PATCH /templates/{id}` |
| `remove` | `id: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` (đang được dùng) | `DELETE /templates/{id}` |
| `renderPreview` | `id, values: Record<string, string>` | `string` (nội dung đã điền) | `NOT_FOUND` | `POST /templates/{id}/render` |

Biến hợp lệ trong mẫu (đồng bộ với `TEMPLATE_KEYS` trong `src/lib/template.ts`):

```
{{ho_ten}} {{mssv}} {{ngay_sinh}} {{lop}} {{khoa}} {{nganh}} {{khoa_hoc}}
{{so_van_ban}} {{ngay_cap}} {{trich_yeu}} {{ly_do}} {{ten_truong}} {{het_han}}
```

### 5.8 `services.verify` — Tra cứu & xác thực công khai (`VerifyService`)

Không yêu cầu đăng nhập.

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `byToken` | `token: string` | `VerifyResult` | `NOT_FOUND` | `GET /public/verify/token/{token}` |
| `bySoVanBan` | `soVanBan: string` | `VerifyResult` | `NOT_FOUND` | `GET /public/verify/so-van-ban/{so}` |
| `compareFileHash` | `token, maBamNguoiDung: string` | `VerifyResult` | `NOT_FOUND` | `POST /public/verify/token/{token}/compare` |
| `recentDocuments` | `limit?: number` | `SignedDocument[]` | — | `GET /public/verify/recent` |

```ts
VerifyResult = {
  trangThai: DocumentStatus             // VALID | REVOKED | INVALID
  vanBan: SignedDocument
  ketQuaDoiChieu?: { maBamNguoiDung: string; trungKhop: boolean; luc: string }
}
```

Lưu ý: văn bản đã thu hồi **vẫn trả** `VerifyResult` với `trangThai = 'REVOKED'`
(màn hình hiển thị “ĐÃ THU HỒI”); chỉ khi tải nội dung mới trả `DOCUMENT_REVOKED`.

### 5.9 `services.notifications` — Thông báo (`NotificationService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `listMine` | — | `Notification[]` | `FORBIDDEN_SCOPE` | `GET /notifications` |
| `unreadCount` | — | `number` | — | `GET /notifications/unread-count` |
| `markRead` | `id: string` | `void` | `NOT_FOUND` | `POST /notifications/{id}/read` |
| `markAllRead` | — | `void` | — | `POST /notifications/read-all` |
| `remove` | `id: string` | `void` | `NOT_FOUND` | `DELETE /notifications/{id}` |

### 5.10 `services.library` — Thư viện biểu mẫu (`LibraryService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | `{ tuKhoa?: string; nhom?: string }` | `LibraryItem[]` | — | `GET /library` |
| `groups` | — | `string[]` | — | `GET /library/groups` |
| `get` | `id: string` | `LibraryItem` | `NOT_FOUND` | `GET /library/{id}` |
| `download` | `id: string` | `{ ten; noiDung; mime; url? }` | `NOT_FOUND` | `POST /library/{id}/download` |

`download` ghi nhận lượt tải. Backend nên trả về `url` là liên kết tải trực tiếp (hoặc liên kết có chữ ký, thời hạn ngắn) tới tệp gốc; frontend sẽ tải tệp nhị phân và lưu với tên `ten`. Nếu không có `url`, frontend tải `noiDung` dưới dạng văn bản.

`LibraryItem.loaiTep` nhận một trong các giá trị: `pdf`, `docx`, `doc`, `xlsx`, `xls`. `LibraryItem.url` là đường dẫn tệp trong `public/` (mock) hoặc URL CDN/object storage (thật).

> Bản mock hiện có 77 tài liệu thật của Trường Đại học Thái Bình (biểu mẫu sinh viên, biểu mẫu viên chức – người lao động, quy trình giải quyết thủ tục, thủ tục hành chính các phòng, danh mục thủ tục) được sao chép nguyên trạng vào `public/tai-lieu/...`.

### 5.11 `services.audit` — Nhật ký hệ thống (`AuditService`, chỉ đọc)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | `{ page?; pageSize?; tuKhoa?; nguoiThucHienId?; hanhDong?; tuNgay?; denNgay? }` | `Paginated<AuditLog>` | `FORBIDDEN_SCOPE` | `GET /audit-logs` |
| `get` | `id: string` | `AuditLog` | `NOT_FOUND`, `FORBIDDEN_SCOPE` | `GET /audit-logs/{id}` |
| `actions` | — | `{ ma: string; nhan: string }[]` | `FORBIDDEN_SCOPE` | `GET /audit-logs/actions` |

### 5.12 `services.chat` — Trợ lý ảo (`ChatService`)

| Hàm | Tham số | Trả về | Lỗi |
| --- | --- | --- | --- |
| `hoi` | `cauHoi: string` | `AsyncGenerator<ChatChunk>` (stream) | lỗi phát ra trong `ChatChunk.maLoi` |
| `cauHoiGoiY` | — | `string[]` | `NETWORK_ERROR` |
| `danhGia` | `messageId: string, huuIch: boolean` | `void` | `NOT_FOUND` |

```ts
ChatChunk = {
  loai: 'token' | 'nguon' | 'xong'
  noiDung?: string                       // mảnh nội dung đang chảy
  nguon?: { tenFile: string; trang: number; trichDoan: string }[]
  goiYForm?: { requestTypeId: string; ten: string }
  traLoiDayDu?: string                   // khi loai = 'xong'
  maLoi?: string                         // khi loai = 'xong' và có lỗi
}
```

Bản thật dùng **Server-Sent Events** tại `POST {VITE_API_URL}/chat/stream`, mỗi sự kiện
một dòng `data: <ChatChunk JSON>`, kết thúc bằng `data: [DONE]`.

### 5.13 `services.requestTypes` — Loại đơn & biểu mẫu (`RequestTypeService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | — | `RequestType[]` | — | `GET /request-types` |
| `listActive` | — | `RequestType[]` (chỉ `hoatDong = true`) | — | `GET /request-types?hoatDong=true` |
| `get` | `id: string` | `RequestType` | `NOT_FOUND` | `GET /request-types/{id}` |
| `create` | `Omit<RequestType, 'id'>` | `RequestType` | `VALIDATION_ERROR` | `POST /request-types` |
| `update` | `id, patch: Partial<RequestType>` | `RequestType` | `NOT_FOUND`, `VALIDATION_ERROR` | `PATCH /request-types/{id}` |
| `remove` | `id: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` (còn hồ sơ) | `DELETE /request-types/{id}` |
| `stats` | — | `{ requestTypeId; ten; ma; soLuong }[]` | `FORBIDDEN_SCOPE` | `GET /request-types/stats` |

Cấu trúc `RequestType`:

```ts
{
  id, ma, ten, nhom, moTa
  icon: string            // tên icon lucide-react
  mau: string             // token màu Tailwind: brand | emerald | amber | violet | rose
  formFields: FormField[]        // biểu mẫu động, sắp theo `order`
  giayTo: AttachmentRequirement[] // giấy tờ bắt buộc
  workflowId: string      // luồng duyệt áp dụng
  templateId: string      // mẫu văn bản khi hoàn thành
  soNgayXuLy: number
  lePhi: number           // VNĐ, 0 = miễn phí
  hoatDong: boolean
  soLuotNop?: number
}
FormField = {
  id, key, label, type: FieldType
  required: boolean; order: number
  readOnly?: boolean          // thông tin sinh viên tự điền
  placeholder?: string; helpText?: string
  width?: 'half' | 'full'
  options?: { label: string; value: string }[]   // select | radio | checkbox
  min?: number; max?: number; rows?: number
  accept?: string; maxSizeMb?: number            // upload
}
AttachmentRequirement = { key; label; batBuoc: boolean; accept?: string; helpText?: string }
```

Nhóm loại đơn (`REQUEST_TYPE_GROUPS`): Giấy xác nhận & Bảng điểm, Học vụ & Thi cử,
Nguyện vọng & Chuyển ngành, Tốt nghiệp & Bằng cấp.

### 5.14 `services.workflows` — Luồng duyệt (`WorkflowService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | — | `Workflow[]` | — | `GET /workflows` |
| `get` | `id: string` | `Workflow` | `NOT_FOUND` | `GET /workflows/{id}` |
| `create` | `Omit<Workflow, 'id'>` | `Workflow` | `VALIDATION_ERROR`, `INVALID_TRANSITION` | `POST /workflows` |
| `update` | `id, patch: Partial<Workflow>` | `Workflow` | `NOT_FOUND`, `VALIDATION_ERROR` | `PATCH /workflows/{id}` |
| `remove` | `id: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` (đang được dùng) | `DELETE /workflows/{id}` |
| `validate` | `Pick<Workflow, 'steps'>` | `{ hopLe: boolean; canhBao: string[] }` | `VALIDATION_ERROR` | `POST /workflows/validate` |

```ts
Workflow = { id; ma; ten; requestTypeIds: string[]; steps: WorkflowStep[]; hoatDong: boolean; capDo: 1 | 2 | 3 }
WorkflowStep = {
  id; order: number; ten: string
  role: Role                    // CO_VAN | TRUONG_KHOA | PHONG_DAO_TAO
  mode: ApprovalMode            // ONE_CLICK | OTP
  slaHours: number              // thời hạn xử lý, dùng để tính sắp hết hạn / quá hạn
  allowReject: boolean
  allowSupplement: boolean
  moTa?: string
}
```

`validate` kiểm tra: có ít nhất một bước, `order` liên tục từ 1, có ít nhất một bước OTP
(trả cảnh báo nếu không).

### 5.15 `services.users` — Người dùng & phân quyền (`UserService`)

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | `{ page?; pageSize?; tuKhoa?; vaiTro?: Role \| 'ALL'; trangThai?: UserStatus \| 'ALL'; donViId? }` | `Paginated<User>` | `FORBIDDEN_SCOPE` | `GET /users` |
| `get` | `id: string` | `User` | `NOT_FOUND` | `GET /users/{id}` |
| `create` | `Omit<User, 'id'>` | `User` | `VALIDATION_ERROR` | `POST /users` |
| `update` | `id, patch: Partial<User>` | `User` | `NOT_FOUND`, `VALIDATION_ERROR` | `PATCH /users/{id}` |
| `remove` | `id: string` | `void` | `NOT_FOUND` | `DELETE /users/{id}` |
| `resetPassword` | `id: string` | `{ matKhauTam: string }` | `NOT_FOUND` | `POST /users/{id}/reset-password` |
| `advisors` | — | `User[]` (vai trò `CO_VAN`) | `FORBIDDEN_SCOPE` | `GET /users/advisors` |

### 5.16 `services.catalog` — Danh mục dùng chung (`CatalogService`)

Mỗi danh mục là một `CrudService<T>` với cùng 4 hàm:

| Hàm | Tham số | Trả về | Lỗi | Endpoint |
| --- | --- | --- | --- | --- |
| `list` | — | `T[]` | — | `GET {base}` |
| `create` | `Omit<T, 'id'>` | `T` | `VALIDATION_ERROR` | `POST {base}` |
| `update` | `id, patch: Partial<T>` | `T` | `NOT_FOUND`, `VALIDATION_ERROR` | `PATCH {base}/{id}` |
| `remove` | `id: string` | `void` | `NOT_FOUND`, `INVALID_TRANSITION` | `DELETE {base}/{id}` |

| Thuộc tính | Kiểu | `base` |
| --- | --- | --- |
| `catalog.khoa` | `CrudService<Khoa>` | `/catalog/khoa` |
| `catalog.phongBan` | `CrudService<PhongBan>` | `/catalog/phong-ban` |
| `catalog.nganh` | `CrudService<Nganh>` | `/catalog/nganh` |
| `catalog.lop` | `CrudService<Lop>` | `/catalog/lop` |
| `catalog.khoaHoc` | `CrudService<KhoaHoc>` | `/catalog/khoa-hoc` |

```ts
Khoa     = { id; ma; ten; vietTat; truongKhoaId }
PhongBan = { id; ma; ten; vietTat; truongPhongId? }
Nganh    = { id; ma; ten; khoaId; khoaHocIds: string[] }
Lop      = { id; ma; ten; khoaId; nganhId; khoaHocId; coVanId; siSo }
KhoaHoc  = { id; ma; ten; namBatDau; namKetThuc }
```

### 5.17 `services.resetStore`

`resetStore(): void` — chỉ tồn tại ở bản mock, khôi phục toàn bộ dữ liệu giả lập về trạng
thái ban đầu (dùng cho trình diễn). Bản thật `VITE_USE_MOCK=false` không dùng hàm này.

---

## 6. Ghi chú triển khai phía frontend

- Component **không** bao giờ import dữ liệu mock trực tiếp; mọi truy cập đi qua
  hook React Query → `services.*`.
- Mọi danh sách có đủ 3 trạng thái: đang tải (skeleton), rỗng (`EmptyState`), lỗi
  (`ErrorState` + nút thử lại).
- Mọi thao tác ghi đều có toast kết quả; thao tác nguy hiểm (từ chối, thu hồi, rút đơn,
  xoá) đều qua `ConfirmDialog`.
- Bản mock trả HTML in được cho “Tải PDF”; khi nối backend thật có thể thay bằng PDF
  nhị phân mà không cần đổi giao diện.
- Lỗi `OTP_*` được xử lý riêng trong `OtpDialog` (đếm ngược, số lần còn lại, khoá tạm).

## 7. Kiểm thử nhanh

```bash
npm run dev                     # chạy với dữ liệu mock
npx tsc -b --pretty false       # kiểm tra kiểu
npx vite build                  # dựng bản sản xuất
```

Đăng nhập nhanh bằng nút “Đăng nhập nhanh theo vai trò” ở `/dang-nhap`
(mật khẩu chung `demo1234`). Mã OTP thử nghiệm: `123456`.
