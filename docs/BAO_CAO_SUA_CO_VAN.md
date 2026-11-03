# Báo cáo sửa: Cố vấn không duyệt được / không có thông báo — Phòng Đào tạo lại duyệt được

Ngày: 2026-11-03 · nhánh `ban-dung-duoc` · CSDL dev chỉ SELECT (qua `docker exec`).

## Chẩn đoán bằng dữ liệu thật (chỉ SELECT)

Đơn mới nhất được Phòng Đào tạo duyệt: **MC-2026-001334** — `Giấy xác nhận sinh viên`
(`rt_gxn`), sinh viên **20221077** (lớp *K19 - Điều dưỡng 1*, cố vấn **CV006**, trưởng khoa **TK005**).

| step_order | Tên bước | Vai trò | Mode | Trạng thái | Assignee |
|---|---|---|---|---|---|
| 1 | Phòng Đào tạo phát hành giấy xác nhận | PHONG_DAO_TAO | OTP | APPROVED | PDT001 |

Approvals: buoc 0 SUBMIT (20221077) 01:59:26 → buoc 1 APPROVE OTP (PDT001, vai trò đúng) 02:02:11 → ISSUE_DOCUMENT.
Notifications: 2 thông báo "Có hồ sơ mới chờ bạn xử lý" gửi cho **PDT001 và PDT002** lúc 01:59:26; sinh viên nhận thông báo phát hành văn bản.

**Kết luận:** đơn thuộc luồng **WF-01 (1 cấp, chỉ Phòng Đào tạo)** — không có bước Cố vấn
từ đầu. Tài khoản Cố vấn người dùng đăng nhập **không phải người trong luồng** nên không
thấy đơn, không có thông báo, không duyệt được — **hành vi đúng**, không phải gán sai assignee.

Kiểm tra chéo toàn bộ 17 lượt duyệt/xử lý của PĐT trên dev: mọi lượt đều đúng bước
`PHONG_DAO_TAO` (kể cả REQUEST_SUPPLEMENT buoc 1 của MC-2026-000139 cũng là bước PĐT);
**không có đơn nào bị PĐT duyệt nhảy cóc**; dev không có approval nào do ADMIN thực hiện
⇒ không cần sửa dữ liệu.

## Nguyên nhân gốc theo từng triệu chứng (file + dòng)

| Triệu chứng | Nguyên nhân | Vị trí |
|---|---|---|
| Cố vấn không duyệt được | Luồng của loại đơn được chọn không có bước Cố vấn; quyền duyệt yêu cầu vai trò khớp bước hoặc đúng assignee/người ủy quyền | `backend/prisma/seed-data.json` (WF-01: `1:PHONG_DAO_TAO(OTP)`); `backend/src/modules/workflow/engine.ts` — `xacDinhThamQuyen()` d.~321–323 (chỉ cùng vai trò mới qua phạm vi) và ~349–353 (bị chặn → `FORBIDDEN_SCOPE`) |
| Cố vấn không thấy thông báo | Thông báo chỉ tạo theo vai trò của bước kế tiếp; luồng này không có bước Cố vấn nên không có thông báo cho Cố vấn | `backend/src/modules/applications/service.ts` ~d.350–363 (nộp đơn) và `backend/src/modules/approvals/service.ts` ~d.84–106 (baoSauDuyet khi chuyển bước) — cả hai dùng `notifyRole(outcome.buocKeTiep.role)` từ `backend/src/lib/notify.ts` d.34–56 |
| Phòng Đào tạo duyệt được | Đúng nghiệp vụ: bước đó role = PHONG_DAO_TAO và PĐT có phạm vi toàn trường | `engine.ts` d.321–323 + `backend/src/lib/scope.ts` d.21–24 (PĐT phạm vi toàn trường; khác với Cố vấn chỉ thấy lớp mình) |

Quy tắc chốt đã có sẵn và được kiểm chứng: **chỉ cùng vai trò của bước (kèm kiểm tra phạm
vi dữ liệu), hoặc đúng assignee / người ủy quyền hợp lệ / bước leo thang mới được duyệt**;
vai trò rộng không tự duyệt bước không thuộc mình (nghiệp vụ đặt chủ đích, giữ nguyên).
Admin duyệt thay mọi bước (engine.ts d.283–285, chủ đích) và luôn ghi
`APPROVE_APPLICATION` vào audit log (`approvals/service.ts` d.170–179) — giữ nguyên.

## Bảng ca tái hiện (`backend/tests/core/co-van-duyet.test.ts`, chạy trên CSDL test)

| Ca | Nội dung | Kết quả |
|---|---|---|
| 1 | SV nộp đơn luồng CV→TK→PĐT: bước 1 gán đúng cố vấn của SV + có thông báo cho cố vấn đó | PASS |
| 2 | Cố vấn đúng duyệt → thành công, sang bước Trưởng khoa, TK nhận thông báo | PASS |
| 3 | Cố vấn khác lớp duyệt → 403 `FORBIDDEN_SCOPE` | PASS |
| 4 | PĐT nhảy cóc bước Cố vấn → 403 `FORBIDDEN_SCOPE`, hồ sơ còn nguyên ở bước 1 | PASS |
| 5 | PĐT duyệt bước Trưởng khoa → 403 `FORBIDDEN_SCOPE` | PASS |
| 6 | Admin duyệt thay được (hành vi chủ đích) + có audit log | PASS |
| 7 | PĐT khác (không phải assignee) duyệt bước PĐT được — chính sách hộp thư chung theo vai trò | PASS |

