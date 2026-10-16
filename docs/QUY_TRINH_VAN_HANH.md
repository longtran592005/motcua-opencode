# Quy trình vận hành — Cổng Một cửa điện tử TBU

Tài liệu này mô tả cách vận hành cơ sở dữ liệu và dữ liệu demo. Sẽ được mở rộng ở
Giai đoạn 9 (sao lưu định kỳ, giám sát, log tập trung).

## 1. Cổng PostgreSQL khi phát triển

Mặc định `docker-compose.yml` ánh xạ **cổng 5433** của máy chủ (host) vào cổng 5432 của container,
để không đụng PostgreSQL cục bộ thường đã chiếm 5432:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"
```

Chuỗi kết nối tương ứng (trong `backend/.env` và `backend/.env.example`):

```
DATABASE_URL="postgresql://motcua:motcua@localhost:5433/motcua?schema=public"
```

### Đổi cổng

| Muốn gì | Việc cần làm |
| --- | --- |
| Dùng cổng khác (ví dụ 5434) | Sửa `ports: "5434:5432"` trong `docker-compose.yml` **và** `DATABASE_URL` trong `backend/.env` cho khớp |
| Dùng PostgreSQL sẵn có trên máy | Bỏ qua `docker-compose`, chỉ cần sửa `DATABASE_URL` trỏ tới máy chủ đó; tạo user/DB `motcua` với mật khẩu mạnh |
| Trên máy chủ thật | Đặt `DATABASE_URL` qua biến môi trường/biến bí mật, **không** lưu trong mã nguồn |

> Đổi cổng chỉ là thay đổi cấu hình — **không** cần sửa migration hay mã nguồn.

## 2. Khởi tạo và nạp dữ liệu

```powershell
docker compose up -d postgres          # 1) cơ sở dữ liệu
cd backend
npm install
npx prisma migrate deploy              # 2) tạo bảng + quy tắc nghiệp vụ
npm run seed                           # 3) nạp dữ liệu demo
```

## 3. Dữ liệu demo

### Cách đánh dấu

Toàn bộ bản ghi do `npm run seed` tạo ra đều được đánh dấu **`is_demo = true`** trên các bảng:
`faculties, departments, academic_years, majors, classes, staff_positions, users, students,
request_types, workflow_definitions, document_templates, applications, signed_documents,
document_downloads, notifications, audit_logs, library_documents`.

Dữ liệu thật do người dùng tạo sau này sẽ có `is_demo = false` (giá trị mặc định), nên hai loại
dữ liệu luôn phân biệt được và có thể xóa riêng phần demo.

### Xóa gọn trước khi chạy thật

```powershell
cd backend
npm run demo:purge
```

Lệnh này chạy `prisma/purge-demo.sql`: xóa mọi bản ghi `is_demo = true` theo đúng thứ tự khóa ngoại
(bảng con tự xóa theo `ON DELETE CASCADE`). Với `audit_logs` (bảng chỉ-ghi-thêm), script tạm tắt
trigger `audit_logs_append_only` trong lúc xóa rồi bật lại.

Kiểm tra còn sót:

```sql
SELECT 'users' t, count(*) FROM users WHERE is_demo
UNION ALL SELECT 'applications', count(*) FROM applications WHERE is_demo
UNION ALL SELECT 'signed_documents', count(*) FROM signed_documents WHERE is_demo;
```

### Xóa sạch và làm lại từ đầu (chỉ môi trường phát triển)

```powershell
cd backend
npm run reset      # prisma migrate reset --force  (xóa toàn bộ, tạo lại bảng, chạy seed)
```

### Chặn nạp seed ở môi trường thật

`prisma/seed.ts` **từ chối chạy khi `NODE_ENV=production`** và thoát với thông báo rõ ràng. Seed chỉ
tạo tài khoản demo, mật khẩu chung và hash/token tạm — không bao giờ được dùng trên môi trường thật.

### Tài khoản demo (CHỈ dùng khi phát triển)

Mật khẩu chung: `demo1234` (băm bằng bcrypt khi seed). Danh sách đầy đủ nằm trong `README.md`.

| Vai trò | Mã số đăng nhập |
| --- | --- |
| Sinh viên | `20211234` |
| Cố vấn học tập | `CV001` |
| Trưởng khoa | `TK001` |
| Phòng Đào tạo | `PDT001` |
| Quản trị | `ADMIN` |

> **Trước khi chạy thật:** xóa dữ liệu demo (`npm run demo:purge`), đổi/khóa toàn bộ tài khoản demo,
> và đặt `JWT_SECRET` mới.

## 4. Hash và token tạm trong dữ liệu demo

| Trường | Trạng thái trong seed | Khi nào thay bằng giá trị thật |
| --- | --- | --- |
| `users.password_hash` | Băm bcrypt thật của `demo1234` | Đổi mật khẩu ngay khi triển khai |
| `signed_documents.ma_bam_sha256` | Giá trị mẫu của mock (đủ 64 hex) | **Giai đoạn 5** tính SHA-256 thật khi render PDF |
| `signed_documents.token_xac_thuc` | Sinh tất định 256 bit | **Giai đoạn 5** sinh token thật khi phát hành |
| `signatures.ma_bam`, `ma_chu_ky` | Giá trị mẫu của mock | **Giai đoạn 4/5** sinh bằng `SignatureProvider` thật |

**Không dùng token/hash demo ở production.**

## 5. Tra cứu nhanh cơ sở dữ liệu

```powershell
$env:PGPASSWORD='motcua'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5433 -U motcua -d motcua
# hoặc
docker exec -it motcua-postgres psql -U motcua -d motcua
```

## 6. Sao lưu và phục hồi (bản đơn giản, mở rộng ở Giai đoạn 9)

```powershell
# Sao lưu
docker exec motcua-postgres pg_dump -U motcua -d motcua -Fc -f /tmp/motcua.dump
docker cp motcua-postgres:/tmp/motcua.dump .\motcua.dump

# Phục hồi
docker cp .\motcua.dump motcua-postgres:/tmp/motcua.dump
docker exec motcua-postgres pg_restore -U motcua -d motcua --clean --if-exists /tmp/motcua.dump
```
