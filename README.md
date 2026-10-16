# Cổng Một cửa điện tử — Trường Đại học Thái Bình

Hệ thống một cửa điện tử đầy đủ: giao diện React, backend Node/Express, cơ sở dữ liệu
PostgreSQL, dịch vụ trợ lý ảo RAG và triển khai bằng Docker.

> Trạng thái: đang phát triển theo 9 giai đoạn. Xem mục **Tiến độ** bên dưới.
> Các quyết định thiết kế đã chốt nằm ở **[docs/QUYET_DINH.md](docs/QUYET_DINH.md)**.

## Cấu trúc monorepo

```
motcua-opencode/
├─ frontend/          # Ứng dụng React + Vite + TypeScript (đang chạy được ở chế độ mock)
├─ backend/           # API Node + Express + Prisma (PostgreSQL)
│  ├─ prisma/
│  │  ├─ schema.prisma      # lược đồ CSDL (UUID, snake_case, xóa mềm)
│  │  ├─ migrations/        # migration SQL (khởi tạo + quy tắc nghiệp vụ)
│  │  ├─ seed.ts            # nạp dữ liệu thật từ snapshot mock
│  │  └─ seed-data.json     # snapshot dữ liệu mock (do frontend sinh ra)
│  └─ .env.example
├─ rag-service/       # Trợ lý ảo (Python FastAPI + ChromaDB) — Giai đoạn 7
├─ docs/              # Tài liệu: OpenAPI, ERD, quyết định, báo cáo từng giai đoạn
├─ deploy/            # Cấu hình triển khai (nginx, GitHub Actions) — Giai đoạn 9
├─ docker-compose.yml       # PostgreSQL cho phát triển (các service khác ở Giai đoạn 9)
└─ docker-compose.prod.yml  # Bản triển khai production — Giai đoạn 9
```

Tài liệu quan trọng:

| Tệp | Nội dung |
| --- | --- |
| [docs/QUYET_DINH.md](docs/QUYET_DINH.md) | Toàn bộ quyết định thiết kế đã chốt (nhóm A + nhóm B) |
| [docs/openapi.yaml](docs/openapi.yaml) | Đặc tả OpenAPI 3.1 đầy đủ (nguồn sự thật của API) |
| [docs/erd.md](docs/erd.md) | Sơ đồ quan hệ thực thể (Mermaid) |
| [docs/FRONTEND_CONTRACT.md](docs/FRONTEND_CONTRACT.md) | Hợp đồng frontend ↔ backend |
| [docs/PHASE1-REPORT.md](docs/PHASE1-REPORT.md) | Báo cáo Giai đoạn 1 (OpenAPI) |
| [docs/PHASE2-REPORT.md](docs/PHASE2-REPORT.md) | Báo cáo Giai đoạn 2 (CSDL + seed) |

## Yêu cầu hệ thống

- Node.js ≥ 20 (đã kiểm thử trên Node 24)
- Docker Desktop (dùng cho PostgreSQL)
- Python ≥ 3.11 (chỉ cần cho `rag-service` ở Giai đoạn 7)

## Bắt đầu nhanh (phát triển)

### 1. Cơ sở dữ liệu

```bash
docker compose up -d postgres      # PostgreSQL 16, cổng 5433 (tránh đụng PostgreSQL cục bộ)
```

### 2. Backend

```bash
cd backend
cp .env.example .env               # đổi JWT_SECRET trước khi triển khai thật
npm install
npx prisma migrate deploy          # tạo bảng
npm run seed                       # nạp dữ liệu thật từ mock
npm run studio                     # (tùy chọn) xem dữ liệu
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (mặc định dùng mock)
```

Để frontend gọi backend thật, đặt trong `frontend/.env`: `VITE_USE_MOCK=false` và
`VITE_API_URL=http://localhost:8080/api/v1` (backend API sẽ có ở Giai đoạn 3).

## Tài khoản demo

Mật khẩu chung: `demo1234`

| Vai trò | Đăng nhập (mã số) | Ghi chú |
| --- | --- | --- |
| Sinh viên | `20211234` | Nguyễn Văn An — K19-CNTT1 |
| Cố vấn học tập | `CV001` | Trần Thị Mai |
| Trưởng khoa | `TK001` | Lê Minh Đức |
| Phòng Đào tạo | `PDT001` | Phạm Thu Hà |
| Quản trị | `ADMIN` | Quản trị hệ thống |

## Tiến độ

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| 0 | Khảo sát, chốt kiến trúc, 3 quyết định A | ✅ |
| 1 | Đặc tả OpenAPI 3.1 | ✅ |
| 2 | PostgreSQL + Prisma + ERD + seed + docker-compose | ✅ |
| 3 | API Node/Express + Zod + RBAC + xác thực | ⏳ |
| 4 | Máy trạng thái + OTP + chống trùng | ⏳ |
| 5 | Phát hành PDF + QR + tra cứu công khai | ⏳ |
| 6 | Hàng đợi pg-boss + thông báo + báo cáo | ⏳ |
| 7 | Trợ lý ảo RAG (FastAPI + ChromaDB) | ⏳ |
| 8 | Nối frontend ↔ backend | ⏳ |
| 9 | Docker hoá + CI/CD + triển khai | ⏳ |