## Hành động đã làm

- Không sửa engine/scope/seed vì engine đúng và dữ liệu dev sạch; nguyên nhân thực là
  người dùng thử loại đơn không có bước cố vấn. Khắc phục = hướng dẫn + bảng quan hệ.
- Bổ sung bảng "Luồng duyệt của từng loại đơn" + SQL tra quan hệ SV-cố vấn-trưởng khoa
  vào `docs/CHAY_THU.md`.
- Bổ sung 7 ca kiểm thử tham quyền: `backend/tests/core/co-van-duyet.test.ts`.

## Cách áp dụng lên CSDL dev nếu muốn GXN có bước Cố vấn (KHÔNG tự chạy)

Nếu nghiệp vụ yêu cầu "Giấy xác nhận sinh viên" duyệt qua Cố vấn trước, chạy
(quyết định của người dùng, hoặc qua giao diện quản trị luồng):

```sql
-- Thêm bước 1 CO_VAN (ONE_CLICK) vào luồng WF-01, đẩy bước PĐT xuống bước 2
UPDATE workflow_steps SET step_order = 2
 WHERE workflow_id = (SELECT id FROM workflow_definitions WHERE ma = 'WF-01') AND step_order = 1;
INSERT INTO workflow_steps (id, workflow_id, step_order, ten, role, mode, sla_hours, created_at, updated_at)
SELECT gen_random_uuid(), id, 1, 'Cố vấn học tập ký duyệt', 'CO_VAN', 'ONE_CLICK', 24, now(), now()
 FROM workflow_definitions WHERE ma = 'WF-01';
```

Các hồ sơ đang chạy không bị ảnh hưởng (ảnh chụp luồng đóng băng lúc nộp); hồ sơ nháp
nộp sau đó mới dùng luồng mới.

## Kiểm tra sau sửa

| Kiểm tra | Kết quả |
|---|---|
| `npx vitest run tests/core/co-van-duyet.test.ts` | 7/7 PASS; phá thử (tắt điều kiện cùng vai trò ở `xacDinhThamQuyen`) → Ca 7 chuyển ĐỎ; `git checkout` hoàn nguyên → 7/7 xanh lại |
| `npm run smoke` (OTP_CHANNEL=CAPTURE, CSDL dev) | 14/15 dòng PASS (đủ luồng nộp → duyệt 3 cấp → PDF → thu hồi); dòng cuối FAIL: `login 20211533` — mật khẩu tài khoản này trong CSDL dev KHÔNG phải `demo1234` (dữ liệu bị đổi từ trước, không do đợt này). Xem SQL đề xuất phía dưới |
| `npm test` một lệnh (vitest run) | exit 0: files `25 passed \| 1 skipped (26)`, tests `206 passed \| 19 todo (225)`, 0 fail, 81.3s — số test tăng đúng +7 so với 199/218, không test nào mất |
| `tsc --noEmit` backend | exit 0 |
| `vite build` frontend | exit 0 (`built in 1.36s`) |

Lỗi môi trường ghi nhận: chạy `npm test` nhiều lần trong ngày trên Node v24.15.0 + Vitest
2.1.9 (pool `forks`/singleFork), 3/6 lần gặp lỗi xuất sẵn `Unhandled Error: Worker exited
unexpectedly` (exit `0xC0000409`) ngay lúc nạp file hoặc giữa chừng — tai nạn của chính
Node 24, không liên quan code nghiệp vụ (các lượt chạy xanh đều đủ 225 test). Đề xuất: dùng
Node LTS (22) cho máy dev; KHÔNG tự nâng cấp trong đợt này.

SQL đề xuất (người dùng tự chạy, không bắt buộc) nếu muốn thử lại smoke sạch trên dev:

```sql
-- Đặt lại mật khẩu demo cho tài khoản bị đổi (hash lấy từ một tài khoản seed khác)
UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE ma_so = '20211234')
 WHERE ma_so = '20211533';
```

## Quyết định tự chọn

- Không viết script `scripts/repro-co-van.ts` — dùng test Vitest để tái hiện (tận dụng
  helpers, tự dọn dữ liệu, chạy cùng `npm test`).
- Giữ nguyên thông báo "phát sóng theo vai trò" (`notifyRole`): phù hợp hòm thư chung
  PĐT; cố vấn không phụ trách vẫn nhận thông báo nhưng bị chặn khi duyệt nhờ kiểm tra
  phạm vi tại bước duyệt.
- `check-inbox.ts` không tồn tại trong dự án ⇒ không chạy.

## CHƯA LÀM

- Không có mục bị bỏ dở.
