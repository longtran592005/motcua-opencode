export interface Khoa {
  id: string
  ma: string
  ten: string
  vietTat: string
  truongKhoaId: string
}

export interface PhongBan {
  id: string
  ma: string
  ten: string
  vietTat: string
  truongPhongId?: string
}

export interface Nganh {
  id: string
  ma: string
  ten: string
  khoaId: string
  khoaHocIds: string[]
}

export interface Lop {
  id: string
  ma: string
  ten: string
  khoaId: string
  nganhId: string
  khoaHocId: string
  coVanId: string
  siSo: number
}

export interface KhoaHoc {
  id: string
  ma: string
  ten: string
  namBatDau: number
  namKetThuc: number
}
