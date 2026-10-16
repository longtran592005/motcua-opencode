-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SINH_VIEN', 'CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('NAM', 'NU', 'KHAC');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('ONE_CLICK', 'OTP');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('VALID', 'REVOKED', 'INVALID');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('OTP', 'ELECTRONIC');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'email', 'phone', 'upload');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_SUPPLEMENT', 'SUPPLEMENT', 'CANCEL', 'ISSUE_DOCUMENT', 'REVOKE_DOCUMENT');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "faculties" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "viet_tat" TEXT NOT NULL,
    "truong_khoa_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "viet_tat" TEXT NOT NULL,
    "truong_phong_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "nam_bat_dau" INTEGER NOT NULL,
    "nam_ket_thuc" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majors" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "faculty_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "major_academic_years" (
    "major_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,

    CONSTRAINT "major_academic_years_pkey" PRIMARY KEY ("major_id","academic_year_id")
);

-- CreateTable
CREATE TABLE "staff_positions" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "mo_ta" TEXT,
    "faculty_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "staff_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "faculty_id" UUID NOT NULL,
    "major_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "co_van_id" UUID,
    "si_so" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "ma_so" TEXT NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "avatar_url" TEXT,
    "so_dien_thoai" TEXT,
    "ngay_sinh" DATE,
    "gioi_tinh" "Gender",
    "chuc_vu" TEXT,
    "trang_thai" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "faculty_id" UUID,
    "department_id" UUID,
    "staff_position_id" UUID,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "enrollment_year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_types" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "nhom" TEXT NOT NULL,
    "mo_ta" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "mau" TEXT NOT NULL,
    "workflow_id" UUID,
    "template_id" UUID,
    "so_ngay_xu_ly" INTEGER NOT NULL DEFAULT 3,
    "le_phi" INTEGER NOT NULL DEFAULT 0,
    "hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "request_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_type_fields" (
    "id" UUID NOT NULL,
    "request_type_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "placeholder" TEXT,
    "help_text" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "default_value" JSONB,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "rows" INTEGER,
    "accept" TEXT,
    "max_size_mb" DOUBLE PRECISION,
    "width" TEXT,
    "order" INTEGER NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_type_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "required_documents" (
    "id" UUID NOT NULL,
    "request_type_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bat_buoc" BOOLEAN NOT NULL DEFAULT true,
    "accept" TEXT,
    "help_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "required_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cap_do" INTEGER NOT NULL DEFAULT 1,
    "hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "ten" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mode" "ApprovalMode" NOT NULL,
    "sla_hours" INTEGER NOT NULL DEFAULT 48,
    "allow_reject" BOOLEAN NOT NULL DEFAULT true,
    "allow_supplement" BOOLEAN NOT NULL DEFAULT true,
    "mo_ta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "ma_ho_so" TEXT NOT NULL,
    "request_type_id" UUID NOT NULL,
    "applicant_id" UUID NOT NULL,
    "faculty_id" UUID,
    "class_id" UUID,
    "trang_thai" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "du_lieu" JSONB NOT NULL DEFAULT '{}',
    "workflow_id" UUID,
    "workflow_version" INTEGER,
    "current_step_order" INTEGER NOT NULL DEFAULT 0,
    "tong_so_buoc" INTEGER NOT NULL DEFAULT 0,
    "buoc_da_duyet" INTEGER NOT NULL DEFAULT 0,
    "han_xu_ly" TIMESTAMP(3),
    "ngay_nop" TIMESTAMP(3),
    "ngay_hoan_thanh" TIMESTAMP(3),
    "ly_do_tu_choi" TEXT,
    "yeu_cau_bo_sung" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_attachments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "ten" TEXT NOT NULL,
    "loai" TEXT NOT NULL,
    "kich_thuoc" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "requirement_key" TEXT,
    "nguoi_tai_len_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_instances" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "workflow_step_id" UUID,
    "step_order" INTEGER NOT NULL,
    "ten" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mode" "ApprovalMode" NOT NULL,
    "trang_thai" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "assignee_id" UUID,
    "sla_due_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "step_instance_id" UUID,
    "buoc_order" INTEGER NOT NULL,
    "hanh_dong" "ApprovalActionType" NOT NULL,
    "actor_id" UUID,
    "vai_tro" "Role" NOT NULL,
    "chuc_vu" TEXT,
    "ghi_chu" TEXT,
    "ly_do" TEXT,
    "phuong_thuc" "ApprovalMode",
    "signature_id" UUID,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL,
    "nguoi_uy_quyen_id" UUID NOT NULL,
    "nguoi_nhan_id" UUID NOT NULL,
    "vai_tro" "Role" NOT NULL,
    "tu_ngay" TIMESTAMP(3) NOT NULL,
    "den_ngay" TIMESTAMP(3) NOT NULL,
    "ly_do" TEXT NOT NULL,
    "hieu_luc" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "van_ban_id" UUID,
    "buoc_order" INTEGER NOT NULL,
    "ten_buoc" TEXT NOT NULL,
    "nguoi_ky_id" UUID NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "chuc_vu" TEXT,
    "vai_tro" "Role" NOT NULL,
    "phuong_thuc" "SignatureMethod" NOT NULL,
    "thoi_diem_ky" TIMESTAMP(3) NOT NULL,
    "ma_bam" TEXT NOT NULL,
    "ma_chu_ky" TEXT NOT NULL,
    "hop_le" BOOLEAN NOT NULL DEFAULT true,
    "ly_do_khong_hop_le" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "het_han_luc" TIMESTAMP(3) NOT NULL,
    "so_lan_thu" INTEGER NOT NULL DEFAULT 0,
    "so_lan_con_lai" INTEGER NOT NULL DEFAULT 5,
    "khoa_den_luc" TIMESTAMP(3),
    "da_dung" BOOLEAN NOT NULL DEFAULT false,
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loai_van_ban" TEXT NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "hoat_dong" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_documents" (
    "id" UUID NOT NULL,
    "so_van_ban" TEXT NOT NULL,
    "trich_yeu" TEXT NOT NULL,
    "loai_van_ban" TEXT NOT NULL,
    "template_id" UUID,
    "application_id" UUID NOT NULL,
    "sinh_vien_snapshot" JSONB NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "ngay_cap" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token_xac_thuc" TEXT NOT NULL,
    "ma_bam_sha256" TEXT NOT NULL,
    "pdf_storage_key" TEXT,
    "trang_thai" "DocumentStatus" NOT NULL DEFAULT 'VALID',
    "chu_ky_con_hieu_luc" BOOLEAN NOT NULL DEFAULT true,
    "ly_do_thu_hoi" TEXT,
    "ngay_thu_hoi" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "signed_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_downloads" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "nguoi_tai_id" UUID,
    "nguoi_tai_ten" TEXT NOT NULL,
    "dia_chi_ip" TEXT NOT NULL,
    "user_agent" TEXT,
    "muc_dich" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tieu_de" TEXT NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "loai" "NotificationType" NOT NULL,
    "nguoi_nhan_id" UUID NOT NULL,
    "application_id" UUID,
    "ma_ho_so" TEXT,
    "da_doc" BOOLEAN NOT NULL DEFAULT false,
    "lien_ket" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "luc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nguoi_thuc_hien_id" UUID,
    "nguoi_thuc_hien_ten" TEXT NOT NULL,
    "vai_tro" "Role" NOT NULL,
    "hanh_dong" TEXT NOT NULL,
    "doi_tuong" TEXT NOT NULL,
    "doi_tuong_id" TEXT NOT NULL,
    "gia_tri_truoc" TEXT,
    "gia_tri_sau" TEXT,
    "dia_chi_ip" TEXT NOT NULL,
    "thiet_bi" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_documents" (
    "id" UUID NOT NULL,
    "ten" TEXT NOT NULL,
    "nhom" TEXT NOT NULL,
    "mo_ta" TEXT NOT NULL DEFAULT '',
    "loai_tep" TEXT NOT NULL,
    "kich_thuoc" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "luot_tai" INTEGER NOT NULL DEFAULT 0,
    "bat_buoc_voi_loai_don" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "tieu_de" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "vai_tro" "ChatRole" NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "nguon" JSONB,
    "goi_y_form" JSONB,
    "huu_ich" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "het_han" TIMESTAMP(3) NOT NULL,
    "da_thu_hoi" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "dia_chi_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DepartmentHead" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DepartmentHead_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculties_ma_key" ON "faculties"("ma");

-- CreateIndex
CREATE INDEX "faculties_deleted_at_idx" ON "faculties"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_ma_key" ON "departments"("ma");

-- CreateIndex
CREATE INDEX "departments_deleted_at_idx" ON "departments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_ma_key" ON "academic_years"("ma");

-- CreateIndex
CREATE INDEX "academic_years_deleted_at_idx" ON "academic_years"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "majors_ma_key" ON "majors"("ma");

-- CreateIndex
CREATE INDEX "majors_faculty_id_idx" ON "majors"("faculty_id");

-- CreateIndex
CREATE INDEX "majors_deleted_at_idx" ON "majors"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_positions_ma_key" ON "staff_positions"("ma");

-- CreateIndex
CREATE INDEX "staff_positions_faculty_id_idx" ON "staff_positions"("faculty_id");

-- CreateIndex
CREATE INDEX "staff_positions_deleted_at_idx" ON "staff_positions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "classes_ma_key" ON "classes"("ma");

-- CreateIndex
CREATE INDEX "classes_faculty_id_idx" ON "classes"("faculty_id");

-- CreateIndex
CREATE INDEX "classes_major_id_idx" ON "classes"("major_id");

-- CreateIndex
CREATE INDEX "classes_co_van_id_idx" ON "classes"("co_van_id");

-- CreateIndex
CREATE INDEX "classes_deleted_at_idx" ON "classes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_ma_so_key" ON "users"("ma_so");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_faculty_id_idx" ON "users"("faculty_id");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE INDEX "students_class_id_idx" ON "students"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_types_ma_key" ON "request_types"("ma");

-- CreateIndex
CREATE INDEX "request_types_workflow_id_idx" ON "request_types"("workflow_id");

-- CreateIndex
CREATE INDEX "request_types_template_id_idx" ON "request_types"("template_id");

-- CreateIndex
CREATE INDEX "request_types_hoat_dong_idx" ON "request_types"("hoat_dong");

-- CreateIndex
CREATE INDEX "request_types_deleted_at_idx" ON "request_types"("deleted_at");

-- CreateIndex
CREATE INDEX "request_type_fields_request_type_id_idx" ON "request_type_fields"("request_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_type_fields_request_type_id_key_key" ON "request_type_fields"("request_type_id", "key");

-- CreateIndex
CREATE INDEX "required_documents_request_type_id_idx" ON "required_documents"("request_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "required_documents_request_type_id_key_key" ON "required_documents"("request_type_id", "key");

-- CreateIndex
CREATE INDEX "workflow_definitions_deleted_at_idx" ON "workflow_definitions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_ma_version_key" ON "workflow_definitions"("ma", "version");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_id_idx" ON "workflow_steps"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_steps_workflow_id_order_key" ON "workflow_steps"("workflow_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "applications_ma_ho_so_key" ON "applications"("ma_ho_so");

-- CreateIndex
CREATE INDEX "applications_applicant_id_trang_thai_idx" ON "applications"("applicant_id", "trang_thai");

-- CreateIndex
CREATE INDEX "applications_trang_thai_han_xu_ly_idx" ON "applications"("trang_thai", "han_xu_ly");

-- CreateIndex
CREATE INDEX "applications_request_type_id_idx" ON "applications"("request_type_id");

-- CreateIndex
CREATE INDEX "applications_faculty_id_idx" ON "applications"("faculty_id");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE INDEX "applications_deleted_at_idx" ON "applications"("deleted_at");

-- CreateIndex
CREATE INDEX "application_attachments_application_id_idx" ON "application_attachments"("application_id");

-- CreateIndex
CREATE INDEX "step_instances_role_trang_thai_idx" ON "step_instances"("role", "trang_thai");

-- CreateIndex
CREATE INDEX "step_instances_assignee_id_trang_thai_idx" ON "step_instances"("assignee_id", "trang_thai");

-- CreateIndex
CREATE UNIQUE INDEX "step_instances_application_id_step_order_key" ON "step_instances"("application_id", "step_order");

-- CreateIndex
CREATE INDEX "approvals_application_id_created_at_idx" ON "approvals"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "approvals_actor_id_idx" ON "approvals"("actor_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE INDEX "delegations_nguoi_nhan_id_hieu_luc_den_ngay_idx" ON "delegations"("nguoi_nhan_id", "hieu_luc", "den_ngay");

-- CreateIndex
CREATE INDEX "delegations_nguoi_uy_quyen_id_idx" ON "delegations"("nguoi_uy_quyen_id");

-- CreateIndex
CREATE INDEX "signatures_application_id_buoc_order_idx" ON "signatures"("application_id", "buoc_order");

-- CreateIndex
CREATE INDEX "signatures_van_ban_id_idx" ON "signatures"("van_ban_id");

-- CreateIndex
CREATE INDEX "otp_challenges_user_id_application_id_idx" ON "otp_challenges"("user_id", "application_id");

-- CreateIndex
CREATE INDEX "otp_challenges_het_han_luc_idx" ON "otp_challenges"("het_han_luc");

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_ma_key" ON "document_templates"("ma");

-- CreateIndex
CREATE INDEX "document_templates_deleted_at_idx" ON "document_templates"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "signed_documents_so_van_ban_key" ON "signed_documents"("so_van_ban");

-- CreateIndex
CREATE UNIQUE INDEX "signed_documents_application_id_key" ON "signed_documents"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "signed_documents_token_xac_thuc_key" ON "signed_documents"("token_xac_thuc");

-- CreateIndex
CREATE INDEX "signed_documents_trang_thai_idx" ON "signed_documents"("trang_thai");

-- CreateIndex
CREATE INDEX "signed_documents_ngay_cap_idx" ON "signed_documents"("ngay_cap");

-- CreateIndex
CREATE INDEX "signed_documents_deleted_at_idx" ON "signed_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "document_downloads_document_id_created_at_idx" ON "document_downloads"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_nguoi_nhan_id_da_doc_created_at_idx" ON "notifications"("nguoi_nhan_id", "da_doc", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_luc_idx" ON "audit_logs"("luc");

-- CreateIndex
CREATE INDEX "audit_logs_nguoi_thuc_hien_id_idx" ON "audit_logs"("nguoi_thuc_hien_id");

-- CreateIndex
CREATE INDEX "audit_logs_hanh_dong_idx" ON "audit_logs"("hanh_dong");

-- CreateIndex
CREATE INDEX "audit_logs_doi_tuong_doi_tuong_id_idx" ON "audit_logs"("doi_tuong", "doi_tuong_id");

-- CreateIndex
CREATE INDEX "library_documents_nhom_idx" ON "library_documents"("nhom");

-- CreateIndex
CREATE INDEX "library_documents_deleted_at_idx" ON "library_documents"("deleted_at");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_idx" ON "chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_het_han_idx" ON "refresh_tokens"("het_han");

-- CreateIndex
CREATE INDEX "_DepartmentHead_B_index" ON "_DepartmentHead"("B");

-- AddForeignKey
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_truong_khoa_id_fkey" FOREIGN KEY ("truong_khoa_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "majors" ADD CONSTRAINT "majors_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_academic_years" ADD CONSTRAINT "major_academic_years_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "major_academic_years" ADD CONSTRAINT "major_academic_years_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_positions" ADD CONSTRAINT "staff_positions_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_co_van_id_fkey" FOREIGN KEY ("co_van_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_staff_position_id_fkey" FOREIGN KEY ("staff_position_id") REFERENCES "staff_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_types" ADD CONSTRAINT "request_types_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_type_fields" ADD CONSTRAINT "request_type_fields_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_request_type_id_fkey" FOREIGN KEY ("request_type_id") REFERENCES "request_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflow_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_nguoi_uy_quyen_id_fkey" FOREIGN KEY ("nguoi_uy_quyen_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_nguoi_nhan_id_fkey" FOREIGN KEY ("nguoi_nhan_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_nguoi_ky_id_fkey" FOREIGN KEY ("nguoi_ky_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_van_ban_id_fkey" FOREIGN KEY ("van_ban_id") REFERENCES "signed_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_documents" ADD CONSTRAINT "signed_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "signed_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_downloads" ADD CONSTRAINT "document_downloads_nguoi_tai_id_fkey" FOREIGN KEY ("nguoi_tai_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_nguoi_nhan_id_fkey" FOREIGN KEY ("nguoi_nhan_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_nguoi_thuc_hien_id_fkey" FOREIGN KEY ("nguoi_thuc_hien_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentHead" ADD CONSTRAINT "_DepartmentHead_A_fkey" FOREIGN KEY ("A") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentHead" ADD CONSTRAINT "_DepartmentHead_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
