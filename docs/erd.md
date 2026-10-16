# Sơ đồ quan hệ thực thể (ERD) — Cổng Một cửa điện tử TBU

Sinh từ `backend/prisma/schema.prisma`. Khóa chính/khóa ngoại là **UUID**.
Cột `ma` / `ma_so` / `ma_ho_so` là **định danh công khai** (mã nghiệp vụ) dùng trên URL.
Mọi bảng nghiệp vụ chính đều có `created_at`, `updated_at`; các bảng danh mục/người dùng
có thêm `deleted_at` (xóa mềm).

## Tổng quan

```mermaid
erDiagram
  %% ================= TỔ CHỨC =================
  FACULTIES {
    uuid id PK
    string ma UK "k_cntt"
    string ten
    string viet_tat
    uuid truong_khoa_id FK
    timestamp created_at
    timestamp updated_at
    timestamp deleted_at
  }
  DEPARTMENTS {
    uuid id PK
    string ma UK "p_pdt"
    string ten
    string viet_tat
    uuid truong_phong_id FK
    timestamp deleted_at
  }
  ACADEMIC_YEARS {
    uuid id PK
    string ma UK "kh_k19"
    string ten
    int nam_bat_dau
    int nam_ket_thuc
  }
  MAJORS {
    uuid id PK
    string ma UK "n_cntt"
    string ten
    uuid faculty_id FK
  }
  MAJOR_ACADEMIC_YEARS {
    uuid major_id PK,FK
    uuid academic_year_id PK,FK
  }
  STAFF_POSITIONS {
    uuid id PK
    string ma UK
    string ten
    uuid faculty_id FK
  }
  CLASSES {
    uuid id PK
    string ma UK "l_cntt1_k19"
    string ten
    uuid faculty_id FK
    uuid major_id FK
    uuid academic_year_id FK
    uuid co_van_id FK
    int si_so
  }
  USERS {
    uuid id PK
    string ma_so UK "20211234 / CV001"
    string ho_ten
    string email UK
    string password_hash
    enum role "SINH_VIEN|CO_VAN|TRUONG_KHOA|PHONG_DAO_TAO|ADMIN"
    enum trang_thai "ACTIVE|LOCKED"
    uuid faculty_id FK
    uuid department_id FK
    uuid staff_position_id FK
    timestamp deleted_at
  }
  STUDENTS {
    uuid id PK
    uuid user_id FK,UK
    uuid class_id FK
    int enrollment_year
  }

  %% ================= LUỒNG DUYỆT =================
  WORKFLOW_DEFINITIONS {
    uuid id PK
    string ma "WF-01"
    int version
    int cap_do
    bool hoat_dong
    UK ma_version "ma, version"
  }
  WORKFLOW_STEPS {
    uuid id PK
    uuid workflow_id FK
    int order
    string ten
    enum role
    enum mode "ONE_CLICK|OTP"
    int sla_hours
    bool allow_reject
    bool allow_supplement
  }
  REQUEST_TYPES {
    uuid id PK
    string ma UK "rt_gxn"
    string ten
    string nhom
    uuid workflow_id FK
    uuid template_id FK
    int so_ngay_xu_ly
    int le_phi
    bool hoat_dong
  }
  REQUEST_TYPE_FIELDS {
    uuid id PK
    uuid request_type_id FK
    string key
    string label
    enum type
    bool required
    json options
    json default_value
    int order
    bool read_only
  }
  REQUIRED_DOCUMENTS {
    uuid id PK
    uuid request_type_id FK
    string key
    string label
    bool bat_buoc
  }
  DOCUMENT_TEMPLATES {
    uuid id PK
    string ma UK "MVT-GXN"
    string ten
    string loai_van_ban
    string noi_dung "biến {{ho_ten}}..."
    bool hoat_dong
  }

  %% ================= HỒ SƠ =================
  APPLICATIONS {
    uuid id PK
    string ma_ho_so UK "MC-YYYY-NNNNNN"
    uuid request_type_id FK
    uuid applicant_id FK
    uuid faculty_id FK
    uuid class_id FK
    enum trang_thai "DRAFT..COMPLETED|CANCELLED"
    json du_lieu "snapshot biểu mẫu"
    uuid workflow_id FK
    int workflow_version
    int current_step_order
    int tong_so_buoc
    int buoc_da_duyet
    timestamp han_xu_ly
    string ly_do_tu_choi
    json yeu_cau_bo_sung
    timestamp deleted_at
  }
  APPLICATION_ATTACHMENTS {
    uuid id PK
    uuid application_id FK
    string ten
    string loai
    int kich_thuoc
    string storage_key
    string requirement_key
    uuid nguoi_tai_len_id FK
  }
  STEP_INSTANCES {
    uuid id PK
    uuid application_id FK
    uuid workflow_step_id FK
    int step_order
    enum role
    enum mode
    enum trang_thai "PENDING|IN_PROGRESS|APPROVED|REJECTED|SKIPPED"
    uuid assignee_id FK
    timestamp sla_due_at
    timestamp started_at
    timestamp completed_at
    UK app_order "application_id, step_order"
  }
  APPROVALS {
    uuid id PK
    uuid application_id FK
    uuid step_instance_id FK
    int buoc_order
    enum hanh_dong "SUBMIT|APPROVE|REJECT|REQUEST_SUPPLEMENT|SUPPLEMENT|CANCEL|ISSUE_DOCUMENT|REVOKE_DOCUMENT"
    uuid actor_id FK
    enum vai_tro
    string ghi_chu
    string ly_do
    enum phuong_thuc
    string idempotency_key
  }
  IDEMPOTENCY_KEYS {
    uuid id PK
    string key
    uuid user_id FK
    string endpoint
    string request_hash
    int response_status
    json response_body
    timestamp expires_at
    UK user_key "user_id, key"
  }
  DELEGATIONS {
    uuid id PK
    uuid nguoi_uy_quyen_id FK
    uuid nguoi_nhan_id FK
    enum vai_tro
    timestamp tu_ngay
    timestamp den_ngay
    bool hieu_luc
  }

  %% ================= KÝ SỐ & VĂN BẢN =================
  SIGNATURES {
    uuid id PK
    uuid application_id FK
    uuid van_ban_id FK
    int buoc_order
    string ten_buoc
    uuid nguoi_ky_id FK
    string ho_ten
    string chuc_vu
    enum vai_tro
    enum phuong_thuc "OTP|ELECTRONIC"
    timestamp thoi_diem_ky
    string ma_bam "SHA-256"
    string ma_chu_ky
    bool hop_le
  }
  OTP_CHALLENGES {
    uuid id PK
    uuid user_id FK
    uuid application_id FK
    int step_order
    string otp_hash ">=32 ký tự, chỉ lưu băm"
    timestamp het_han_luc
    int so_lan_thu
    int so_lan_con_lai
    timestamp khoa_den_luc
    bool da_dung
  }
  SIGNED_DOCUMENTS {
    uuid id PK
    string so_van_ban UK
    uuid template_id FK
    uuid application_id FK,UK
    json sinh_vien_snapshot
    string noi_dung
    timestamp ngay_cap
    string token_xac_thuc UK ">=128 bit"
    string ma_bam_sha256 "SHA-256 tệp PDF"
    string pdf_storage_key
    enum trang_thai "VALID|REVOKED|INVALID"
    bool chu_ky_con_hieu_luc
    string ly_do_thu_hoi
    timestamp ngay_thu_hoi
  }
  DOCUMENT_DOWNLOADS {
    uuid id PK
    uuid document_id FK
    uuid nguoi_tai_id FK
    string nguoi_tai_ten
    string dia_chi_ip
    string muc_dich "export|download"
  }

  %% ================= THÔNG BÁO / NHẬT KÝ / THƯ VIỆN =================
  NOTIFICATIONS {
    uuid id PK
    string tieu_de
    string noi_dung
    enum loai "INFO|SUCCESS|WARNING|DANGER"
    uuid nguoi_nhan_id FK
    uuid application_id FK
    bool da_doc
  }
  AUDIT_LOGS {
    uuid id PK
    timestamp luc
    uuid nguoi_thuc_hien_id FK
    string nguoi_thuc_hien_ten
    enum vai_tro
    string hanh_dong
    string doi_tuong
    string doi_tuong_id
    string gia_tri_truoc
    string gia_tri_sau
    string dia_chi_ip
    string thiet_bi
  }
  LIBRARY_DOCUMENTS {
    uuid id PK
    string ten
    string nhom
    string loai_tep
    string kich_thuoc
    string url
    int luot_tai
  }

  %% ================= TRỢ LÝ ẢO / PHIÊN =================
  CHAT_SESSIONS {
    uuid id PK
    uuid user_id FK
    string tieu_de
  }
  CHAT_MESSAGES {
    uuid id PK
    uuid session_id FK
    enum vai_tro "USER|ASSISTANT"
    string noi_dung
    json nguon "trích dẫn file+trang"
    json goi_y_form
    bool huu_ich
  }
  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    string token_hash UK
    timestamp het_han
    bool da_thu_hoi
  }

  %% ================= QUAN HỆ =================
  FACULTIES      ||--o{ MAJORS                : "có ngành"
  FACULTIES      ||--o{ CLASSES               : "có lớp"
  FACULTIES      ||--o{ USERS                 : "thuộc khoa"
  FACULTIES      ||--o{ STAFF_POSITIONS       : "vị trí theo khoa"
  FACULTIES      ||--o{ APPLICATIONS          : "hồ sơ theo khoa"
  FACULTIES      ||--o| USERS                 : "trưởng khoa"
  DEPARTMENTS    ||--o{ USERS                 : "thuộc phòng"
  DEPARTMENTS    ||--o| USERS                 : "trưởng phòng"
  STAFF_POSITIONS||--o{ USERS                 : "bổ nhiệm"
  ACADEMIC_YEARS ||--o{ MAJOR_ACADEMIC_YEARS  : "mở cho ngành"
  MAJORS         ||--o{ MAJOR_ACADEMIC_YEARS  : "mở theo khóa"
  MAJORS         ||--o{ CLASSES               : "lớp theo ngành"
  ACADEMIC_YEARS ||--o{ CLASSES               : "lớp theo khóa"
  USERS          ||--o{ CLASSES               : "cố vấn học tập"
  USERS          ||--o| STUDENTS              : "hồ sơ sinh viên"
  CLASSES        ||--o{ STUDENTS              : "sinh viên của lớp"
  CLASSES        ||--o{ APPLICATIONS          : "hồ sơ theo lớp"

  WORKFLOW_DEFINITIONS ||--o{ WORKFLOW_STEPS  : "gồm các bước"
  WORKFLOW_DEFINITIONS ||--o{ REQUEST_TYPES   : "áp dụng cho loại đơn"
  WORKFLOW_DEFINITIONS ||--o{ APPLICATIONS    : "chạy theo luồng"
  WORKFLOW_STEPS       ||--o{ STEP_INSTANCES  : "hiện thực hóa"
  REQUEST_TYPES        ||--o{ REQUEST_TYPE_FIELDS : "trường biểu mẫu"
  REQUEST_TYPES        ||--o{ REQUIRED_DOCUMENTS  : "giấy tờ bắt buộc"
  REQUEST_TYPES        ||--o{ APPLICATIONS        : "đơn theo loại"
  DOCUMENT_TEMPLATES   ||--o{ REQUEST_TYPES       : "mẫu phát hành"
  DOCUMENT_TEMPLATES   ||--o{ SIGNED_DOCUMENTS    : "sinh văn bản"

  USERS          ||--o{ APPLICATIONS          : "người nộp"
  APPLICATIONS   ||--o{ APPLICATION_ATTACHMENTS : "tệp đính kèm"
  APPLICATIONS   ||--o{ STEP_INSTANCES        : "các bước xử lý"
  APPLICATIONS   ||--o{ APPROVALS             : "lịch sử thao tác"
  APPLICATIONS   ||--o{ SIGNATURES            : "chữ ký"
  APPLICATIONS   ||--o{ OTP_CHALLENGES        : "thử thách OTP"
  APPLICATIONS   ||--o| SIGNED_DOCUMENTS      : "văn bản phát hành"
  STEP_INSTANCES ||--o{ APPROVALS             : "thao tác tại bước"
  USERS          ||--o{ STEP_INSTANCES        : "người nhận bước"
  USERS          ||--o{ APPROVALS             : "người thao tác"
  USERS          ||--o{ SIGNATURES            : "người ký"
  USERS          ||--o{ OTP_CHALLENGES        : "yêu cầu OTP"
  USERS          ||--o{ IDEMPOTENCY_KEYS      : "khóa chống trùng"
  USERS          ||--o{ DELEGATIONS           : "ủy quyền đi"
  USERS          ||--o{ DELEGATIONS           : "ủy quyền nhận"

  SIGNED_DOCUMENTS ||--o{ SIGNATURES          : "chữ ký trên văn bản"
  SIGNED_DOCUMENTS ||--o{ DOCUMENT_DOWNLOADS  : "lịch sử tải"
  USERS            ||--o{ DOCUMENT_DOWNLOADS  : "người tải"

  USERS          ||--o{ NOTIFICATIONS         : "nhận thông báo"
  APPLICATIONS   ||--o{ NOTIFICATIONS         : "thông báo theo hồ sơ"
  USERS          ||--o{ AUDIT_LOGS            : "nhật ký tác nhân"
  USERS          ||--o{ CHAT_SESSIONS         : "phiên trò chuyện"
  CHAT_SESSIONS  ||--o{ CHAT_MESSAGES         : "tin nhắn"
  USERS          ||--o{ REFRESH_TOKENS        : "phiên đăng nhập"
```

