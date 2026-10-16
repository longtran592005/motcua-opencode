import type { Role } from '@/types'

export interface Delegation {
  id: string
  nguoiUyQuyenId: string
  nguoiUyQuyenTen: string
  nguoiNhanId: string
  nguoiNhanTen: string
  vaiTro: Role
  tuNgay: string
  denNgay: string
  lyDo: string
  hieuLuc: boolean
  taoLuc: string
}
