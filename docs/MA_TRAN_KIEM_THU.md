# Ma trận kiểm thử API

Tài liệu này được **sinh tự động** bởi `scripts/coverage-matrix.ts` từ `docs/openapi.yaml`, mã nguồn `backend/src` và các file trong `backend/tests`.

Không sửa tay. Khi thêm API hoặc thêm test, chạy lại `npm run check:matrix`.

## Tóm tắt (đọc nhanh)

| Chỉ số | Số lượng |
| --- | ---: |
| Tổng thao tác trong hợp đồng OpenAPI | 112 |
| Đã làm trên backend | 93 |
| Chưa làm trên backend | 19 |
| Đã có ít nhất một ca kiểm thử | 44 |
| Đã làm nhưng chưa có test (cổng chặn CI) | 49 |

- **Đã làm**: máy chủ đã có đường dẫn này.
- **Chưa làm**: mới có trên tài liệu API, chưa có trên máy chủ — vẫn giữ dòng, không xóa.
- **Số ca**: thành công / lỗi nghiệp vụ / lỗi quyền / lỗi dữ liệu / TODO (đếm từ tên ca kiểm thử).

## Thao tác đã làm nhưng chưa có test

Những dòng này làm lệnh `npm run check:matrix` thất bại. Cần viết test (kế hoạch: phần kiểm thử API).

- `POST /auth/quick-login` — Đăng nhập nhanh theo vai trò (CHỈ TRÌNH DIỄN)
- `PATCH /auth/profile` — Cập nhật hồ sơ cá nhân
- `GET /applications/mine/recent` — Vài hồ sơ gần đây của sinh viên (trừ bản nháp)
- `GET /applications/mine/stats` — Thống kê nhanh hồ sơ của sinh viên
- `GET /applications/{maHoSo}/next-approver-roles` — Vai trò của bước duyệt kế tiếp
- `GET /approvals/processed` — Hồ sơ người đăng nhập đã xử lý
- `GET /approvals/stats` — Thống kê phục vụ trang tổng quan
- `GET /approvals/overdue` — Hồ sơ quá hạn hoặc sắp hết hạn
- `GET /approvals/pending-count` — Số hồ sơ đang chờ (badge menu)
- `POST /approvals/batch` — Duyệt hàng loạt các bước Một chạm
- `GET /otp/{challengeId}` — Trạng thái phiên OTP (đếm ngược)
- `GET /notifications` — Danh sách thông báo của người đăng nhập
- `GET /notifications/unread-count` — Số thông báo chưa đọc
- `POST /notifications/read-all` — Đánh dấu tất cả đã đọc
- `POST /notifications/{id}/read` — Đánh dấu một thông báo đã đọc
- `DELETE /notifications/{id}` — Xoá thông báo
- `GET /library` — Danh sách biểu mẫu & tài liệu (công khai)
- `GET /library/groups` — Danh sách nhóm tài liệu (công khai)
- `GET /library/{id}` — Chi tiết một tài liệu (công khai)
- `POST /library/{id}/download` — Ghi nhận lượt tải và trả mô tả tệp (công khai)
- `GET /audit-logs/actions` — Danh sách mã hành động đã xuất hiện
- `GET /audit-logs/{id}` — Chi tiết một bản ghi nhật ký
- `GET /request-types` — Danh sách loại đơn
- `GET /request-types/stats` — Số lượt nộp theo từng loại đơn
- `GET /request-types/{ma}` — Chi tiết loại đơn theo mã
- `PATCH /request-types/{ma}` — Cập nhật loại đơn
- `GET /workflows` — Danh sách luồng duyệt
- `GET /workflows/{ma}` — Chi tiết luồng theo mã
- `GET /users` — Danh sách người dùng
- `GET /users/advisors` — Danh sách cố vấn học tập
- `GET /users/{maSo}` — Chi tiết người dùng theo mã số
- `DELETE /users/{maSo}` — Xoá người dùng (không xoá ADMIN)
- `GET /users/{maSo}/request-types` — Các loại đơn được phép nộp cho một người dùng
- `GET /catalog/phong-ban` — Danh sách phòng ban
- `POST /catalog/phong-ban` — Tạo phòng ban
- `PATCH /catalog/phong-ban/{ma}` — Cập nhật phòng ban
- `DELETE /catalog/phong-ban/{ma}` — Xoá phòng ban
- `GET /catalog/nganh` — Danh sách ngành
- `POST /catalog/nganh` — Tạo ngành
- `PATCH /catalog/nganh/{ma}` — Cập nhật ngành
- `DELETE /catalog/nganh/{ma}` — Xoá ngành
- `GET /catalog/lop` — Danh sách lớp
- `POST /catalog/lop` — Tạo lớp
- `PATCH /catalog/lop/{ma}` — Cập nhật lớp
- `DELETE /catalog/lop/{ma}` — Xoá lớp
- `GET /catalog/khoa-hoc` — Danh sách khóa học
- `POST /catalog/khoa-hoc` — Tạo khóa học
- `PATCH /catalog/khoa-hoc/{ma}` — Cập nhật khóa học
- `DELETE /catalog/khoa-hoc/{ma}` — Xoá khóa học

