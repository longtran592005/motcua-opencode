# Chạy thử bản dùng được

## Khởi động

Trên Windows PowerShell, tại thư mục dự án:

```powershell
.\scripts\start-dev.ps1
```

Mở `http://localhost:5173`; API ở `http://localhost:8080/health`.
Script chỉ seed khi bảng `users` còn rỗng. SMTP OTP có thể bật bằng
`OTP_CHANNEL=EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` và
`MAIL_FROM` trong `backend/.env`.

Mặc định frontend dùng mock. Để bật từng nhóm service thật, đặt
`VITE_USE_MOCK=false` và `VITE_REAL_SERVICES=auth,applications,approvals,otp,verify,documents,notifications`.

## Luồng duyệt của từng loại đơn (dữ liệu seed)

| Loại đơn (mã) | Luồng duyệt | Bước 1 là ai |
|---|---|---|
| Giấy xác nhận sinh viên (`GXN`) | WF-01 — 1 cấp | Phòng Đào tạo (OTP) |
| Đơn xin cấp bảng điểm (`DBT`) | WF-02 — 2 cấp | Cố vấn học tập |
| Đơn xin bảo lưu kết quả học tập (`DBL`) | WF-02 — 2 cấp | Cố vấn học tập |
| Đơn xin hoãn thi (`DHT`) | WF-03 — 3 cấp | Cố vấn học tập → Trưởng khoa |
| Đơn xin chuyển ngành (`DCN`) | WF-03 — 3 cấp | Cố vấn học tập → Trưởng khoa |

Lưu ý khi thử bằng tay (kết quả kiểm chứng ngày 2026-11-03):

- `GXN` KHÔNG có bước Cố vấn. Dùng tài khoản Cố vấn với loại đơn này sẽ
  không thấy đơn, không thấy thông báo, không duyệt được — đó là hành vi ĐÚNG
  (cố vấn chỉ xử lý hồ sơ của lớp mình phụ trách).
- Muốn kiểm tra vai trò Cố vấn: dùng loại đơn `DBT`, `DBL`, `DHT`, `DCN`
  và đăng nhập cố vấn phụ trách lớp của sinh viên đã nộp (bảng quan hệ
  phía dưới).
- Phòng Đào tạo chỉ duyệt được bước có vai trò `PHONG_DAO_TAO`, không
  nhảy cóc bước Cố vấn / Trưởng khoa (mã lỗi `FORBIDDEN_SCOPE`).

## Quan hệ sinh viên — cố vấn — trưởng khoa (dữ liệu seed để thử tay)

Thử duyệt với đúng người phụ trách: đăng nhập cố vấn/trưởng khoa của
lớp/khoa mà sinh viên đã nộp đơn thuộc về. Xem số lớp đầy đủ bằng SQL:

```sql
SELECT u_sv.ma_so, u_cv.ma_so AS co_van, u_tk.ma_so AS truong_khoa
FROM users u_sv
JOIN students s ON s.user_id = u_sv.id
JOIN classes k ON k.id = s.class_id
JOIN faculties f ON f.id = k.faculty_id
LEFT JOIN users u_cv ON u_cv.id = k.co_van_id
LEFT JOIN users u_tk ON u_tk.id = f.truong_khoa_id;
```

## Luồng kiểm tra tay

1. Đăng nhập tài khoản sinh viên trong seed.
2. Tạo và nộp một đơn.
3. Đăng nhập tài khoản Cố vấn, duyệt đơn.
4. Gửi OTP ở bước ký và nhập mã từ kênh đã cấu hình.
5. Đăng nhập Trưởng khoa, ký OTP.
6. Đăng nhập Phòng Đào tạo, ký OTP cuối.
7. Mở hồ sơ đã hoàn thành và xuất PDF.
8. Quét QR hoặc mở đường dẫn xác thực công khai.
9. Đăng nhập Admin/Phòng Đào tạo, thu hồi văn bản với lý do.
10. Kiểm tra xác thực công khai hiển thị `ĐÃ THU HỒI`.

## Quay lại mốc cũ

```powershell
git checkout backup-truoc-ban-dung-duoc
pg_restore -d motcua backend/backups/dev_buoc1.dump
```
