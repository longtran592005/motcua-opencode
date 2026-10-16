-- =====================================================================
-- Bổ sung Giai đoạn 2 (theo yêu cầu người dùng):
--   1) majors.ma_chinh_thuc — mã ngành chính thức của Bộ GD&ĐT (nullable, unique)
--   2) is_demo trên mọi bảng được seed — cờ đánh dấu dữ liệu demo để xóa gọn
--
-- KHÔNG sửa các migration cũ (đã áp dụng).
-- =====================================================================

-- 1) Mã ngành chính thức ------------------------------------------------
ALTER TABLE majors ADD COLUMN ma_chinh_thuc TEXT;
CREATE UNIQUE INDEX majors_ma_chinh_thuc_key ON majors (ma_chinh_thuc);

-- 2) Cờ dữ liệu demo ---------------------------------------------------
ALTER TABLE faculties            ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE departments          ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE academic_years       ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE majors               ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE classes              ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE staff_positions      ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users                ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE students             ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE request_types        ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE workflow_definitions ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE document_templates   ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications         ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE signed_documents     ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE document_downloads   ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications        ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE audit_logs           ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE library_documents    ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;

-- Chỉ mục hỗ trợ lệnh xóa gọn dữ liệu demo (thao tác hiếm, chỉ trên bảng lớn)
CREATE INDEX IF NOT EXISTS applications_is_demo_idx    ON applications (is_demo);
CREATE INDEX IF NOT EXISTS signed_documents_is_demo_idx ON signed_documents (is_demo);
CREATE INDEX IF NOT EXISTS users_is_demo_idx           ON users (is_demo);
