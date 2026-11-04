# BÁO CÁO SỬA GIAO DIỆN — Màu khó đọc + thẻ dính sát mép

- Nhánh: `giao-dien-sua` (tạo từ `ban-dung-duoc`), 2 commit: `f3c6618` (khoảng cách), `e7ca9c1` (màu + công cụ + ảnh).
- Phạm vi: chỉ lớp trình bày frontend. `git diff --name-status ban-dung-duoc` xác nhận **không có** file nào trong `backend/`, `frontend/src/services/`, migration.
- Chế độ build: mock ĐẠT, chế độ thật (`VITE_USE_MOCK=false`) ĐẠT.

## 1. Nguyên nhân gốc lỗi KHOẢNG CÁCH (file + dòng)

Gốc: `frontend/src/components/ui/card.tsx`

| Vị trí | Trước | Vấn đề |
|---|---|---|
| `card.tsx:39` (CardContent) | `p-4 pt-0 sm:p-5 sm:pt-0` | `pt-0`/`sm:pt-0` xóa đệm đỉnh. Khi caller thêm class riêng có `p-*` (16 file: LibraryPage.tsx:132, PublicHomePage.tsx:105, QuickServiceGrid.tsx:53…), tailwind-merge giữ lại `sm:pt-0` → nội dung dính mép trên từ viewport `sm` trở lên |
| `card.tsx:17` (CardHeader) | `p-4 sm:p-5` | 16px mobile, dưới chuẩn 20px |
| `card.tsx:48` (CardFooter) | `p-4 pt-0 sm:p-5 sm:pt-0` | cùng cơ chế `pt-0` |

Đo thực tế qua Chrome DevTools Protocol (dev server thật):
- Thư viện biểu mẫu @1280 (trước): `padContent = "0px 20px 20px"` — **đệm đỉnh = 0**, icon cách mép trên 13px.
- Sau khi sửa: desktop `24px`, mobile `20px` đều 4 phía; icon cách mép trên 31–37px; `overflow = 0` ở 390 và 1280.

Đã kiểm tra và loại trừ: Tailwind **v3.4.19** (`@tailwind` directives + config JS); `App.css` KHÔNG được import (chỉ `index.css`) nên không phải nguyên nhân; không có reset ngoài `@layer`; không có `--spacing: 0` hay rule `[class*='p-']`. Khối `!important` duy nhất nằm trong `@media print` cho `.a4-page` (đã có sẵn, đúng mục đích in) — giữ nguyên.

**Cách sửa** (commit `f3c6618`, 20 files, không dùng `!important` mới):
- `card.tsx`: CardContent `p-4 pt-0 sm:p-5 sm:pt-0` → `p-5 sm:p-6`; CardHeader → `p-5 pb-0 sm:p-6 sm:pb-0`; CardFooter → `p-5 pt-0 sm:p-6 sm:pt-0`.
- Xóa đè caller `p-4` trên `<CardContent className="… p-4">` ở 16 file để về chuẩn chung (giữ `p-5`, `p-6`, và `p-0` cho bảng full-bleed/QR có chủ ý).
- `tailwind.config.js`: container padding `1rem` → `{DEFAULT: '1rem', sm: '1.5rem', lg: '2rem'}` (gutter 16/24/32px).
- Lưới chứa thẻ `gap-3` (12px) → `gap-4` (16px) ở 14 file; giữ `gap-3` cho danh sách phần tử bên trong thẻ (đúng chuẩn 12–16px nội bộ).

## 2. Nguyên nhân lỗi MÀU + token mới

### Nguyên nhân (file + dòng)
1. **Token dùng 2 nghĩa**: `--brand-heading` (index.css:58 light `#0B3C6F`; index.css:121 dark `205 80% 78%` — **xanh rất nhạt**) vừa là màu CHỮ tiêu đề, vừa bị component dùng làm NỀN qua `bg-brand-heading`: Header.tsx:52, Footer.tsx:23, PublicHomePage.tsx:52, StudentHomePage.tsx:31, LoginPage.tsx:97, ChatbotWidget.tsx:40, Sidebar.tsx:32, alert-dialog.tsx:16. Ở chế độ tối → nền xanh nhạt + chữ trắng (1,4–1,7:1) — đúng triệu chứng người dùng; ở chế độ sáng → hero/topbar/footer xanh đậm #0B3C6F.
2. **Quy tắc toàn cục** `h1..h6 { @apply text-brand-heading }` (index.css:161) đè màu trắng kế thừa của hero → h1 hero = #0B3C6F trên nền #0B3C6F = **1,0:1, tiêu đề vô hình** (CDP đo được `h1Color = rgb(11,60,111)` trên `bg = rgb(11,60,111)`).
3. **Alpha cho chữ chính**: `text-white/60…85`, `bg-white/5…15` rải rác (Footer.tsx:23,30,34,40; Sidebar.tsx:32,52-53,90-91; PublicHomePage.tsx:55,62,104,110; LoginPage.tsx:108,120,131,138; ChatbotWidget.tsx:46,52,62).