## Ghi chú thiết kế

| Chủ đề | Quyết định |
| --- | --- |
| Khóa chính | UUID (`@default(uuid())`, cột `uuid`), sinh tất định trong seed bằng UUID v5 |
| Định danh công khai | `faculties.ma`, `departments.ma`, `academic_years.ma`, `majors.ma`, `classes.ma`, `users.ma_so`, `request_types.ma`, `applications.ma_ho_so` |
| Chống trùng | `idempotency_keys` với ràng buộc duy nhất `(user_id, key)`; lưu cả `request_hash` để phát hiện `DUPLICATE_ACTION` |
| OTP | `otp_challenges.otp_hash` chỉ lưu băm (CHECK `>= 32` ký tự) |
| Văn bản | `signed_documents.token_xac_thuc` (CHECK `>= 32` ký tự ≈ 128 bit), `ma_bam_sha256` (CHECK 64 hex) |
| Nhật ký | `audit_logs` có trigger `audit_logs_append_only` chặn UPDATE/DELETE |
| Mã hồ sơ | Sequence `application_code_seq` + hàm `next_ma_ho_so()` sinh `MC-YYYY-NNNNNN` |
| Xóa mềm | `deleted_at` trên danh mục, người dùng, hồ sơ, văn bản, thư viện |
| Mã 409 | `INVALID_TRANSITION` / `ALREADY_PROCESSED` / `DUPLICATE_ACTION` — xem `docs/QUYET_DINH.md` |
