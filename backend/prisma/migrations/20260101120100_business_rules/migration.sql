-- =====================================================================
-- Quy tắc nghiệp vụ bổ sung — Cổng Một cửa điện tử TBU
-- Xem docs/QUYET_DINH.md (nhóm A và nhóm B).
--
-- Các ràng buộc/trigger/sequence trong tệp này KHÔNG được Prisma mô hình hóa
-- (Prisma không introspect CHECK/TRIGGER/FUNCTION/SEQUENCE) nên không gây drift.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Dãy số sinh mã hồ sơ MC-YYYY-NNNNNN (điều kiện B-c, an toàn đồng thời)
--    Bắt đầu từ 1000 để không đụng mã đã nạp trong seed.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS application_code_seq AS BIGINT START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION next_ma_ho_so() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT 'MC-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('application_code_seq')::text, 6, '0')
$$;

-- ---------------------------------------------------------------------
-- 2) Mã nghiệp vụ KHÔNG bao giờ có định dạng UUID (điều kiện B1-a).
--    Regex UUID (mọi phiên bản), không phân biệt hoa/thường.
-- ---------------------------------------------------------------------
ALTER TABLE faculties            ADD CONSTRAINT faculties_ma_not_uuid            CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE departments          ADD CONSTRAINT departments_ma_not_uuid          CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE academic_years       ADD CONSTRAINT academic_years_ma_not_uuid       CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE majors               ADD CONSTRAINT majors_ma_not_uuid               CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE classes              ADD CONSTRAINT classes_ma_not_uuid              CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE staff_positions      ADD CONSTRAINT staff_positions_ma_not_uuid      CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE users                ADD CONSTRAINT users_ma_so_not_uuid             CHECK (ma_so !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE request_types        ADD CONSTRAINT request_types_ma_not_uuid        CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE workflow_definitions ADD CONSTRAINT workflow_definitions_ma_not_uuid CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE document_templates   ADD CONSTRAINT document_templates_ma_not_uuid   CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
ALTER TABLE applications         ADD CONSTRAINT applications_ma_not_uuid        CHECK (ma_ho_so !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Mã hồ sơ đúng định dạng MC-YYYY-NNNNNN
ALTER TABLE applications         ADD CONSTRAINT applications_ma_ho_so_format     CHECK (ma_ho_so ~ '^MC-[0-9]{4}-[0-9]{6}$');

-- ---------------------------------------------------------------------
-- 3) Bảo vệ dữ liệu nhạy cảm của văn bản / OTP
-- ---------------------------------------------------------------------
-- Token xác thực tối thiểu 128 bit (>= 32 ký tự hex)
ALTER TABLE signed_documents ADD CONSTRAINT signed_documents_token_len CHECK (char_length(token_xac_thuc) >= 32);
-- Băm tệp PDF phải là SHA-256 dạng hex (64 ký tự)
ALTER TABLE signed_documents ADD CONSTRAINT signed_documents_sha256 CHECK (ma_bam_sha256 ~* '^[0-9a-f]{64}$');
-- OTP chỉ lưu băm, không bao giờ lưu mã thô 6 chữ số
ALTER TABLE otp_challenges   ADD CONSTRAINT otp_challenges_hash_len CHECK (char_length(otp_hash) >= 32);

-- ---------------------------------------------------------------------
-- 4) audit_logs là bảng CHỈ GHI THÊM (append-only)
--    Giai đoạn 3 sẽ chạy mọi thao tác trong một transaction với người dùng
--    riêng chỉ có quyền INSERT để đảm bảo cả TRUNCATE cũng bị chặn.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs là bảng chỉ ghi thêm (append-only): cấm % trên bản ghi cũ.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- ---------------------------------------------------------------------
-- 5) Chỉ mục phục vụ hộp thư duyệt, thông báo chưa đọc, tra cứu văn bản
-- ---------------------------------------------------------------------
-- Hộp thư theo vai trò + bước còn chờ (kèm hạn xử lý)
CREATE INDEX IF NOT EXISTS step_instances_role_status_due_idx
  ON step_instances (role, trang_thai, sla_due_at);

-- Thông báo chưa đọc của một người dùng (truy vấn nóng nhất của chuông)
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (nguoi_nhan_id, created_at DESC) WHERE da_doc = false;

-- Văn bản còn hiệu lực, mới nhất trước
CREATE INDEX IF NOT EXISTS signed_documents_valid_idx
  ON signed_documents (ngay_cap DESC) WHERE trang_thai = 'VALID' AND deleted_at IS NULL;

-- Hồ sơ đang xử lý còn hạn (bảng điều khiển / job SLA)
CREATE INDEX IF NOT EXISTS applications_active_idx
  ON applications (trang_thai, han_xu_ly) WHERE deleted_at IS NULL;
