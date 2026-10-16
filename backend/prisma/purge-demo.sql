-- =====================================================================
-- Xóa sạch DỮ LIỆU DEMO (is_demo = true) để đưa hệ thống vào chạy thật.
-- Xem hướng dẫn đầy đủ tại docs/QUY_TRINH_VAN_HANH.md
--
--   cd backend
--   npm run demo:purge        (prisma db execute --file prisma/purge-demo.sql)
--
-- Thứ tự xóa tuân theo khóa ngoại. Các bảng con (request_type_fields,
-- required_documents, workflow_steps, major_academic_years,
-- application_attachments, step_instances, approvals, signatures,
-- otp_challenges) tự xóa theo ON DELETE CASCADE.
-- =====================================================================

BEGIN;

-- audit_logs là bảng chỉ-ghi-thêm: tạm tắt trigger để xóa dữ liệu demo.
ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only;
DELETE FROM audit_logs WHERE is_demo;

-- Hồ sơ và văn bản (cascade sang bảng con)
DELETE FROM notifications       WHERE is_demo;
DELETE FROM document_downloads  WHERE is_demo;
DELETE FROM signed_documents    WHERE is_demo;
DELETE FROM applications        WHERE is_demo;

-- Cấu hình
DELETE FROM library_documents   WHERE is_demo;
DELETE FROM request_types       WHERE is_demo;
DELETE FROM workflow_definitions WHERE is_demo;
DELETE FROM document_templates  WHERE is_demo;

-- Gỡ khóa ngoại trỏ tới người dùng trước khi xóa người dùng
UPDATE faculties  SET truong_khoa_id  = NULL WHERE is_demo;
UPDATE departments SET truong_phong_id = NULL WHERE is_demo;
UPDATE classes    SET co_van_id        = NULL WHERE is_demo;

-- Tổ chức và người dùng
DELETE FROM students         WHERE is_demo;
DELETE FROM users            WHERE is_demo;
DELETE FROM classes          WHERE is_demo;
DELETE FROM staff_positions  WHERE is_demo;
DELETE FROM majors           WHERE is_demo;
DELETE FROM academic_years   WHERE is_demo;
DELETE FROM departments      WHERE is_demo;
DELETE FROM faculties        WHERE is_demo;

ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_append_only;

COMMIT;

-- Kiểm tra còn sót dữ liệu demo hay không:
--   SELECT 'users' t, count(*) FROM users WHERE is_demo
--   UNION ALL SELECT 'applications', count(*) FROM applications WHERE is_demo
--   UNION ALL SELECT 'signed_documents', count(*) FROM signed_documents WHERE is_demo;
