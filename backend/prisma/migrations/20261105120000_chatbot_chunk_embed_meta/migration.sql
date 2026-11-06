-- Chatbot AI — siêu dữ liệu embedding (Việc 5): lưu tên mô hình + số chiều
-- vector cùng từng đoạn tri thức. CHỈ THÊM cột nullable mới, KHÔNG đổi cột cũ,
-- KHÔNG drop, KHÔNG rename (AN TOÀN: additive-only).
-- Lý do không backfill: các vector hiện có trên CSDL test là vector giả 32
-- chiều tạo bởi FakeProvider khi seed — ghi mô hình thật vào sẽ sai sự thật;
-- tên/số chiều được ghi lại từ lần nạp kế tiếp có khóa Gemini.

ALTER TABLE "knowledge_chunks" ADD COLUMN "mo_hinh_embedding" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN "so_chieu_embedding" INTEGER;

-- Cột thường (không cần index): chỉ mục truy xuất không phụ thuộc cột này.
