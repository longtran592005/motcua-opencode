import type { Role } from '@/types'

export const SCHOOL = {
  ten: 'Trường Đại học Thái Bình',
  tenVietTat: 'ĐH Thái Bình',
  tenTiengAnh: 'Thai Binh University',
  portal: 'Một cửa điện tử',
  website: 'https://tbu.edu.vn',
  websiteLabel: 'tbu.edu.vn',
  hotline: '0227.3633669',
  email: 'support@tbu.edu.vn',
  diaChi: 'Phường Thái Bình, tỉnh Hưng Yên',
  domain: 'motcua.tbu.edu.vn',
  maTruong: 'TBU',
} as const

/** Tài khoản demo cho nút "Đăng nhập nhanh theo vai trò". */
export interface QuickLoginAccount {
  role: Role
  nhan: string
  moTa: string
  dinhDanh: string
  matKhau: string
}

export const QUICK_LOGIN_ACCOUNTS: QuickLoginAccount[] = [
  {
    role: 'SINH_VIEN',
    nhan: 'Sinh viên',
    moTa: 'Nguyễn Văn An · K19 CNTT',
    dinhDanh: '20211234',
    matKhau: 'demo1234',
  },
  {
    role: 'CO_VAN',
    nhan: 'Cố vấn học tập',
    moTa: 'ThS. Trần Thị Mai · Khoa CNTT',
    dinhDanh: 'cv001',
    matKhau: 'demo1234',
  },
  {
    role: 'TRUONG_KHOA',
    nhan: 'Trưởng khoa',
    moTa: 'PGS.TS. Lê Quang Huy · Khoa CNTT',
    dinhDanh: 'tk001',
    matKhau: 'demo1234',
  },
  {
    role: 'PHONG_DAO_TAO',
    nhan: 'Phòng Đào tạo',
    moTa: 'Cô Phạm Thu Hà · Phòng Đào tạo',
    dinhDanh: 'pdt001',
    matKhau: 'demo1234',
  },
  {
    role: 'ADMIN',
    nhan: 'Quản trị hệ thống',
    moTa: 'Anh Đỗ Minh Tuấn · Trung tâm CNTT',
    dinhDanh: 'admin',
    matKhau: 'demo1234',
  },
]

/** Mã OTP chấp nhận ở bản mock. Không hiển thị trên giao diện. */
export const MOCK_OTP_CODE = '123456'

export const OTP_CONFIG = {
  doDai: 6,
  hanSuDungGiay: 180,
  choGuiLaiGiay: 30,
  soLanSaiToiDa: 5,
  thoiGianKhoaPhut: 15,
} as const

/** Thông tin điều hướng chung. */
export interface NavItem {
  to: string
  label: string
  icon: string
  roles?: Role[]
  children?: NavItem[]
  badgeKey?: 'choDuyet'
}

export const PUBLIC_NAV: NavItem[] = [
  { to: '/', label: 'Trang chủ', icon: 'Home' },
  { to: '/thu-vien-bieu-mau', label: 'Biểu mẫu & tài liệu', icon: 'Library' },
  { to: '/xac-thuc', label: 'Xác thực văn bản', icon: 'ShieldCheck' },
]

export const STUDENT_NAV: NavItem[] = [
  { to: '/', label: 'Trang chủ', icon: 'Home' },
  { to: '/don-cua-toi', label: 'Đơn của tôi', icon: 'FileText' },
  { to: '/thu-vien-bieu-mau', label: 'Biểu mẫu & tài liệu', icon: 'Library' },
  { to: '/thong-bao', label: 'Thông báo', icon: 'Bell' },
  { to: '/ho-so-ca-nhan', label: 'Hồ sơ cá nhân', icon: 'UserCircle' },
]

export const ADMIN_NAV: NavItem[] = [
  { to: '/quan-ly', label: 'Tổng quan', icon: 'LayoutDashboard' },
  {
    to: '/quan-ly/cho-duyet',
    label: 'Phê duyệt đơn',
    icon: 'ClipboardCheck',
    roles: ['CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'],
    badgeKey: 'choDuyet',
  },
  {
    to: '/quan-ly/da-xu-ly',
    label: 'Đã xử lý',
    icon: 'History',
    roles: ['CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'],
  },
  {
    to: '/quan-ly/uy-quyen',
    label: 'Ủy quyền duyệt',
    icon: 'UserCog',
    roles: ['TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN'],
  },
  {
    to: '/quan-ly/loai-don',
    label: 'Loại đơn & biểu mẫu',
    icon: 'FileCog',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/luong-duyet',
    label: 'Luồng duyệt',
    icon: 'Workflow',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/mau-van-ban',
    label: 'Mẫu văn bản',
    icon: 'FileSignature',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/van-ban-da-cap',
    label: 'Văn bản đã cấp',
    icon: 'FileBadge',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/bao-cao',
    label: 'Báo cáo thống kê',
    icon: 'BarChart3',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/nguoi-dung',
    label: 'Người dùng',
    icon: 'Users',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/danh-muc',
    label: 'Danh mục',
    icon: 'FolderTree',
    roles: ['ADMIN'],
  },
  {
    to: '/quan-ly/nhat-ky',
    label: 'Nhật ký hệ thống',
    icon: 'ScrollText',
    roles: ['ADMIN'],
  },
]

export const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'PENDING_APPROVAL', label: 'Đang chờ duyệt' },
  { value: 'NEED_SUPPLEMENT', label: 'Cần bổ sung' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã rút' },
] as const

/** Biến dùng trong mẫu văn bản. */
export const TEMPLATE_VARIABLES = [
  { key: '{{ho_ten}}', label: 'Họ tên sinh viên' },
  { key: '{{mssv}}', label: 'Mã số sinh viên' },
  { key: '{{ngay_sinh}}', label: 'Ngày sinh' },
  { key: '{{lop}}', label: 'Lớp' },
  { key: '{{khoa}}', label: 'Khoa' },
  { key: '{{nganh}}', label: 'Ngành' },
  { key: '{{khoa_hoc}}', label: 'Khóa học' },
  { key: '{{so_van_ban}}', label: 'Số văn bản' },
  { key: '{{ngay_cap}}', label: 'Ngày cấp' },
  { key: '{{trich_yeu}}', label: 'Trích yếu nội dung' },
  { key: '{{ly_do}}', label: 'Lý do / nội dung đề nghị' },
  { key: '{{ten_truong}}', label: 'Tên trường' },
]

export const CHATBOT_SUGGESTIONS = [
  'Làm sao để xin giấy xác nhận sinh viên?',
  'Thời gian xử lý đơn xin hoãn thi là bao lâu?',
  'Cần giấy tờ gì khi xin bảo lưu kết quả học tập?',
  'Đơn xin cấp bảng điểm có mất phí không?',
  'Quy trình duyệt đơn gồm những cấp nào?',
]

export const PAGE_SIZE = 10
