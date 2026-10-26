-- Q3 (Bước 1): Đồng bộ sequence mã hồ sơ với mã lớn nhất đã có của một năm.
--
-- Vì sao cần: dữ liệu seed chèn mã hồ sơ VIẾT TAY (MC-2026-000120 … MC-2026-000154)
-- trực tiếp vào bảng applications mà không tiến `application_code_seq`. Khi sequence
-- bị reset về 1 do đổi năm (xem next_ma_ho_so() ở migration 20261017010000), các mã
-- sinh mới sẽ chạy lại từ 000001 và có thể ĐỤNG vào mã đã chèn tay ⇒ lỗi trùng khóa.
--
-- Hàm dưới đây CHỈ ĐỌC dữ liệu hiện có rồi đặt sequence = max mã của năm đó,
-- nên lần nextval() kế tiếp luôn lớn hơn mọi mã đang tồn tại. Không sửa dữ liệu nghiệp vụ.
CREATE OR REPLACE FUNCTION sync_ma_ho_so_sequence(nam integer DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  y integer := COALESCE(nam, EXTRACT(YEAR FROM motcua_now())::integer);
  max_num bigint;
BEGIN
  -- Mã hợp lệ có dạng MC-YYYY-NNNNNN; substring trả NULL nếu không khớp mẫu.
  SELECT COALESCE(MAX(substring(ma_ho_so FROM '^MC-\d{4}-(\d+)$')::bigint), 0)
    INTO max_num
    FROM applications
   WHERE ma_ho_so ~ ('^MC-' || y::text || '-\d+$');

  IF max_num <= 0 THEN
    -- Không có hồ sơ nào của năm này: giữ nguyên sequence, không đụng gì thêm.
    RETURN 0;
  END IF;

  -- is_called = true ⇒ nextval() kế tiếp trả về max_num + 1.
  PERFORM setval('application_code_seq', max_num, true);

  -- Bảng application_code_year phải giữ đúng MỘT dòng = năm đang đồng bộ,
  -- vì next_ma_ho_so() đọc dòng đầu tiên để phát hiện đổi năm.
  DELETE FROM application_code_year;
  INSERT INTO application_code_year (nam) VALUES (y);

  RETURN max_num;
END;
$$;