### Token mới (`frontend/src/index.css`, cả `:root` và `.dark`)

| Token | Sáng | Tối |
|---|---|---|
| `--background` / `--foreground` | #F5F9FD / #0B2540 | #0B1220 / #E8F0FA |
| `--card` / `--card-foreground` | #FFFFFF / #0B2540 | #111B2E / #E8F0FA |
| `--border` / `--input` | #D5E3F0 / #C7D9EA | #263650 / #2E4358 |
| `--primary` / `--primary-foreground` | #0A7BBE / #FFFFFF | #4DB5F0 / #04223A |
| `--brand-dark` (hover) | #086AA3 | #3F9FD8 |
| `--topbar` / `--topbar-foreground` | #0A7BBE / #FFFFFF | #14233A / #E8F0FA |
| `--hero` → `--hero-2` (gradient) | #0B3C6F → #0A7BBE | #0F2A4A → #14406B |
| `--hero-foreground` / `--hero-muted` | #FFFFFF / #E3EFF9 | #FFFFFF / #D6E7F8 |
| `--hero-card` / `--hero-card-foreground` | #295380 / #FFFFFF | #234469 / #FFFFFF |
| `--muted-foreground` | #3E5772 | #A9BBD0 |
| `--brand-heading` (chỉ làm CHỮ) | #0B3C6F | #FFFFFF |
| Trạng thái | success #14662B/#E6F4EA · warning #8A4B00/#FFF1DB · rejected #A32020/#FDECEC · info #0A5C94/#E3F0FB · supplement #A35203/#FFF0E3 · draft #3E5772/#E8F0F7 · cancelled #4A5C70/#E7EDF3 | chữ sáng trên nền đậm cùng sắc |

Kèm theo:
- Class `.hero-surface` (index.css, @layer components): gradient `--hero → --hero-2` + `text-hero-foreground`.
- Rule `header/footer/.bg-topbar/.hero-surface h1..h3 { color: inherit }` — tiêu đề trên bề mặt đậm kế thừa màu trắng, không cần `!important` (specificity cao hơn rule `h1..h6`).
- `tailwind.config.js`: thêm nhóm màu `topbar`, `hero` (kèm `2`, `muted`, `card`, `card-foreground`); toàn bộ mapping đổi sang `hsl(var(--x) / <alpha-value>)` để modifier alpha hoạt động (trước đây `bg-brand-heading/60` của alert-dialog KHÔNG sinh ra CSS).
- A4 giữ nguyên: `.a4-page` nền trắng chữ đen; `QrCard` giữ `bg-white` + `fgColor #0B3C6F` (QR phải nền trắng để quét được).

Hard-code đã thay: Header (topbar + ô chọn ngôn ngữ), Footer (toàn bộ `text-white/x` → token), Sidebar, PublicHomePage (hero + thẻ tính năng `bg-white/5` → `bg-hero-card`), StudentHomePage, LoginPage (cột trái), ChatbotWidget. Chữ chính không còn dùng alpha; chỉ giữ alpha cho nền trang trí (`bg-white/10`, `bg-primary/30 blur`).

## 3. Bảng tương phản TRƯỚC/SAU (WCAG — `node scripts/check-contrast.mjs`)

Chữ thường ≥ 4,5; UI/viền ≥ 3. Script đọc token từ `index.css`, tự cộng màu alpha lên nền.

