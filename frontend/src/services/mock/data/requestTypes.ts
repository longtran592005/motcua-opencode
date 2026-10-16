import type { FormField, RequestType } from '@/types'

/** Nhóm trường thông tin sinh viên tự điền, chỉ đọc. */
function sinhVienFields(): FormField[] {
  return [
    { id: 'f_ho_ten', key: 'ho_ten', label: 'Họ và tên', type: 'text', required: true, readOnly: true, order: 1, width: 'half' },
    { id: 'f_mssv', key: 'mssv', label: 'Mã số sinh viên', type: 'text', required: true, readOnly: true, order: 2, width: 'half' },
    { id: 'f_ngay_sinh', key: 'ngay_sinh', label: 'Ngày sinh', type: 'date', required: true, readOnly: true, order: 3, width: 'half' },
    { id: 'f_lop', key: 'lop', label: 'Lớp', type: 'text', required: true, readOnly: true, order: 4, width: 'half' },
    { id: 'f_khoa', key: 'khoa', label: 'Khoa', type: 'text', required: true, readOnly: true, order: 5, width: 'half' },
    { id: 'f_nganh', key: 'nganh', label: 'Ngành học', type: 'text', required: true, readOnly: true, order: 6, width: 'half' },
    { id: 'f_khoa_hoc', key: 'khoa_hoc', label: 'Khóa học', type: 'text', required: true, readOnly: true, order: 7, width: 'half' },
  ]
}

const HK_OPTIONS = [
  { label: 'Học kỳ 1, năm học 2025 - 2026', value: 'HK1-2025-2026' },
  { label: 'Học kỳ 2, năm học 2025 - 2026', value: 'HK2-2025-2026' },
  { label: 'Học kỳ 1, năm học 2026 - 2027', value: 'HK1-2026-2027' },
]

