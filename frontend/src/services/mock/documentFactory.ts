import type { Application, Signature, SignedDocument } from '@/types'
import { formatDate } from '@/lib/formatters'
import { renderTemplate } from '@/lib/template'
import { quickHash } from '@/lib/utils'
import { findKhoaHoc, findLop, findNganh } from './data/org'
import { findRequestType } from './data/requestTypes'
import { findTemplate } from './data/templates'
import { findUserById } from './data/users'

export const TRICH_YEU: Record<string, string> = {
  rt_gxn: 'Về việc xác nhận sinh viên đang theo học tại Trường Đại học Thái Bình',
  rt_dbt: 'Về việc cấp bảng điểm học tập cho sinh viên',
  rt_dht: 'Về việc chấp thuận hoãn thi kết thúc học phần',
  rt_dbl: 'Về việc cho phép sinh viên bảo lưu kết quả học tập',
  rt_dcn: 'Về việc chấp thuận cho sinh viên chuyển ngành học',
}

export const LOAI_VAN_BAN: Record<string, string> = {
  rt_gxn: 'Giấy xác nhận sinh viên',
  rt_dbt: 'Bảng điểm',
  rt_dht: 'Quyết định hoãn thi',
  rt_dbl: 'Quyết định bảo lưu',
  rt_dcn: 'Quyết định chuyển ngành',
}

const MUC_DICH: Record<string, string> = {
  VAY_VON: 'vay vốn tại ngân hàng',
  XIN_VIEC: 'hoàn thiện hồ sơ xin việc làm',
  THUC_TAP: 'đăng ký thực tập tại doanh nghiệp',
  NVQS: 'làm hồ sơ tạm hoãn nghĩa vụ quân sự',
  KHAC: 'mục đích cá nhân',
}

export function lyDoText(app: Application): string {
  const rt = findRequestType(app.requestTypeId)
  const d = app.duLieu
  switch (rt?.id) {
    case 'rt_gxn':
      return `${MUC_DICH[String(d.muc_dich)] ?? 'mục đích cá nhân'} — nơi nhận: ${d.noi_nhan ?? '—'}`
    case 'rt_dbt':
      return `cấp bảng điểm ${d.loai_bang_diem === 'THEO_HK' ? `theo học kỳ ${d.hoc_ky ?? ''}` : 'toàn khóa'} theo đề nghị của sinh viên`
    case 'rt_dht':
      return String(d.ly_do ?? '—')
    case 'rt_dbl':
      return String(d.chi_tiet_ly_do ?? d.thoi_han ?? '—')
    case 'rt_dcn':
      return `Sinh viên có điểm trung bình tích lũy ${d.diem_trung_binh ?? '—'}, đáp ứng điều kiện xét chuyển ngành theo quy chế đào tạo hiện hành`
    default:
      return '—'
  }
}

export function trichYeuNgan(app: Application): string {
  const rt = findRequestType(app.requestTypeId)
  return rt ? (TRICH_YEU[rt.id] ?? rt.ten) : 'Văn bản'
}

/**
 * Sinh văn bản đã ký cho một hồ sơ đã hoàn thành.
 * `maBamSha256` là mã băm SHA-256 của nội dung văn bản và dùng làm gốc cho chữ ký các cấp.
 */
export function buildSignedDocument(
  app: Application,
  signatures: Signature[],
  soVanBan: string,
  ngayCap: string,
  id: string,
): SignedDocument {
  const rt = findRequestType(app.requestTypeId)!
  const tpl = findTemplate(rt.templateId)!
  const lop = findLop(findUserById(app.sinhVienId)?.lopId)
  const values: Record<string, string> = {
    ho_ten: app.sinhVien.hoTen,
    mssv: app.sinhVien.maSo,
    ngay_sinh: formatDate(findUserById(app.sinhVienId)?.ngaySinh ?? undefined),
    lop: app.sinhVien.lop,
    khoa: app.sinhVien.khoa,
    nganh: findNganh(lop?.nganhId)?.ten ?? app.sinhVien.nganh,
    khoa_hoc: findKhoaHoc(lop?.khoaHocId)?.ten ?? app.sinhVien.khoaHoc,
    so_van_ban: soVanBan,
    ngay_cap: formatDate(ngayCap),
    trich_yeu: trichYeuNgan(app),
    ly_do: lyDoText(app),
    ten_truong: 'Trường Đại học Thái Bình',
    het_han: formatDate(new Date(new Date(ngayCap).getTime() + 180 * 86_400_000)),
  }

  const noiDung = renderTemplate(tpl.noiDung, values)
  const maBamSha256 = quickHash(`${soVanBan}|${noiDung}`)

  return {
    id,
    soVanBan,
    trichYeu: trichYeuNgan(app),
    loaiVanBan: LOAI_VAN_BAN[rt.id] ?? rt.ten,
    templateId: tpl.id,
    applicationId: app.id,
    maHoSo: app.maHoSo,
    sinhVien: {
      hoTen: app.sinhVien.hoTen,
      mssv: app.sinhVien.maSo,
      lop: app.sinhVien.lop,
      khoa: app.sinhVien.khoa,
      nganh: app.sinhVien.nganh,
      khoaHoc: app.sinhVien.khoaHoc,
    },
    noiDung,
    ngayCap,
    tokenXacThuc: app.tokenXacThuc ?? quickHash(`${app.id}-token`).slice(0, 24),
    maBamSha256,
    chuKy: signatures
      .slice()
      .sort((a, b) => a.buocOrder - b.buocOrder)
      .map((s) => {
        const bam = quickHash(`${s.id}|${maBamSha256}|${s.thoiDiemKy}`)
        return {
          ...s,
          vanBanId: id,
          maBam: bam,
          maChuKy: bam.slice(0, 8).toUpperCase(),
        }
      }),
    trangThai: 'VALID',
    chuKyConHieuLuc: true,
    luotTai: [],
  }
}