### Sáng (light)
| Cặp | TRƯỚC | SAU |
|---|---|---|
| Chữ chính / nền trang | 13,99 ĐẠT | **14,71 ĐẠT** |
| Chữ chính / thẻ | 13,99 ĐẠT | **15,58 ĐẠT** |
| Chữ phụ / nền trang | 5,17 ĐẠT | **7,05 ĐẠT** |
| Chữ phụ / thẻ | 5,17 ĐẠT | **7,46 ĐẠT** |
| Viền / thẻ (UI) | 1,33 | 1,31 (xem ghi chú) |
| Chữ trên nút chính | **3,09 KHÔNG** | **4,53 ĐẠT** |
| Màu chính / thẻ (link, icon) | **3,09 KHÔNG** | **4,53 ĐẠT** |
| Chữ trên nút phụ | 9,96 ĐẠT | **13,45 ĐẠT** |
| Topbar: chữ / nền | (thiếu token) | **4,53 ĐẠT** |
| Hero: tiêu đề / nền | **1,00 KHÔNG** (h1 trùng nền) | **11,20 ĐẠT** |
| Hero: mô tả / nền | — | **9,59 ĐẠT** |
| Hero: chữ trong thẻ tính năng | — | **7,95 ĐẠT** |
| Trạng thái: hoàn thành | **3,73 KHÔNG** | **6,25 ĐẠT** |
| Trạng thái: cảnh báo | **3,49 KHÔNG** | **6,05 ĐẠT** |
| Trạng thái: trả về | 4,59 ĐẠT | **6,62 ĐẠT** |
| Trạng thái: đang xử lý | **3,75 KHÔNG** | **6,05 ĐẠT** |
| (hard-code cũ) h1 hero sáng | **1,00 KHÔNG** | đã loại bỏ |