## Thao tác chưa làm

| Thao tác | Việc sẽ làm | Giai đoạn dự kiến |
| --- | --- | --- |
| `GET /documents/{id}/export` | Xuất văn bản để tải/in | Giai đoạn báo cáo / xuất tệp (sau) |
| `GET /documents/report` | Tổng quan báo cáo thống kê | Giai đoạn báo cáo / xuất tệp (sau) |
| `GET /documents/report/rows` | Các bảng số liệu chi tiết của báo cáo | Giai đoạn báo cáo / xuất tệp (sau) |
| `GET /files/{fileToken}` | Tải tệp nhị phân bằng liên kết có chữ ký (KHÔNG bọc phong bì) | Giai đoạn lưu trữ tệp (sau) |
| `GET /templates` | Danh sách mẫu văn bản | Giai đoạn mẫu văn bản (sau) |
| `POST /templates` | Tạo mẫu văn bản | Giai đoạn mẫu văn bản (sau) |
| `GET /templates/{ma}` | Chi tiết mẫu theo mã | Giai đoạn mẫu văn bản (sau) |
| `PATCH /templates/{ma}` | Cập nhật mẫu văn bản | Giai đoạn mẫu văn bản (sau) |
| `DELETE /templates/{ma}` | Xoá mẫu văn bản | Giai đoạn mẫu văn bản (sau) |
| `POST /templates/{ma}/render` | Kết xuất mẫu với bộ giá trị cho trước | Giai đoạn mẫu văn bản (sau) |
| `GET /notifications/stream` | Kênh SSE chuông thông báo realtime (KHÔNG bọc phong bì) | Giai đoạn thông báo realtime (sau) |
| `POST /chat/stream` | Hỏi trợ lý ảo, trả lời dạng streaming SSE (KHÔNG bọc phong bì) | Giai đoạn trợ lý ảo (sau) |
| `GET /chat/suggestions` | Câu hỏi gợi ý | Giai đoạn trợ lý ảo (sau) |
| `POST /chat/messages/{messageId}/feedback` | Đánh giá câu trả lời hữu ích / không hữu ích | Giai đoạn trợ lý ảo (sau) |
| `GET /catalog/khoa/{ma}` | Chi tiết khoa theo mã | Giai đoạn hoàn thiện danh mục (sau) |
| `GET /catalog/phong-ban/{ma}` | Chi tiết phòng ban theo mã | Giai đoạn hoàn thiện danh mục (sau) |
| `GET /catalog/nganh/{ma}` | Chi tiết ngành theo mã | Giai đoạn hoàn thiện danh mục (sau) |
| `GET /catalog/lop/{ma}` | Chi tiết lớp theo mã | Giai đoạn hoàn thiện danh mục (sau) |
| `GET /catalog/khoa-hoc/{ma}` | Chi tiết khóa học theo mã | Giai đoạn hoàn thiện danh mục (sau) |

