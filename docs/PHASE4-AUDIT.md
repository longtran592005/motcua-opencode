# Giai đoạn 4 — Đối chiếu mã đã có với yêu cầu (làm trước khi viết)

Mục đích: **không viết trùng**. Dưới đây là kết quả rà soát mã Giai đoạn 3 so với yêu cầu
Giai đoạn 4 (workflow engine + chữ ký).

## 1. ĐÃ CÓ — giữ nguyên, không viết lại

| Yêu cầu Giai đoạn 4 | Tình trạng | Nơi | Ghi chú |
| --- | --- | --- | --- |
| Phê duyệt / từ chối / yêu cầu bổ sung | ✅ đã có | `modules/approvals/service.ts` | 3 hàm `approve`/`reject`/`requestSupplement` |
| Nộp / rút / bổ sung của sinh viên | ✅ đã có | `modules/applications/service.ts` | `submit`/`cancel`/`supplement` |
| Vòng đời OTP (tạo/gửi lại/trạng thái) | ✅ đã có | `modules/otp/service.ts` | |
| Khoá OTP 5 lần / 15 phút | ✅ đã có | `modules/otp/service.ts` (`consumeOtp`) | Đã sửa lỗi rollback ở Giai đoạn 3 |
| Cấp văn bản ở bước cuối + thu hồi | ✅ đã có | `modules/documents/issuer.ts`, `service.ts` | |
| `Idempotency-Key` (replay + `DUPLICATE_ACTION`) | ✅ đã có | `middleware/idempotency.ts` | Giữ chỗ đồng bộ, chờ 2 giây |
| `ALREADY_PROCESSED` khi tranh chấp | ✅ đã có (một phần) | `approvals/service.ts` | `updateMany` có điều kiện |
| Duyệt hàng loạt trả kết quả riêng từng đơn | ✅ đã có (một phần) | `approvals/service.ts` (`approveBatch`) | Đã trả `thanhCong`/`thatBai` theo từng đơn |
| Ghi nhật ký kiểm toán | ✅ đã có | `lib/audit.ts` | Bảng append-only |
| Gửi thông báo theo vai trò | ✅ đã có | `lib/notify.ts` | |
| Bảng `delegations` | ✅ đã có (chỉ CSDL) | `schema.prisma` | Chưa có service/route/logic áp dụng |
| Bảng `workflow_definitions`, `workflow_steps` | ✅ đã có | `schema.prisma` | Có `ma` + `version`; **chưa có** CRUD ghi |
| Phạm vi theo vai trò | ✅ đã có | `lib/scope.ts` | |
| Ánh xạ mã lỗi → HTTP | ✅ đã có | `lib/errors.ts` | **Thiếu `RATE_LIMITED`** |
| Duyệt hàng loạt chỉ cho bước ONE_CLICK | ✅ đã có | `approvals/service.ts` | |

## 2. CẦN VIẾT LẠI (mã cũ chưa đáp ứng yêu cầu mới)

