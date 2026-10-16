import type { Attachment, FormField, RequestType, User } from '@/types'
import type { Rng } from './rng'

const GHI_CHU_POOL = [
  'Em xin cảm ơn Thầy/Cô đã quan tâm giải quyết.',
  'Em cần gấp trước ngày 20 để kịp nộp cho cơ quan tiếp nhận.',
  'Mọi thông tin trong đơn em đã kê khai đầy đủ và chính xác.',
  'Nếu cần bổ sung gì thêm, mong Thầy/Cô liên hệ qua số điện thoại đã đăng ký.',
]

const NOI_NHAN_POOL = [
  'Ngân hàng Nông nghiệp và Phát triển Nông thôn - Chi nhánh Thái Bình',
  'Công ty Cổ phần Công nghệ Sông Hồng',
  'Phòng Tổ chức - Hành chính, UBND xã Đông Hưng',
  'Công ty TNHH Điện tử Bảo Long, Khu công nghiệp Phúc Khánh',
]

const HOAN_THI_MON = [
  ['Lập trình hướng đối tượng', 'INT2204'],
  ['Cấu trúc dữ liệu và giải thuật', 'INT2203'],
  ['Cơ sở dữ liệu', 'INT2211'],
  ['Kế toán tài chính', 'ACC2101'],
  ['Tâm lý học lứa tuổi', 'PSY1102'],
  ['Giải phẫu sinh lý', 'NUR1105'],
  ['Ngữ âm - Âm vị học tiếng Anh', 'ENG2104'],
]

const LY_DO_HOAN_THI = [
  'Do sức khỏe không đảm bảo, em phải nhập viện điều trị theo chỉ định của bác sĩ.',
  'Gia đình có việc hiếu đột xuất nên em không thể có mặt đúng ca thi.',
  'Em bị tai nạn giao thông trước ngày thi 02 ngày, hiện đang điều trị tại nhà.',
  'Trong thời gian diễn ra kỳ thi, em đang thực hiện nghĩa vụ phục vụ tại đơn vị.',
]

const LY_DO_BAO_LUU = [
  'Em bị bệnh mãn tính cần điều trị dài ngày, xin tạm dừng việc học để ổn định sức khỏe.',
  'Em nhập ngũ theo lệnh gọi của Ban Chỉ huy Quân sự huyện.',
  'Hoàn cảnh gia đình khó khăn, em cần đi làm thêm một thời gian để trang trải chi phí học tập.',
  'Em tham gia chương trình trao đổi học thuật kéo dài 01 năm tại đối tác nước ngoài.',
]

const LY_DO_CHUYEN_NGANH = [
  'Sau khi học các học phần cơ sở, em nhận thấy bản thân phù hợp hơn với ngành mong muốn và đã tìm hiểu kỹ chương trình đào tạo.',
  'Em mong muốn chuyển ngành để phát huy thế mạnh của bản thân và phù hợp với định hướng nghề nghiệp của gia đình.',
  'Nguyện vọng của em là được học ngành yêu thích đã đăng ký từ đầu nhưng chưa trúng tuyển ở nguyện vọng 1.',
]

const LY_DO_DBT = [
  'hoàn thiện hồ sơ ứng tuyển vị trí thực tập sinh tại doanh nghiệp',
  'bổ sung hồ sơ xét học bổng khuyến khích học tập của học kỳ',
  'phục vụ công tác xét tuyển lao động tại địa phương',
  'đăng ký du học theo chương trình liên kết của Trường',
]

