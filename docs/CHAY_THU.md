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