## Xác thực

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `POST /auth/login`<br>Đăng nhập bằng mã số/email và mật khẩu | Công khai | Đã làm | `backend/tests/admin-crud.test.ts`<br>`backend/tests/envelope.test.ts`<br>`backend/tests/rate-limit.test.ts` | 6 / 0 / 0 / 1 / 0 |
| `POST /auth/quick-login`<br>Đăng nhập nhanh theo vai trò (CHỈ TRÌNH DIỄN) | Công khai | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /auth/refresh`<br>Làm mới access token | Công khai | Đã làm | `backend/tests/refresh.test.ts` | 7 / 0 / 1 / 0 / 0 |
| `GET /auth/me`<br>Lấy người dùng của phiên hiện tại | Đã đăng nhập | Đã làm | `backend/tests/envelope.test.ts`<br>`backend/tests/refresh.test.ts` | 3 / 0 / 0 / 0 / 0 |
| `POST /auth/logout`<br>Đăng xuất và thu hồi phiên | Đã đăng nhập | Đã làm | `backend/tests/refresh.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `PATCH /auth/profile`<br>Cập nhật hồ sơ cá nhân | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Hồ sơ một cửa

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /applications/mine`<br>Danh sách hồ sơ của sinh viên đang đăng nhập | SINH_VIEN | Đã làm | `backend/tests/envelope.test.ts`<br>`backend/tests/scope.test.ts` | 2 / 0 / 1 / 0 / 0 |
| `GET /applications/mine/recent`<br>Vài hồ sơ gần đây của sinh viên (trừ bản nháp) | SINH_VIEN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /applications/mine/stats`<br>Thống kê nhanh hồ sơ của sinh viên | SINH_VIEN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /applications`<br>Tạo bản nháp hồ sơ | SINH_VIEN | Đã làm | `backend/tests/envelope.test.ts`<br>`backend/tests/idempotency.test.ts` | 4 / 2 / 0 / 1 / 0 |
| `GET /applications/{maHoSo}`<br>Chi tiết hồ sơ theo mã hồ sơ | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/idor.test.ts`<br>`backend/tests/lifecycle.test.ts`<br>`backend/tests/scope.test.ts` | 8 / 0 / 0 / 0 / 0 |
| `PUT /applications/{maHoSo}`<br>Cập nhật bản nháp hoặc hồ sơ đang cần bổ sung | SINH_VIEN | Đã làm | `backend/tests/idor.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `DELETE /applications/{maHoSo}`<br>Xoá bản nháp hoặc hồ sơ đã rút | SINH_VIEN | Đã làm | `backend/tests/idor.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /applications/{maHoSo}/submit`<br>Nộp hồ sơ vào luồng duyệt | SINH_VIEN | Đã làm | `backend/tests/envelope.test.ts`<br>`backend/tests/idempotency.test.ts`<br>`backend/tests/idor.test.ts`<br>`backend/tests/transitions.test.ts` | 4 / 2 / 0 / 0 / 0 |
| `POST /applications/{maHoSo}/cancel`<br>Rút hồ sơ (chỉ khi chưa cấp nào duyệt) | SINH_VIEN | Đã làm | `backend/tests/idor.test.ts`<br>`backend/tests/lifecycle.test.ts`<br>`backend/tests/transitions.test.ts` | 4 / 0 / 0 / 0 / 0 |
| `POST /applications/{maHoSo}/supplement`<br>Bổ sung hồ sơ đang ở trạng thái Cần bổ sung | SINH_VIEN | Đã làm | `backend/tests/lifecycle.test.ts`<br>`backend/tests/transitions.test.ts` | 2 / 1 / 0 / 0 / 0 |
| `GET /applications/{maHoSo}/next-approver-roles`<br>Vai trò của bước duyệt kế tiếp | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Phê duyệt

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /approvals/pending`<br>Hồ sơ đang chờ người đăng nhập xử lý | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/delegations.test.ts`<br>`backend/tests/integration-flows.test.ts`<br>`backend/tests/scope.test.ts`<br>`backend/tests/sla.test.ts` | 6 / 0 / 0 / 0 / 0 |
| `GET /approvals/processed`<br>Hồ sơ người đăng nhập đã xử lý | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /approvals/stats`<br>Thống kê phục vụ trang tổng quan | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /approvals/overdue`<br>Hồ sơ quá hạn hoặc sắp hết hạn | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /approvals/pending-count`<br>Số hồ sơ đang chờ (badge menu) | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /approvals/{maHoSo}/approve`<br>Duyệt hồ sơ ở bước hiện tại | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/concurrency.test.ts`<br>`backend/tests/delegations.test.ts`<br>`backend/tests/idempotency.test.ts`<br>`backend/tests/idor.test.ts`<br>`backend/tests/lifecycle.test.ts`<br>`backend/tests/sla.test.ts`<br>`backend/tests/transitions.test.ts` | 24 / 2 / 0 / 1 / 0 |
| `POST /approvals/{maHoSo}/reject`<br>Từ chối hồ sơ (bắt buộc lý do) | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/lifecycle.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /approvals/{maHoSo}/request-supplement`<br>Yêu cầu bổ sung hồ sơ (bắt buộc nội dung) | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/lifecycle.test.ts`<br>`backend/tests/transitions.test.ts` | 2 / 0 / 0 / 0 / 0 |
| `POST /approvals/batch`<br>Duyệt hàng loạt các bước Một chạm | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Ký OTP

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `POST /otp/send`<br>Gửi mã OTP cho bước ký hiện tại | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/concurrency.test.ts`<br>`backend/tests/lifecycle.test.ts`<br>`backend/tests/otp-channel.test.ts` | 9 / 0 / 0 / 0 / 0 |
| `POST /otp/{challengeId}/resend`<br>Gửi lại mã OTP (chặn 30 giây) | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/otp-channel.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `GET /otp/{challengeId}`<br>Trạng thái phiên OTP (đếm ngược) | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Ủy quyền

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /delegations`<br>Danh sách ủy quyền liên quan | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/delegations.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /delegations`<br>Tạo ủy quyền duyệt tạm thời | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/delegations.test.ts` | 3 / 0 / 0 / 0 / 0 |
| `DELETE /delegations/{id}`<br>Huỷ ủy quyền | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/delegations.test.ts` | 2 / 0 / 0 / 0 / 0 |
| `GET /delegations/eligible-users`<br>Người có thể nhận ủy quyền theo vai trò | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/delegations.test.ts` | 1 / 0 / 0 / 0 / 0 |

