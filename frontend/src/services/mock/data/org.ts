import type {
  Khoa,
  KhoaHoc,
  Lop,
  Nganh,
  PhongBan,
} from '@/types'

export type { Khoa, PhongBan, Nganh, Lop, KhoaHoc }

export const KHOA_HOC_LIST: KhoaHoc[] = [
  { id: 'kh_k18', ma: 'K18', ten: 'K18 (2020 - 2024)', namBatDau: 2020, namKetThuc: 2024 },
  { id: 'kh_k19', ma: 'K19', ten: 'K19 (2021 - 2025)', namBatDau: 2021, namKetThuc: 2025 },
  { id: 'kh_k20', ma: 'K20', ten: 'K20 (2022 - 2026)', namBatDau: 2022, namKetThuc: 2026 },
  { id: 'kh_k21', ma: 'K21', ten: 'K21 (2023 - 2027)', namBatDau: 2023, namKetThuc: 2027 },
]

export const KHOA_LIST: Khoa[] = [
  { id: 'k_cntt', ma: 'CNTT', ten: 'Khoa Công nghệ thông tin', vietTat: 'CNTT', truongKhoaId: 'tk001' },
  { id: 'k_kt', ma: 'KT', ten: 'Khoa Kinh tế - Quản trị kinh doanh', vietTat: 'KT-QTKD', truongKhoaId: 'tk002' },
  { id: 'k_nn', ma: 'NN', ten: 'Khoa Ngoại ngữ', vietTat: 'NN', truongKhoaId: 'tk003' },
  { id: 'k_sp', ma: 'SP', ten: 'Khoa Sư phạm', vietTat: 'SP', truongKhoaId: 'tk004' },
  { id: 'k_dn', ma: 'DN', ten: 'Khoa Điều dưỡng', vietTat: 'ĐD', truongKhoaId: 'tk005' },
  { id: 'k_ktcn', ma: 'KTCN', ten: 'Khoa Kỹ thuật - Công nghệ', vietTat: 'KT-CN', truongKhoaId: 'tk006' },
]

export const PHONG_BAN_LIST: PhongBan[] = [
  { id: 'p_pdt', ma: 'PDT', ten: 'Phòng Đào tạo', vietTat: 'P.ĐT', truongPhongId: 'pdt001' },
  { id: 'p_ctsv', ma: 'CTSV', ten: 'Phòng Công tác Sinh viên', vietTat: 'P.CTSV', truongPhongId: 'pdt002' },
  { id: 'p_khtc', ma: 'KHTC', ten: 'Phòng Kế hoạch - Tài chính', vietTat: 'P.KHTC' },
  { id: 'p_hcth', ma: 'HCTH', ten: 'Phòng Hành chính - Tổng hợp', vietTat: 'P.HCTH' },
  { id: 'tt_cntt', ma: 'TT-CNTT', ten: 'Trung tâm Công nghệ thông tin', vietTat: 'TT.CNTT' },
]

export const NGANH_LIST: Nganh[] = [
  { id: 'n_cntt', ma: '7480201', ten: 'Công nghệ thông tin', khoaId: 'k_cntt', khoaHocIds: ['kh_k18', 'kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_khmt', ma: '7480101', ten: 'Khoa học máy tính', khoaId: 'k_cntt', khoaHocIds: ['kh_k20', 'kh_k21'] },
  { id: 'n_kt', ma: '7340301', ten: 'Kế toán', khoaId: 'k_kt', khoaHocIds: ['kh_k18', 'kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_qtkd', ma: '7340101', ten: 'Quản trị kinh doanh', khoaId: 'k_kt', khoaHocIds: ['kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_tcnh', ma: '7340201', ten: 'Tài chính - Ngân hàng', khoaId: 'k_kt', khoaHocIds: ['kh_k20', 'kh_k21'] },
  { id: 'n_nna', ma: '7220201', ten: 'Ngôn ngữ Anh', khoaId: 'k_nn', khoaHocIds: ['kh_k18', 'kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_spth', ma: '7140202', ten: 'Giáo dục Tiểu học', khoaId: 'k_sp', khoaHocIds: ['kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_gdmn', ma: '7140201', ten: 'Giáo dục Mầm non', khoaId: 'k_sp', khoaHocIds: ['kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_dd', ma: '7720301', ten: 'Điều dưỡng', khoaId: 'k_dn', khoaHocIds: ['kh_k18', 'kh_k19', 'kh_k20', 'kh_k21'] },
  { id: 'n_dtd', ma: '7510302', ten: 'Công nghệ kỹ thuật điện - điện tử', khoaId: 'k_ktcn', khoaHocIds: ['kh_k19', 'kh_k20', 'kh_k21'] },
]

export const LOP_LIST: Lop[] = [
  { id: 'l_cntt1_k19', ma: 'K19-CNTT1', ten: 'K19 - Công nghệ thông tin 1', khoaId: 'k_cntt', nganhId: 'n_cntt', khoaHocId: 'kh_k19', coVanId: 'cv001', siSo: 42 },
  { id: 'l_cntt2_k19', ma: 'K19-CNTT2', ten: 'K19 - Công nghệ thông tin 2', khoaId: 'k_cntt', nganhId: 'n_cntt', khoaHocId: 'kh_k19', coVanId: 'cv001', siSo: 40 },
  { id: 'l_khmt1_k20', ma: 'K20-KHMT1', ten: 'K20 - Khoa học máy tính 1', khoaId: 'k_cntt', nganhId: 'n_khmt', khoaHocId: 'kh_k20', coVanId: 'cv002', siSo: 38 },
  { id: 'l_kt1_k19', ma: 'K19-KT1', ten: 'K19 - Kế toán 1', khoaId: 'k_kt', nganhId: 'n_kt', khoaHocId: 'kh_k19', coVanId: 'cv003', siSo: 45 },
  { id: 'l_qtkd1_k20', ma: 'K20-QTKD1', ten: 'K20 - Quản trị kinh doanh 1', khoaId: 'k_kt', nganhId: 'n_qtkd', khoaHocId: 'kh_k20', coVanId: 'cv003', siSo: 44 },
  { id: 'l_nna1_k19', ma: 'K19-NNA1', ten: 'K19 - Ngôn ngữ Anh 1', khoaId: 'k_nn', nganhId: 'n_nna', khoaHocId: 'kh_k19', coVanId: 'cv004', siSo: 36 },
  { id: 'l_spth1_k20', ma: 'K20-SPTH1', ten: 'K20 - Giáo dục Tiểu học 1', khoaId: 'k_sp', nganhId: 'n_spth', khoaHocId: 'kh_k20', coVanId: 'cv005', siSo: 39 },
  { id: 'l_dd1_k19', ma: 'K19-DD1', ten: 'K19 - Điều dưỡng 1', khoaId: 'k_dn', nganhId: 'n_dd', khoaHocId: 'kh_k19', coVanId: 'cv006', siSo: 48 },
  { id: 'l_dtd1_k20', ma: 'K20-DTD1', ten: 'K20 - CN kỹ thuật điện - điện tử 1', khoaId: 'k_ktcn', nganhId: 'n_dtd', khoaHocId: 'kh_k20', coVanId: 'cv002', siSo: 37 },
]

export function findKhoa(id?: string) {
  return KHOA_LIST.find((k) => k.id === id)
}
export function findLop(id?: string) {
  return LOP_LIST.find((l) => l.id === id)
}
export function findNganh(id?: string) {
  return NGANH_LIST.find((n) => n.id === id)
}
export function findKhoaHoc(id?: string) {
  return KHOA_HOC_LIST.find((k) => k.id === id)
}