export const REQUEST_TYPE_LIST: RequestType[] = [
  {
    id: 'rt_gxn',
    ma: 'GXN',
    ten: 'Giấy xác nhận sinh viên',
    nhom: 'Giấy xác nhận & Bảng điểm',
    moTa: 'Xác nhận đang là sinh viên của Trường Đại học Thái Bình, phục vụ vay vốn, xin việc, thực tập.',
    icon: 'FileCheck2',
    mau: 'brand',
    workflowId: 'wf_1cap',
    templateId: 'tpl_gxn',
    soNgayXuLy: 2,
    lePhi: 0,
    hoatDong: true,
    soLuotNop: 412,
    giayTo: [],
    formFields: [
      ...sinhVienFields(),
      {
        id: 'f_gxn_muc_dich', key: 'muc_dich', label: 'Mục đích xác nhận', type: 'select', required: true, order: 10, width: 'half',
        options: [
          { label: 'Vay vốn ngân hàng / Quỹ tín dụng', value: 'VAY_VON' },
          { label: 'Xin việc làm', value: 'XIN_VIEC' },
          { label: 'Đăng ký thực tập', value: 'THUC_TAP' },
          { label: 'Tạm hoãn nghĩa vụ quân sự', value: 'NVQS' },
          { label: 'Mục đích khác', value: 'KHAC' },
        ],
      },
      { id: 'f_gxn_noi_nhan', key: 'noi_nhan', label: 'Nơi nhận giấy xác nhận', type: 'text', required: true, order: 11, width: 'half', placeholder: 'Ví dụ: Ngân hàng Nông nghiệp - CN Thái Bình' },
      { id: 'f_gxn_so_ban', key: 'so_ban', label: 'Số bản cần cấp', type: 'number', required: true, order: 12, width: 'half', min: 1, max: 5, defaultValue: 1 },
      { id: 'f_gxn_ghi_chu', key: 'ghi_chu', label: 'Ghi chú thêm', type: 'textarea', required: false, order: 13, rows: 3, width: 'full', placeholder: 'Thông tin bổ sung cho cán bộ xử lý (nếu có)' },
    ],
  },
  {
    id: 'rt_dbt',
    ma: 'DBT',
    ten: 'Đơn xin cấp bảng điểm',
    nhom: 'Giấy xác nhận & Bảng điểm',
    moTa: 'Đề nghị cấp bảng điểm học tập toàn khóa hoặc theo học kỳ, có xác nhận của Phòng Đào tạo.',
    icon: 'ClipboardList',
    mau: 'brand',
    workflowId: 'wf_2cap',
    templateId: 'tpl_dbt',
    soNgayXuLy: 5,
    lePhi: 30000,
    hoatDong: true,
    soLuotNop: 268,
    giayTo: [
      { key: 'cccd', label: 'Ảnh Căn cước công dân (2 mặt)', batBuoc: true, helpText: 'Chụp rõ, không bị lóa, kích thước tối đa 5MB.' },
    ],
    formFields: [
      ...sinhVienFields(),
      {
        id: 'f_dbt_loai', key: 'loai_bang_diem', label: 'Loại bảng điểm', type: 'radio', required: true, order: 10, width: 'full',
        options: [
          { label: 'Bảng điểm toàn khóa', value: 'TOAN_KHOA' },
          { label: 'Bảng điểm theo học kỳ', value: 'THEO_HK' },
        ],
      },
      { id: 'f_dbt_hk', key: 'hoc_ky', label: 'Học kỳ (nếu chọn theo học kỳ)', type: 'select', required: false, order: 11, width: 'half', options: HK_OPTIONS },
      { id: 'f_dbt_ngon_ngu', key: 'ngon_ngu', label: 'Ngôn ngữ bảng điểm', type: 'select', required: true, order: 12, width: 'half',
        options: [
          { label: 'Tiếng Việt', value: 'VI' },
          { label: 'Tiếng Anh', value: 'EN' },
        ] },
      { id: 'f_dbt_so_ban', key: 'so_ban', label: 'Số bản cần cấp', type: 'number', required: true, order: 13, width: 'half', min: 1, max: 10, defaultValue: 1 },
      { id: 'f_dbt_hinh_thuc', key: 'hinh_thuc_nhan', label: 'Hình thức nhận', type: 'select', required: true, order: 14, width: 'half',
        options: [
          { label: 'Nhận trực tiếp tại Phòng Đào tạo', value: 'TRUC_TIEP' },
          { label: 'Gửi qua bưu điện', value: 'BUU_DIEN' },
        ] },
      { id: 'f_dbt_dia_chi', key: 'dia_chi_nhan', label: 'Địa chỉ nhận (nếu gửi bưu điện)', type: 'textarea', required: false, order: 15, rows: 2, width: 'full' },
    ],
  },
  {
    id: 'rt_dht',
    ma: 'DHT',
    ten: 'Đơn xin hoãn thi',
    nhom: 'Học vụ & Thi cử',
    moTa: 'Xin hoãn thi kết thúc học phần vì lý do chính đáng, có minh chứng kèm theo.',
    icon: 'CalendarX2',
    mau: 'amber',
    workflowId: 'wf_3cap',
    templateId: 'tpl_dht',
    soNgayXuLy: 4,
    lePhi: 0,
    hoatDong: true,
    soLuotNop: 176,
    giayTo: [
      { key: 'minh_chung', label: 'Giấy tờ minh chứng lý do hoãn thi', batBuoc: true, helpText: 'Giấy khám bệnh, giấy xác nhận của cơ quan, hoặc tài liệu liên quan.' },
    ],
    formFields: [
      ...sinhVienFields(),
      { id: 'f_dht_mon', key: 'ten_hoc_phan', label: 'Tên học phần xin hoãn thi', type: 'text', required: true, order: 10, width: 'half', placeholder: 'Ví dụ: Lập trình hướng đối tượng' },
      { id: 'f_dht_ma_hp', key: 'ma_hoc_phan', label: 'Mã học phần', type: 'text', required: true, order: 11, width: 'half', placeholder: 'Ví dụ: INT2204' },
      { id: 'f_dht_ngay_thi', key: 'ngay_thi', label: 'Ngày thi dự kiến', type: 'date', required: true, order: 12, width: 'half' },
      { id: 'f_dht_ca_thi', key: 'ca_thi', label: 'Ca thi', type: 'select', required: true, order: 13, width: 'half',
        options: [
          { label: 'Ca 1 (07:00 - 09:00)', value: 'CA1' },
          { label: 'Ca 2 (09:30 - 11:30)', value: 'CA2' },
          { label: 'Ca 3 (13:30 - 15:30)', value: 'CA3' },
          { label: 'Ca 4 (15:45 - 17:45)', value: 'CA4' },
        ] },
      { id: 'f_dht_hoc_ky', key: 'hoc_ky', label: 'Học kỳ', type: 'select', required: true, order: 14, width: 'half', options: HK_OPTIONS },
      { id: 'f_dht_ly_do', key: 'ly_do', label: 'Lý do xin hoãn thi', type: 'textarea', required: true, order: 15, rows: 4, width: 'full', placeholder: 'Trình bày rõ lý do và nguyện vọng thi bù.' },
    ],
  },
  {
    id: 'rt_dbl',
    ma: 'DBL',
    ten: 'Đơn xin bảo lưu kết quả học tập',
    nhom: 'Học vụ & Thi cử',
    moTa: 'Tạm dừng học tập trong một khoảng thời gian và bảo lưu kết quả các học phần đã tích lũy.',
    icon: 'PauseCircle',
    mau: 'violet',
    workflowId: 'wf_2cap',
    templateId: 'tpl_dbl',
    soNgayXuLy: 7,
    lePhi: 0,
    hoatDong: true,
    soLuotNop: 94,
    giayTo: [
      { key: 'minh_chung', label: 'Giấy tờ minh chứng (giấy khám bệnh, giấy gọi nhập ngũ...)', batBuoc: true },
      { key: 'don_phu_huynh', label: 'Đơn có chữ ký của phụ huynh', batBuoc: false },
    ],
    formFields: [
      ...sinhVienFields(),
      {
        id: 'f_dbl_hk', key: 'hoc_ky_bao_luu', label: 'Học kỳ bắt đầu bảo lưu', type: 'select', required: true, order: 10, width: 'half',
        options: HK_OPTIONS,
      },
      { id: 'f_dbl_thoi_han', key: 'thoi_han', label: 'Thời hạn bảo lưu', type: 'select', required: true, order: 11, width: 'half',
        options: [
          { label: '01 học kỳ', value: '1_HK' },
          { label: '01 năm học', value: '1_NAM' },
          { label: '02 năm học', value: '2_NAM' },
        ] },
      { id: 'f_dbl_ly_do', key: 'nhom_ly_do', label: 'Nhóm lý do', type: 'select', required: true, order: 12, width: 'half',
        options: [
          { label: 'Lý do sức khỏe', value: 'SUC_KHOE' },
          { label: 'Thực hiện nghĩa vụ quân sự', value: 'NVQS' },
          { label: 'Lý do cá nhân / gia đình', value: 'CA_NHAN' },
          { label: 'Đi thực tập, trao đổi dài hạn', value: 'THUC_TAP' },
        ] },
      { id: 'f_dbl_thoi_diem', key: 'thoi_diem_bao_luu', label: 'Thời điểm bắt đầu bảo lưu', type: 'date', required: true, order: 13, width: 'half' },
      { id: 'f_dbl_chi_tiet', key: 'chi_tiet_ly_do', label: 'Trình bày chi tiết lý do', type: 'textarea', required: true, order: 14, rows: 4, width: 'full' },
      { id: 'f_dbl_cam_ket', key: 'cam_ket', label: 'Tôi cam kết thông tin trên là đúng sự thật và sẽ làm thủ tục trở lại học đúng thời hạn', type: 'checkbox', required: true, order: 15, width: 'full', options: [{ label: 'Đồng ý', value: 'CO' }] },
    ],
  },
  {
    id: 'rt_dcn',
    ma: 'DCN',
    ten: 'Đơn xin chuyển ngành',
    nhom: 'Nguyện vọng & Chuyển ngành',
    moTa: 'Đề nghị chuyển sang ngành học khác trong cùng trường, xét theo quy chế đào tạo hiện hành.',
    icon: 'ArrowLeftRight',
    mau: 'rose',
    workflowId: 'wf_3cap',
    templateId: 'tpl_dcn',
    soNgayXuLy: 10,
    lePhi: 100000,
    hoatDong: true,
    soLuotNop: 57,
    giayTo: [
      { key: 'bang_diem', label: 'Bảng điểm học tập đã tích lũy', batBuoc: true },
      { key: 'cccd', label: 'Ảnh Căn cước công dân (2 mặt)', batBuoc: true },
    ],
    formFields: [
      ...sinhVienFields(),
      { id: 'f_dcn_nganh_muon', key: 'nganh_mong_muon', label: 'Ngành mong muốn chuyển đến', type: 'select', required: true, order: 10, width: 'half',
        options: [
          { label: 'Công nghệ thông tin', value: '7480201' },
          { label: 'Khoa học máy tính', value: '7480101' },
          { label: 'Kế toán', value: '7340301' },
          { label: 'Quản trị kinh doanh', value: '7340101' },
          { label: 'Ngôn ngữ Anh', value: '7220201' },
          { label: 'Công nghệ kỹ thuật điện - điện tử', value: '7510302' },
        ] },
      { id: 'f_dcn_diem', key: 'diem_trung_binh', label: 'Điểm trung bình tích lũy hiện tại', type: 'number', required: true, order: 11, width: 'half', min: 0, max: 4 },
      { id: 'f_dcn_hk', key: 'hoc_ky_chuyen', label: 'Học kỳ mong muốn chuyển', type: 'select', required: true, order: 12, width: 'half', options: HK_OPTIONS },
      { id: 'f_dcn_ly_do', key: 'ly_do', label: 'Lý do xin chuyển ngành', type: 'textarea', required: true, order: 13, rows: 5, width: 'full' },
    ],
  },
]

export function findRequestType(id: string) {
  return REQUEST_TYPE_LIST.find((r) => r.id === id)
}