### Tối (dark)
| Cặp | TRƯỚC | SAU |
|---|---|---|
| Chữ chính / nền trang | 15,84 ĐẠT | **16,31 ĐẠT** |
| Chữ chính / thẻ | 14,70 ĐẠT | **14,95 ĐẠT** |
| Chữ phụ / nền trang | 7,96 ĐẠT | **9,56 ĐẠT** |
| Chữ phụ / thẻ | 7,39 ĐẠT | **8,77 ĐẠT** |
| Viền / thẻ (UI) | 1,51 | 1,41 (xem ghi chú) |
| Chữ trên nút chính | 7,29 ĐẠT | **7,05 ĐẠT** |
| Màu chính / thẻ | 6,91 ĐẠT | **7,46 ĐẠT** |
| Chữ trên nút phụ | 12,16 ĐẠT | **12,64 ĐẠT** |
| Topbar: chữ / nền | (thiếu token) | **13,71 ĐẠT** |
| Hero: tiêu đề / nền | **1,67 KHÔNG** (trắng trên #9ACEF4) | **14,52 ĐẠT** |
| Hero: mô tả / nền | **1,50 KHÔNG** | **11,51 ĐẠT** |
| Hero: chữ trong thẻ tính năng | **1,50 KHÔNG** | **10,01 ĐẠT** |
| Trạng thái: hoàn thành | 6,07 ĐẠT | **10,04 ĐẠT** |
| Trạng thái: cảnh báo | 6,40 ĐẠT | **10,34 ĐẠT** |
| Trạng thái: trả về | **4,42 KHÔNG** | **8,71 ĐẠT** |
| Trạng thái: đang xử lý | 5,73 ĐẠT | **7,25 ĐẠT** |
| (hard-code cũ) chữ trắng trên `bg-brand-heading` | **1,44–1,67 KHÔNG** | đã loại bỏ |

Ghi chú viền: #D5E3F0 (sáng) / #263650 (tối) là mã người dùng chỉ định, tỷ lệ với nền thẻ 1,31/1,41 (< 3). Đây là viền trang trí của thẻ đã có shadow; WCAG 1.4.11 chỉ yêu cầu ≥3 cho thành phần nhận biết trạng thái. Nếu muốn đạt ≥3 cần viền đậm hơn (~#B9CBDC sáng / #3C5273 tối) — chờ người dùng quyết.

## 4. Build / lint / test / ảnh

| Mục | Kết quả |
|---|---|
| `npm run build` (tsc -b && vite build — mock) | **PASS** — built in 1.41s |
| `VITE_USE_MOCK=false npm run build` (chế độ thật) | **PASS** — built in 1.35s |
| `npm run lint` (oxlint) | **PASS** — 0 lỗi; chỉ warning có sẵn (fast-refresh, set-state-in-effect) |
| Test frontend | **Không có** (không có file `.test.*`, không có vitest/playwright/jest trong node_modules) |
| Ảnh chụp | Có — Chrome headless + CDP, lưu `docs/anh-giao-dien/`: `TRUOC-chu-1280.png`, `TRUOC-chu-390.png`, `TRUOC-light-1280.png`, `SAU-chu-light-1280.png`, `SAU-chu-dark-1280.png`, `SAU-chu-light-390.png`, `SAU-thu-vien-dark-1280.png`, `SAU-dang-nhap-light-1280.png` |

Ảnh SAU xác nhận: hero nền đậm gradient, tiêu đề trắng rõ ở CẢ HAI chế độ; topbar #0A7BBE/trắng (sáng) và #14233A/chữ sáng (tối); footer đọc rõ; thẻ tính năng #295380 chữ trắng; không còn chữ xanh nhạt trên nền xanh nhạt.

## 5. Danh sách file đã sửa

1. `frontend/src/index.css` — token 2 chế độ, `.hero-surface`, rule tiêu đề kế thừa trên bề mặt đậm.
2. `frontend/tailwind.config.js` — container padding, nhóm màu `topbar`/`hero`, `<alpha-value>`.
3. `frontend/src/components/ui/card.tsx` — bỏ `pt-0`, chuẩn hóa `p-5/p-6`.
4. 16 file xóa đè `p-4` + nâng `gap-3→gap-4` cho lưới thẻ: `StatCard.tsx`, `LibraryPage.tsx`, `QuickServiceGrid.tsx`, `PublicHomePage.tsx`, `StudentHomePage.tsx`, `ApplicationDetailPage.tsx`, `MyApplicationsPage.tsx`, `AuditLogPage.tsx`, `CatalogPage.tsx`, `IssuedDocumentsPage.tsx`, `RequestTypeAdminPage.tsx`, `TemplateAdminPage.tsx`, `UsersPage.tsx`, `WorkflowAdminPage.tsx`, `PendingPage.tsx`, `ProcessedPage.tsx`, `ProcessingDetailPage.tsx`, `ProfilePage.tsx`.
5. 7 file màu: `Header.tsx`, `Footer.tsx`, `Sidebar.tsx`, `PublicHomePage.tsx`, `StudentHomePage.tsx`, `LoginPage.tsx`, `ChatbotWidget.tsx`.
6. Mới: `frontend/scripts/check-contrast.mjs` (WCAG, đọc token, hỗ trợ alpha composite), `frontend/scripts/ui-probe.mjs` (đo padding/overflow/hero + chụp ảnh qua CDP), `docs/anh-giao-dien/*` (8 ảnh), báo cáo này.

## Quyết định tự chọn

- Chẩn đoán bằng Chrome headless + CDP (trình duyệt in-app không truy cập được localhost của máy dev — 502); đo trực tiếp được h1 #0B3C6F trên nền #0B3C6F.
- Topbar chọn phương án "nền #0A7BBE chữ #FFFFFF" (đề cho 2 lựa chọn); footer dùng chung token `topbar`.
- Thẻ tính năng trong hero: chọn "trắng 12% trên nền đậm" → token đậm #295380 (sáng) / #234469 (tối), đạt 7,95:1 và 10,01:1.
- CardHeader để `pb-0` và CardContent có đệm đỉnh riêng: khoảng tiêu đề → nội dung = 20/24px, thống nhất cho cả thẻ có/không có CardHeader.
- Chỉ nâng `gap-3→gap-4` cho lưới chứa thẻ; giữ `gap-3` cho danh sách bên trong thẻ (đúng khoảng 12–16px nội bộ).
- Cỡ chữ giữ nguyên của thiết kế (nội dung chính ≥14px, chú thích 12px đã đúng); không đổi weight.
- Sửa lỗi tự gây: regex xóa `p-4` làm hỏng quote ở CatalogPage.tsx:345 → đã sửa thành `<CardContent>`, tsc PASS.

## CHƯA LÀM

- Rà bằng ảnh chụp chỉ mới gồm: trang chủ công khai, thư viện biểu mẫu, đăng nhập (cả 2 chế độ, 1280/390). Các trang còn lại (danh sách đơn, chi tiết đơn, hộp thư chờ duyệt, xác thực công khai, Admin…) đã rà bằng đọc code + đo `overflow=0` nhưng chưa chụp ảnh.
- Cặp viền < 3:1 (giữ đúng hex người dùng chỉ định) — cần quyết định: giữ nguyên hay đậm hơn để đạt chuẩn UI ≥3.
- `UserMenu.tsx:54`, `ThemeToggle.tsx:26` vẫn dùng `text-white` khi `onDark` — nằm trên bề mặt `bg-topbar` nên vẫn đọc được (trắng là màu chủ đích), chưa đổi sang token `topbar-foreground`.