## Văn bản

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /applications/{maHoSo}/document`<br>Văn bản đã cấp của một hồ sơ (xem trước A4) | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/idor.test.ts`<br>`backend/tests/integration-flows.test.ts`<br>`backend/tests/signature.test.ts` | 5 / 0 / 0 / 0 / 0 |
| `GET /documents`<br>Danh sách văn bản đã cấp | PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/public-pii.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /documents/{id}/revoke`<br>Thu hồi văn bản (bắt buộc lý do) | PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/lifecycle.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /documents/{id}/download-log`<br>Ghi nhận một lượt tải văn bản | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/lifecycle.test.ts` | 2 / 0 / 0 / 0 / 0 |
| `GET /documents/{id}/export`<br>Xuất văn bản để tải/in | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /documents/report`<br>Tổng quan báo cáo thống kê | PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /documents/report/rows`<br>Các bảng số liệu chi tiết của báo cáo | PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /files/{fileToken}`<br>Tải tệp nhị phân bằng liên kết có chữ ký (KHÔNG bọc phong bì) | Đã đăng nhập | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |

## Mẫu văn bản

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /templates`<br>Danh sách mẫu văn bản | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /templates`<br>Tạo mẫu văn bản | ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /templates/{ma}`<br>Chi tiết mẫu theo mã | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /templates/{ma}`<br>Cập nhật mẫu văn bản | ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /templates/{ma}`<br>Xoá mẫu văn bản | ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /templates/{ma}/render`<br>Kết xuất mẫu với bộ giá trị cho trước | CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |

