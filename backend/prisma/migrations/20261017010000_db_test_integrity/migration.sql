-- Ràng buộc toàn vẹn bổ sung phục vụ kiểm thử CSDL (Phần 2).
-- Prisma không mô hình hóa CHECK / function / GUC nên không gây drift schema.

-- Đồng hồ giả cho kiểm thử: SET motcua.now = '2027-01-01 00:00:00+07'
CREATE OR REPLACE FUNCTION motcua_now() RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('motcua.now', true), '')::timestamptz,
    clock_timestamp()
  );
$$;

CREATE TABLE IF NOT EXISTS application_code_year (
  nam INTEGER PRIMARY KEY
);

INSERT INTO application_code_year (nam)
SELECT EXTRACT(YEAR FROM motcua_now())::int
WHERE NOT EXISTS (SELECT 1 FROM application_code_year);

CREATE OR REPLACE FUNCTION next_ma_ho_so() RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  y int := EXTRACT(YEAR FROM motcua_now())::int;
  last_y int;
BEGIN
  SELECT nam INTO last_y FROM application_code_year LIMIT 1;
  IF last_y IS NULL THEN
    INSERT INTO application_code_year(nam) VALUES (y);
  ELSIF last_y <> y THEN
    PERFORM setval('application_code_seq', 1, false);
    UPDATE application_code_year SET nam = y;
  END IF;
  RETURN 'MC-' || y::text || '-' || lpad(nextval('application_code_seq')::text, 6, '0');
END;
$$;

-- SLA không âm
ALTER TABLE workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_sla_nonneg;
ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_sla_nonneg CHECK (sla_hours >= 0);

ALTER TABLE step_instances DROP CONSTRAINT IF EXISTS step_instances_sla_nonneg;
ALTER TABLE step_instances ADD CONSTRAINT step_instances_sla_nonneg CHECK (sla_hours >= 0);

-- Ủy quyền: ngày kết thúc không trước ngày bắt đầu
ALTER TABLE delegations DROP CONSTRAINT IF EXISTS delegations_date_order;
ALTER TABLE delegations ADD CONSTRAINT delegations_date_order CHECK (den_ngay >= tu_ngay);
