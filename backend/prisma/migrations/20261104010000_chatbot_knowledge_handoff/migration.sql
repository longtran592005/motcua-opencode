-- Chatbot AI (Giai đoạn chatbot): kiến thức truy xuất, phản hồi đánh giá,
-- chuyển câu hỏi lên cán bộ. CHỈ THÊM bảng/cột/enum mới (nullable + mặc định),
-- KHÔNG đổi bảng/cột cũ, KHÔNG drop, KHÔNG rename (Phần 2 AN TOÀN).
-- Prisma không mô hình hóa CHECK/FUNCTION/SEQUENCE nên không gây drift schema.

-- ============ ENUM (chỉ tạo mới) ============
DO $$ BEGIN
  CREATE TYPE "KnowledgeSourceType" AS ENUM ('LIBRARY', 'UPLOAD', 'FAQ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "KnowledgeStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "FeedbackRating" AS ENUM ('UP', 'DOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "HandoffStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ChatMode" AS ENUM ('LLM', 'SEARCH_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ CỘT BỔ SUNG CHO BẢNG CHAT CÓ SẼN (nullable) ============
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS hanh_dong     jsonb;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS che_do       "ChatMode";
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mo_hinh      text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS thoi_gian_ms integer;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS nguoi_dung_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- ============ KIẾN THỨC ============
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                  uuid PRIMARY KEY,
  ma                  varchar(64) NOT NULL UNIQUE,
  title               varchar(300) NOT NULL,
  source_type         "KnowledgeSourceType" NOT NULL,
  library_document_id uuid REFERENCES library_documents(id) ON DELETE SET NULL,
  storage_key         text,
  mime                varchar(120),
  content_hash        varchar(64) NOT NULL DEFAULT '',
  status              "KnowledgeStatus" NOT NULL DEFAULT 'PROCESSING',
  error_message       text,
  version             integer NOT NULL DEFAULT 1,
  uploaded_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          timestamp(3),
  CONSTRAINT knowledge_documents_ma_not_uuid
    CHECK (ma !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  CONSTRAINT knowledge_documents_ma_len CHECK (char_length(ma) BETWEEN 3 AND 64),
  CONSTRAINT knowledge_documents_title_len CHECK (char_length(title) BETWEEN 1 AND 300)
);
CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS knowledge_documents_library_doc_idx ON knowledge_documents(library_document_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_deleted_at_idx ON knowledge_documents(deleted_at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          uuid PRIMARY KEY,
  document_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  page        integer,
  heading     varchar(300),
  content     text NOT NULL,
  embedding   jsonb,
  created_at  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT knowledge_chunks_document_fk
    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_chunks_index_nonneg CHECK (chunk_index >= 0),
  CONSTRAINT knowledge_chunks_content_len CHECK (char_length(content) BETWEEN 1 AND 12000)
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx ON knowledge_chunks(document_id);

-- ============ PHẢN HỒI TIN NHẮN ============
CREATE TABLE IF NOT EXISTS chat_feedback (
  id         uuid PRIMARY KEY,
  message_id uuid NOT NULL,
  user_id    uuid NOT NULL,
  rating     "FeedbackRating" NOT NULL,
  comment    text,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chat_feedback_message_fk FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  CONSTRAINT chat_feedback_user_fk    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chat_feedback_message_user_uq UNIQUE (message_id, user_id)
);

-- ============ CHUYỂN CÁN BỘ ============
CREATE SEQUENCE IF NOT EXISTS chat_handoff_code_seq AS BIGINT START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS chat_handoffs (
  id          uuid PRIMARY KEY,
  ma          varchar(20) NOT NULL UNIQUE,
  user_id     uuid NOT NULL,
  session_id  uuid,
  question    text NOT NULL,
  context     text,
  status      "HandoffStatus" NOT NULL DEFAULT 'OPEN',
  answer      text,
  answered_by uuid,
  answered_at timestamp(3),
  created_at  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chat_handoffs_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chat_handoffs_session_fk FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
  CONSTRAINT chat_handoffs_ma_format CHECK (ma ~ '^CH-[0-9]{4}-[0-9]{6}$'),
  CONSTRAINT chat_handoffs_question_len CHECK (char_length(question) BETWEEN 1 AND 2000),
  CONSTRAINT chat_handoffs_context_len CHECK (context IS NULL OR char_length(context) <= 1500),
  CONSTRAINT chat_handoffs_answer_len CHECK (answer IS NULL OR char_length(answer) <= 5000)
);
CREATE INDEX IF NOT EXISTS chat_handoffs_status_created_idx ON chat_handoffs(status, created_at);
CREATE INDEX IF NOT EXISTS chat_handoffs_user_created_idx ON chat_handoffs(user_id, created_at);

-- Mã CH-YYYY-NNNNNN bằng sequence riêng, lăn năm tương tự next_ma_ho_so().
CREATE TABLE IF NOT EXISTS chat_handoff_code_year (nam INTEGER PRIMARY KEY);

CREATE OR REPLACE FUNCTION next_ma_chat_handoff() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  y int := EXTRACT(YEAR FROM motcua_now())::int;
  last_y int;
BEGIN
  SELECT nam INTO last_y FROM chat_handoff_code_year LIMIT 1;
  IF last_y IS NULL THEN
    INSERT INTO chat_handoff_code_year(nam) VALUES (y);
  ELSIF last_y <> y THEN
    PERFORM setval('chat_handoff_code_seq', 1, false);
    UPDATE chat_handoff_code_year SET nam = y;
  END IF;
  RETURN 'CH-' || y::text || '-' || lpad(nextval('chat_handoff_code_seq')::text, 6, '0');
END;
$$;

-- Đồng bộ sequence với số đã tồn tại trong bảng (như sync_ma_ho_so_sequence).
CREATE OR REPLACE FUNCTION sync_chat_handoff_sequence() RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  max_num bigint;
BEGIN
  SELECT COALESCE(MAX((substring(ma FROM '^CH-[0-9]{4}-([0-9]{6})$'))::bigint), 0)
    INTO max_num
    FROM chat_handoffs
   WHERE ma ~ '^CH-[0-9]{4}-[0-9]{6}$';
  IF max_num <= 0 THEN
    PERFORM setval('chat_handoff_code_seq', 1, false);
  ELSE
    PERFORM setval('chat_handoff_code_seq', max_num, true);
  END IF;
  RETURN max_num;
END;
$$;