## Công khai

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /public/verify/token/{token}`<br>Xác thực văn bản theo token QR (công khai) | Công khai | Đã làm | `backend/tests/lifecycle.test.ts`<br>`backend/tests/public-pii.test.ts` | 3 / 0 / 0 / 0 / 0 |
| `GET /public/verify/so-van-ban/{so}`<br>Xác thực văn bản theo số văn bản (công khai) | Công khai | Đã làm | `backend/tests/public-pii.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /public/verify/token/{token}/compare`<br>Đối chiếu mã băm tệp người dùng tải lên (công khai) | Công khai | Đã làm | `backend/tests/lifecycle.test.ts`<br>`backend/tests/public-pii.test.ts` | 3 / 0 / 0 / 0 / 0 |
| `GET /public/verify/recent`<br>Vài văn bản mới cấp (công khai, dữ liệu đã che) | Công khai | Đã làm | `backend/tests/public-pii.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `GET /library`<br>Danh sách biểu mẫu & tài liệu (công khai) | Công khai | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /library/groups`<br>Danh sách nhóm tài liệu (công khai) | Công khai | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /library/{id}`<br>Chi tiết một tài liệu (công khai) | Công khai | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /library/{id}/download`<br>Ghi nhận lượt tải và trả mô tả tệp (công khai) | Công khai | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Thông báo

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /notifications`<br>Danh sách thông báo của người đăng nhập | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /notifications/unread-count`<br>Số thông báo chưa đọc | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /notifications/read-all`<br>Đánh dấu tất cả đã đọc | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /notifications/stream`<br>Kênh SSE chuông thông báo realtime (KHÔNG bọc phong bì) | Đã đăng nhập | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /notifications/{id}/read`<br>Đánh dấu một thông báo đã đọc | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /notifications/{id}`<br>Xoá thông báo | Đã đăng nhập | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Nhật ký

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /audit-logs`<br>Truy vấn nhật ký hệ thống | ADMIN | Đã làm | `backend/tests/envelope.test.ts` | 0 / 0 / 1 / 0 / 0 |
| `GET /audit-logs/actions`<br>Danh sách mã hành động đã xuất hiện | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /audit-logs/{id}`<br>Chi tiết một bản ghi nhật ký | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Trợ lý ảo

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `POST /chat/stream`<br>Hỏi trợ lý ảo, trả lời dạng streaming SSE (KHÔNG bọc phong bì) | Công khai | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /chat/suggestions`<br>Câu hỏi gợi ý | Công khai | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /chat/messages/{messageId}/feedback`<br>Đánh giá câu trả lời hữu ích / không hữu ích | Đã đăng nhập | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |

## Loại đơn

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /request-types`<br>Danh sách loại đơn | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /request-types`<br>Tạo loại đơn | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 3 / 0 / 0 / 0 / 0 |
| `GET /request-types/stats`<br>Số lượt nộp theo từng loại đơn | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /request-types/{ma}`<br>Chi tiết loại đơn theo mã | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /request-types/{ma}`<br>Cập nhật loại đơn | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /request-types/{ma}`<br>Xoá loại đơn | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 2 / 0 / 0 / 0 / 0 |
| `GET /users/{maSo}/request-types`<br>Các loại đơn được phép nộp cho một người dùng | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Luồng duyệt

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /workflows`<br>Danh sách luồng duyệt | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /workflows`<br>Tạo luồng duyệt | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 4 / 0 / 0 / 1 / 0 |
| `POST /workflows/validate`<br>Kiểm tra tính hợp lệ của luồng | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `GET /workflows/{ma}`<br>Chi tiết luồng theo mã | SINH_VIEN, CO_VAN, TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /workflows/{ma}`<br>Cập nhật luồng duyệt | ADMIN | Đã làm | `backend/tests/integration-flows.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `DELETE /workflows/{ma}`<br>Xoá luồng duyệt | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 1 / 0 / 0 / 0 / 0 |

