# Cổng Một cửa điện tử — Trường Đại học Thái Bình

Giao diện cổng dịch vụ một cửa điện tử (`motcua.tbu.edu.vn`): sinh viên nộp hồ sơ trực
tuyến, hồ sơ đi qua luồng duyệt nhiều cấp, có ký điện tử/OTP và phát hành văn bản PDF
kèm mã QR tra cứu, xác thực công khai.

Đồng bộ nhận diện với `tbu.edu.vn`: xanh dương `#0E9AE0`, tiêu đề xanh đậm `#0B3C6F`,
nền trắng, font Be Vietnam Pro / Roboto. Toàn bộ màu, font, bán kính là design token
(CSS variables trong `src/index.css` + `tailwind.config`) — component không hard-code màu.

## Công nghệ

React 19 · Vite · TypeScript · Tailwind CSS 3.4 · shadcn/ui (Radix) · React Router ·
TanStack Query · react-hook-form + zod · Recharts · lucide-react · qrcode.react ·
framer-motion · html5-qrcode.

Không có backend kèm theo: toàn bộ dữ liệu là **mock** trong `src/services/mock`, bật/tắt
bằng biến môi trường.

## Chạy dự án

```bash
npm install
npm run dev          # http://localhost:5173
npx tsc -b           # kiểm tra kiểu
npx vite build       # dựng bản sản xuất
```

Biến môi trường (tuỳ chọn): `VITE_USE_MOCK` (mặc định `true`), `VITE_API_URL`,
`VITE_MOCK_ERROR_RATE` (mặc định `0.03`). Xem chi tiết trong
[`docs/FRONTEND_CONTRACT.md`](docs/FRONTEND_CONTRACT.md).

## Tài khoản demo

Ở trang `/dang-nhap` có nút **Đăng nhập nhanh theo vai trò**. Mật khẩu chung: `demo1234`.
Mã OTP thử nghiệm (không hiển thị trên giao diện): `123456`.

| Vai trò | Mã đăng nhập | Phạm vi |
| --- | --- | --- |
| Sinh viên | `20211234` | Hồ sơ của chính mình |
| Cố vấn học tập | `cv001` | Sinh viên lớp phụ trách |
| Trưởng khoa | `tk001` | Sinh viên thuộc khoa |
| Phòng Đào tạo | `pdt001` | Toàn trường |
| Quản trị hệ thống | `admin` | Toàn trường + cấu hình |

## Cấu trúc thư mục

```
src/
├─ components/
│  ├─ ui/          # shadcn/ui: button, input, dialog, table, tabs, select…
│  ├─ common/      # PageHeader, DataTable, StatusBadge, StepProgress, Timeline,
│  │               # SignatureStamp, OtpDialog, FileUpload, QrCard, EmptyState…
│  └─ layout/      # PublicLayout, StudentLayout, AdminLayout, Header, Footer, Sidebar
├─ features/       # mỗi nghiệp vụ gồm pages / components / hooks
│  ├─ auth  applications  approvals  admin
│  ├─ documents  verify  library  notifications  profile  chatbot
├─ hooks/          # hook dùng chung (useAuth, useTheme, useDebounce, useCatalog…)
├─ lib/            # utils, constants, formatters, nav, template
├─ routes/         # bảng định tuyến + RoleGuard
├─ services/       # contracts (interface) · mock · http  → registry `services`
└─ types/          # kiểu dữ liệu dùng chung

public/
└─ tai-lieu/       # 77 tài liệu Một cửa thật (Word/Excel) để tải về
```

Nguyên tắc: mỗi file một trách nhiệm (≤ 300 dòng); component **không** import dữ liệu mock
trực tiếp mà luôn đi qua hook React Query → `services.*`.

## Thư viện tài liệu Một cửa

Toàn bộ tài liệu nghiệp vụ của Bộ phận Một cửa được sao chép nguyên trạng vào
`public/tai-lieu/` và hiển thị tại `/thu-vien-bieu-mau` (77 tài liệu, 6 nhóm):

| Nhóm | Số lượng | Nguồn |
| --- | --- | --- |
| Biểu mẫu sinh viên | 24 | thư mục `đào tạo/` |
| Biểu mẫu viên chức & người lao động | 31 | `1. Mẫu đơn bộ phận 1 cửa/` |
| Quy trình giải quyết thủ tục | 15 | `3 Quy trình giải quyết thủ tục 1 cửa/` |
| Thủ tục hành chính các phòng | 4 | `Thủ tục hành chính các phòng/` |
| Danh mục thủ tục | 2 | `2. Các thủ tục 01 cửa giải quyết/` |
| Hướng dẫn & Giới thiệu | 1 | `modau.docx` |

Tiêu đề, nhóm và mô tả của từng mục được **đọc trực tiếp từ nội dung tệp** (không suy diễn từ
tên tệp); nút *Tải tài liệu* tải đúng tệp Word/Excel gốc. Hai bản trùng khít nội dung chỉ được
liệt kê một lần.

## Các khu vực chính

- **Công khai**: trang giới thiệu, biểu mẫu & tài liệu (thư viện tài liệu Một cửa), tra cứu `xác thực văn bản`
  (`/xac-thuc/:token`: HỢP LỆ / KHÔNG HỢP LỆ / ĐÃ THU HỒI, kéo–thả PDF so mã băm SHA-256,
  nhập mã tay, quét QR bằng camera).
- **Sinh viên**: trang chủ là trung tâm dịch vụ; nộp đơn theo biểu mẫu động, lưu nháp/nộp,
  phiếu hẹn có mã hồ sơ `MC-2026-000123`; danh sách, chi tiết có timeline, bổ sung hồ sơ,
  rút đơn; xem/in văn bản khổ A4 có chữ ký điện tử và QR.
- **Cán bộ duyệt**: tổng quan có biểu đồ, hàng chờ duyệt (lọc, sắp theo hạn, duyệt hàng loạt),
  màn hình xử lý (duyệt / từ chối / yêu cầu bổ sung, ký OTP khi bước yêu cầu), lịch sử đã xử lý,
  ủy quyền duyệt tạm thời.
- **Quản trị**: loại đơn & thiết kế biểu mẫu động, luồng duyệt nhiều cấp, mẫu văn bản có biến
  `{{ho_ten}}…` và xem trước A4, văn bản đã cấp (thu hồi, lịch sử tải), báo cáo thống kê
  (xuất CSV mở bằng Excel), người dùng & phân quyền, danh mục, nhật ký hệ thống.
- **Trợ lý ảo**: nút nổi góc phải ở mọi trang nội bộ, trả lời dạng streaming kèm trích nguồn.

## Hợp đồng API

[`docs/FRONTEND_CONTRACT.md`](docs/FRONTEND_CONTRACT.md) liệt kê đầy đủ từng hàm service
(tên, tham số, kiểu trả về, mã lỗi nghiệp vụ, endpoint REST gợi ý) — là căn cứ để backend
hiện thực và bật `VITE_USE_MOCK=false`.
