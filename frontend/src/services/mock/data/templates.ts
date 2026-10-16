import type { DocumentTemplate } from '@/types'

export const TEMPLATE_LIST: DocumentTemplate[] = [
  {
    id: 'tpl_gxn',
    ma: 'MVT-GXN',
    ten: 'Giấy xác nhận sinh viên',
    loaiVanBan: 'Giấy xác nhận sinh viên',
    hoatDong: true,
    capNhatLuc: '2026-02-11T08:20:00+07:00',
    noiDung: `Trường Đại học Thái Bình xác nhận:

Sinh viên {{ho_ten}}, mã số sinh viên {{mssv}}, ngày sinh {{ngay_sinh}}, hiện đang là sinh viên lớp {{lop}}, ngành {{nganh}}, {{khoa}}, khóa học {{khoa_hoc}} của Trường Đại học Thái Bình.

Sinh viên có tên trên đang trong thời gian học tập tại Trường, không thuộc diện bị kỷ luật hay buộc thôi học tại thời điểm cấp giấy xác nhận này.

Giấy xác nhận được cấp theo đề nghị của sinh viên, dùng cho mục đích: {{ly_do}}.

Giấy xác nhận có giá trị đến hết ngày {{het_han}}.`,
  },
  {
    id: 'tpl_dbt',
    ma: 'MVT-DBT',
    ten: 'Bảng điểm học tập',
    loaiVanBan: 'Bảng điểm',
    hoatDong: true,
    capNhatLuc: '2026-02-10T14:05:00+07:00',
    noiDung: `Trường Đại học Thái Bình xác nhận bảng điểm học tập của sinh viên:

Họ và tên: {{ho_ten}}
Mã số sinh viên: {{mssv}}
Ngày sinh: {{ngay_sinh}}
Lớp: {{lop}} — Ngành: {{nganh}}
Khoa: {{khoa}} — Khóa học: {{khoa_hoc}}

Kết quả học tập tích lũy được ghi nhận theo dữ liệu của Phòng Đào tạo tại thời điểm cấp bảng điểm. Bảng điểm này được cấp theo đề nghị của sinh viên cho mục đích {{ly_do}}.

Số văn bản: {{so_van_ban}} — Ngày cấp: {{ngay_cap}}.`,
  },
  {
    id: 'tpl_dht',
    ma: 'MVT-DHT',
    ten: 'Quyết định chấp thuận hoãn thi',
    loaiVanBan: 'Quyết định hoãn thi',
    hoatDong: true,
    capNhatLuc: '2026-02-09T09:40:00+07:00',
    noiDung: `Trường Đại học Thái Bình chấp thuận đề nghị hoãn thi kết thúc học phần của sinh viên:

Họ và tên: {{ho_ten}} — MSSV: {{mssv}}
Lớp: {{lop}} — Khoa: {{khoa}} — Khóa học: {{khoa_hoc}}

Nội dung đề nghị: {{trich_yeu}}

Lý do được chấp thuận: {{ly_do}}

Sinh viên có trách nhiệm theo dõi lịch thi bù do Phòng Đào tạo thông báo và tham gia thi bù đúng thời gian quy định.`,
  },
  {
    id: 'tpl_dbl',
    ma: 'MVT-DBL',
    ten: 'Quyết định bảo lưu kết quả học tập',
    loaiVanBan: 'Quyết định bảo lưu',
    hoatDong: true,
    capNhatLuc: '2026-02-08T16:30:00+07:00',
    noiDung: `Trường Đại học Thái Bình quyết định cho phép sinh viên tạm dừng học tập và bảo lưu kết quả học tập:

Họ và tên: {{ho_ten}} — MSSV: {{mssv}}
Lớp: {{lop}} — Ngành: {{nganh}} — Khoa: {{khoa}}

Thời gian bảo lưu: {{ly_do}}
Kết quả học tập đã tích lũy được bảo lưu theo quy chế đào tạo hiện hành.

Sinh viên có trách nhiệm làm thủ tục trở lại học tập trước khi hết thời hạn bảo lưu.`,
  },
  {
    id: 'tpl_dcn',
    ma: 'MVT-DCN',
    ten: 'Quyết định chuyển ngành',
    loaiVanBan: 'Quyết định chuyển ngành',
    hoatDong: true,
    capNhatLuc: '2026-02-07T10:15:00+07:00',
    noiDung: `Trường Đại học Thái Bình chấp thuận cho sinh viên chuyển ngành học:

Họ và tên: {{ho_ten}} — MSSV: {{mssv}}
Lớp hiện tại: {{lop}} — Khoa: {{khoa}} — Khóa học: {{khoa_hoc}}

Nội dung: {{trich_yeu}}
Căn cứ xem xét: {{ly_do}}

Sinh viên được xếp vào ngành mới kể từ học kỳ kế tiếp và có trách nhiệm hoàn thiện các học phần còn thiếu theo chương trình đào tạo của ngành mới.`,
  },
]

export function findTemplate(id: string) {
  return TEMPLATE_LIST.find((t) => t.id === id)
}
