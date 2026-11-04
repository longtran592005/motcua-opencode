\# YÊU CẦU LÀM SAU KHI XONG CHATBOT: CHAT TRỰC TIẾP SINH VIÊN ↔ CÁN BỘ



\## Yêu cầu của người dùng (nguyên văn tinh thần)

1\. Sinh viên có thể chat với cán bộ trên web.

2\. Mọi vai trò cao hơn sinh viên (CO\_VAN, TRUONG\_KHOA, PHONG\_DAO\_TAO, ADMIN) đều có thể trả lời.

3\. Khi đã có một người trả lời, mặc định các tài khoản khác KHÔNG chat được với sinh viên đó.

4\. Các câu hỏi sau đó của sinh viên trong cùng một phiên chat sẽ thông báo tới tài khoản đã nhận trả lời.

5\. Tài khoản khách muốn chat phải đăng nhập.



\## Giả định thiết kế đề xuất (chưa chốt, xác nhận khi làm)

\- Điểm vào: nút "Chat với cán bộ" trong khung chatbot; liên hệ với cơ chế "chuyển câu hỏi khó cho cán bộ" (chat\_handoffs) của chatbot.

\- Phiên chat có trạng thái: CHỜ NHẬN → ĐÃ NHẬN (có người phụ trách) → ĐÃ ĐÓNG.

\- Người đầu tiên bấm nhận/trả lời giành phiên. Phải xử lý tranh chấp bằng cập nhật nguyên tử trong CSDL (hai cán bộ cùng trả lời một lúc thì chỉ một người thắng, người còn lại báo "đã có người nhận").

\- Các cán bộ khác vẫn thấy phiên ở chế độ chỉ đọc (hoặc không thấy), không gửi được tin.

\- Có cách chuyển phiên sang người khác (người phụ trách hoặc ADMIN), tự thả phiên nếu người nhận không trả lời sau một thời gian cấu hình, và ADMIN can thiệp được (ghi audit log).

\- Tin nhắn mới của sinh viên: thông báo cho người phụ trách (chuông + trong khung chat). Chưa ai nhận thì thông báo cho nhóm cán bộ được phép (Phòng Đào tạo, Admin, và cố vấn của sinh viên đó).

\- Cập nhật gần thời gian thực: dùng polling 5-10 giây trước (đơn giản); SSE để sau.

\- Khách chưa đăng nhập: yêu cầu đăng nhập, không có chat ẩn danh.

\- Cần quyết định khi làm: cán bộ nào thấy sinh viên nào (mọi vai trò thấy hết, hay cố vấn chỉ thấy sinh viên mình phụ trách), thời gian lưu tin nhắn, giới hạn tần suất, có cho gửi tệp/ảnh không, cách đóng phiên, đánh giá sau chat.