/** Sinh dữ liệu biểu mẫu dựa trên cấu hình trường và thông tin sinh viên. */
export function buildDuLieu(
  rt: RequestType,
  sv: User,
  rng: Rng,
  extra: { lyDoTuChoi?: string } = {},
): Record<string, unknown> {
  const base: Record<string, unknown> = {}
  const common: Record<string, unknown> = {
    ho_ten: sv.hoTen,
    mssv: sv.maSo,
    ngay_sinh: sv.ngaySinh ?? '2003-01-01',
    lop: sv.lopTen ?? '',
    khoa: sv.donViTen ?? '',
    nganh: sv.nganhTen ?? '',
    khoa_hoc: sv.khoaHoc ?? '',
  }
  Object.assign(base, common)

  switch (rt.id) {
    case 'rt_gxn': {
      base.muc_dich = rng.pick(['VAY_VON', 'XIN_VIEC', 'THUC_TAP', 'NVQS', 'KHAC'])
      base.noi_nhan = rng.pick(NOI_NHAN_POOL)
      base.so_ban = rng.int(1, 3)
      base.ghi_chu = rng.pick(GHI_CHU_POOL)
      break
    }
    case 'rt_dbt': {
      base.loai_bang_diem = rng.bool(0.7) ? 'TOAN_KHOA' : 'THEO_HK'
      base.hoc_ky = 'HK1-2025-2026'
      base.ngon_ngu = rng.bool(0.85) ? 'VI' : 'EN'
      base.so_ban = rng.int(1, 3)
      base.ly_do = rng.pick(LY_DO_DBT)
      base.hinh_thuc_nhan = rng.bool(0.75) ? 'TRUC_TIEP' : 'BUU_DIEN'
      base.dia_chi_nhan = base.hinh_thuc_nhan === 'BUU_DIEN' ? 'Xóm 4, xã Đông Hưng, tỉnh Hưng Yên' : ''
      break
    }
    case 'rt_dht': {
      const [mon, ma] = rng.pick(HOAN_THI_MON)
      base.ten_hoc_phan = mon
      base.ma_hoc_phan = ma
      base.ngay_thi = extra.lyDoTuChoi ? '2026-01-12' : '2026-01-12'
      base.ca_thi = rng.pick(['CA1', 'CA2', 'CA3', 'CA4'])
      base.hoc_ky = 'HK1-2025-2026'
      base.ly_do = rng.pick(LY_DO_HOAN_THI)
      break
    }
    case 'rt_dbl': {
      base.hoc_ky_bao_luu = 'HK2-2025-2026'
      base.thoi_han = rng.pick(['1_HK', '1_NAM', '2_NAM'])
      base.nhom_ly_do = rng.pick(['SUC_KHOE', 'NVQS', 'CA_NHAN', 'THUC_TAP'])
      base.thoi_diem_bao_luu = '2026-02-16'
      base.chi_tiet_ly_do = rng.pick(LY_DO_BAO_LUU)
      base.cam_ket = true
      break
    }
    case 'rt_dcn': {
      base.nganh_mong_muon = rng.pick(['7480201', '7480101', '7340101', '7220201'])
      base.diem_trung_binh = Number(rng.float(2.4, 3.6).toFixed(2))
      base.hoc_ky_chuyen = 'HK2-2025-2026'
      base.ly_do = rng.pick(LY_DO_CHUYEN_NGANH)
      break
    }
    default:
      break
  }

  // Đảm bảo mọi trường trong cấu hình đều có giá trị.
  rt.formFields.forEach((f: FormField) => {
    if (base[f.key] === undefined) {
      base[f.key] = f.defaultValue ?? (f.type === 'checkbox' ? false : '')
    }
  })

  return base
}

const FILE_KIND: Record<string, { ten: string; loai: string; kichThuoc: number }> = {
  cccd: { ten: 'CCCD-2-mat.jpg', loai: 'image/jpeg', kichThuoc: 742_000 },
  minh_chung: { ten: 'Giay-kham-benh.pdf', loai: 'application/pdf', kichThuoc: 356_000 },
  don_phu_huynh: { ten: 'Don-co-chu-ky-phu-huynh.pdf', loai: 'application/pdf', kichThuoc: 214_000 },
  bang_diem: { ten: 'Bang-diem-tich-luy.pdf', loai: 'application/pdf', kichThuoc: 188_000 },
}

/** Sinh danh sách tệp đính kèm theo yêu cầu giấy tờ của loại đơn. */
export function buildAttachments(
  rt: RequestType,
  rng: Rng,
  luc: string,
): Attachment[] {
  const out: Attachment[] = []
  rt.giayTo.forEach((gt, i) => {
    if (gt.batBuoc || rng.bool(0.4)) {
      const kind = FILE_KIND[gt.key] ?? FILE_KIND.minh_chung
      out.push({
        id: `att_${rt.ma.toLowerCase()}_${i}_${Math.round(rng.next() * 1e6)}`,
        ten: kind.ten,
        loai: kind.loai,
        kichThuoc: kind.kichThuoc,
        url: `/mock-files/${gt.key}-${i + 1}.${kind.ten.split('.').pop()}`,
        uploadedAt: luc,
        requirementKey: gt.key,
      })
    }
  })
  return out
}

/** Sinh thêm tệp không bắt buộc do sinh viên tự tải lên. */
export function buildExtraAttachments(rng: Rng, luc: string): Attachment[] {
  if (!rng.bool(0.35)) return []
  const ten = rng.pick(['Anh-bang-diem-hoc-ky.jpg', 'Giay-xac-nhan-cua-dia-phuong.pdf'])
  const isPdf = ten.endsWith('.pdf')
  return [
    {
      id: `att_extra_${Math.round(rng.next() * 1e6)}`,
      ten,
      loai: isPdf ? 'application/pdf' : 'image/jpeg',
      kichThuoc: isPdf ? 268_000 : 512_000,
      url: `/mock-files/${ten}`,
      uploadedAt: luc,
    },
  ]
}