| Vấn đề | Hiện trạng | Yêu cầu | Cách xử lý |
| --- | --- | --- | --- |
| **Không có hàm `transition()` dùng chung** | Máy trạng thái nằm rải rác trong `submit`, `cancel`, `supplement`, `approve`, `reject`, `requestSupplement` (6 nơi tự `update` trạng thái) | *"`transition()` là hàm duy nhất cho mọi chuyển trạng thái"* | Tạo `modules/workflow/engine.ts` với `transition()`; 6 nơi trên gọi lại nó |
| **Không khoá dòng** | Chỉ có `updateMany` điều kiện (lạc quan) — hai người đọc cùng lúc vẫn có thể cùng vào nhánh nghiệp vụ | *"khóa dòng `SELECT … FOR UPDATE`"* | `lockApplication(tx, id)` gọi `$queryRaw` `FOR UPDATE`, dùng đầu mọi `transition()` |
| **Luồng duyệt không đóng băng** | `approve` đọc bước từ `app.workflow.steps` (**bảng sống**) | *"chụp snapshot luồng khi nộp; đổi workflow sau đó không ảnh hưởng đơn đang chạy"* | Thêm cột `applications.workflow_snapshot` (JSONB); `submit` ghi snapshot và dựng `step_instances` từ snapshot; `stepsOf(app)` ưu tiên snapshot |
| **`supplement` quay về bước theo luồng sống** | `app.workflow.steps.find(...)` | *"bổ sung xong quay lại ĐÚNG cấp đã yêu cầu"* | Dùng `stepAt(app, quayVeBuocOrder)` trên snapshot |
| **Chữ ký chưa kiểm chứng được** | `maBam = sha256(maHoSo\|bước\|user\|duLieu\|thờiGian)`; `maChuKy = 8 ký tự của mã băm` → **không phải chữ ký**, không phát hiện được sửa nội dung | *"`SignatureProvider` (InternalHmac/RSA từ env, `content_hash` canonical JSON, verify thất bại khi nội dung đổi sau ký, lớp rỗng cho CA ngoài)"* | Tạo `lib/signature.ts`; `contentHash` = SHA-256 của JSON canonical; HMAC/RSA thật |
| **Không có job SLA** | Chỉ có truy vấn `listOverdue` (đọc) | *"job SLA: đánh dấu quá hạn, nhắc trước hạn, leo thang theo `escalate_to`"* | Tạo `modules/workflow/sla.ts` + hẹn giờ ở `server.ts` |
| **`WorkflowStep` không có `escalate_to`** | Chỉ có `slaHours`, `allowReject`, `allowSupplement` | *"leo thang theo `escalate_to`"* | Thêm cột `escalate_to`, `nhac_truoc_gio`, `leo_thang_sau_gio` |
| **OTP trả trong response (`devOtp`)** | `toView()` gắn `devOtp` khi không phải production | *"OTP không bao giờ nằm trong response, log có cấu trúc hay audit log"* | **Bỏ `devOtp`**; thay bằng `NotificationChannel` (dev in console, test ghi vào bộ nhớ, thiếu kênh → từ chối gửi) |
| **429 dùng `UNKNOWN`** | `rateLimit.ts` trả mã `UNKNOWN` | *"thêm `RATE_LIMITED` kèm `Retry-After`"* | Thêm mã lỗi + header |
| **`pickAssignee` bỏ qua uỷ quyền** | Chỉ tra lớp/khoa | *"áp dụng [ủy quyền] khi gán người duyệt, kiểm tra hiệu lực theo ngày"* | `pickAssignee` xét `Delegation` còn hiệu lực theo ngày |

## 3. CÒN THIẾU HOÀN TOÀN — phải viết mới

1. `modules/workflow/engine.ts` — `transition()`, `lockApplication()`, snapshot, ma trận chuyển trạng thái.
2. `modules/workflow/sla.ts` — `runSlaJob()` (quá hạn / nhắc trước hạn / leo thang).
3. `modules/delegations/{schemas,service,routes}.ts` — CRUD + `eligible-users` + hiệu lực theo ngày.
4. `modules/requestTypes` — thêm `POST`, `PATCH /{ma}`, `DELETE /{ma}`.
5. `modules/workflows` — thêm `POST`, `PATCH /{ma}` (tạo phiên bản mới), `DELETE /{ma}`, `POST /validate`.
6. `modules/users` — thêm `POST`, `PATCH /{maSo}`, `DELETE /{maSo}`, `POST /{maSo}/reset-password`.
7. `lib/signature.ts` — `SignatureProvider` (InternalHmac / RSA / lớp rỗng CA ngoài) + `canonicalJson` + `contentHash` + `verifySignature`.
8. `modules/otp/channel.ts` — `NotificationChannel` cho OTP.
9. `scripts/benchmark-inbox.ts` — seed 10.000 đơn + `EXPLAIN ANALYZE` hộp thư "Chờ tôi duyệt".
10. Bộ kiểm thử mới (tranh chấp, ma trận chuyển trạng thái, chữ ký, uỷ quyền, SLA, kênh OTP,
    rate limit, CRUD quản trị, tích hợp 1/2/3 cấp).

## 4. Ghi chú phạm vi

- **Tên chế độ duyệt:** yêu cầu viết `ONE_TOUCH` / `OTP_SIGN`, nhưng frontend đã chốt
  `ApprovalMode = ONE_CLICK | OTP` (xem `docs/PHASE2-REPORT.md`, mục enum). Giữ `ONE_CLICK`/`OTP`
  để không phá hợp đồng frontend; ghi rõ ánh xạ trong báo cáo.
- **Dời sang giai đoạn sau** (theo yêu cầu): `templates` → đầu Giai đoạn 5;
  `documents/export`, `files/{fileToken}`, báo cáo → Giai đoạn 5–6;
  `notifications/stream` → Giai đoạn 6; `chat/*` → Giai đoạn 7.
- **Chưa denormalize `current_step_role`.** Thay vào đó đo hiệu năng hộp thư "Chờ tôi duyệt"
  với 10.000 đơn (mục 3.9) và chỉ đề xuất tối ưu nếu chậm.