## Người dùng

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /users`<br>Danh sách người dùng | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /users`<br>Tạo người dùng | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 2 / 1 / 0 / 1 / 0 |
| `GET /users/advisors`<br>Danh sách cố vấn học tập | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /users/{maSo}`<br>Chi tiết người dùng theo mã số | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /users/{maSo}`<br>Cập nhật người dùng | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `DELETE /users/{maSo}`<br>Xoá người dùng (không xoá ADMIN) | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /users/{maSo}/reset-password`<br>Đặt lại mật khẩu về mật khẩu tạm | ADMIN | Đã làm | `backend/tests/admin-crud.test.ts` | 1 / 0 / 0 / 0 / 0 |

## Danh mục

| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |
| --- | --- | --- | --- | --- |
| `GET /catalog/khoa`<br>Danh sách khoa | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | `backend/tests/idor.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `POST /catalog/khoa`<br>Tạo khoa | ADMIN | Đã làm | `backend/tests/envelope.test.ts`<br>`backend/tests/idor.test.ts` | 0 / 1 / 0 / 1 / 0 |
| `GET /catalog/khoa/{ma}`<br>Chi tiết khoa theo mã | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /catalog/khoa/{ma}`<br>Cập nhật khoa | ADMIN | Đã làm | `backend/tests/idor.test.ts` | 2 / 0 / 0 / 0 / 0 |
| `DELETE /catalog/khoa/{ma}`<br>Xoá khoa | ADMIN | Đã làm | `backend/tests/idor.test.ts` | 1 / 0 / 0 / 0 / 0 |
| `GET /catalog/phong-ban`<br>Danh sách phòng ban | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /catalog/phong-ban`<br>Tạo phòng ban | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/phong-ban/{ma}`<br>Chi tiết phòng ban theo mã | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /catalog/phong-ban/{ma}`<br>Cập nhật phòng ban | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /catalog/phong-ban/{ma}`<br>Xoá phòng ban | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/nganh`<br>Danh sách ngành | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /catalog/nganh`<br>Tạo ngành | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/nganh/{ma}`<br>Chi tiết ngành theo mã | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /catalog/nganh/{ma}`<br>Cập nhật ngành | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /catalog/nganh/{ma}`<br>Xoá ngành | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/lop`<br>Danh sách lớp | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /catalog/lop`<br>Tạo lớp | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/lop/{ma}`<br>Chi tiết lớp theo mã | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /catalog/lop/{ma}`<br>Cập nhật lớp | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /catalog/lop/{ma}`<br>Xoá lớp | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/khoa-hoc`<br>Danh sách khóa học | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `POST /catalog/khoa-hoc`<br>Tạo khóa học | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `GET /catalog/khoa-hoc/{ma}`<br>Chi tiết khóa học theo mã | TRUONG_KHOA, PHONG_DAO_TAO, ADMIN | Chưa làm | — | 0 / 0 / 0 / 0 / 0 |
| `PATCH /catalog/khoa-hoc/{ma}`<br>Cập nhật khóa học | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |
| `DELETE /catalog/khoa-hoc/{ma}`<br>Xoá khóa học | ADMIN | Đã làm | — | 0 / 0 / 0 / 0 / 0 |

## Cách đọc đối với người không lập trình

1. Tìm chức năng theo tên tiếng Việt (cột thao tác).
2. Cột **Cài đặt** cho biết máy chủ đã có chức năng đó chưa.
3. Cột **File test** cho biết đã có bài kiểm tự động chưa. Dấu gạch ngang nghĩa là chưa kiểm.
4. Nếu **Đã làm** mà chưa có file test, đây là rủi ro: chức năng có thể hỏng mà không ai biết.
