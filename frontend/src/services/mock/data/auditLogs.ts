import type { AuditLog, Role } from '@/types'
import { APPLICATION_LIST } from './applications'
import { createRng } from './rng'

interface Entry {
  nguoi: string
  role: Role
  hanhDong: string
  doiTuong: string
  truoc?: string
  sau?: string
  gioTruoc: number
}

const ENTRIES: Entry[] = [
  { nguoi: 'pdt001', role: 'PHONG_DAO_TAO', hanhDong: 'ISSUE_DOCUMENT', doiTuong: 'Văn bản', truoc: 'Bản nháp', sau: 'Đã phát hành', gioTruoc: 4 },
  { nguoi: 'pdt001', role: 'PHONG_DAO_TAO', hanhDong: 'APPROVE_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Đang chờ duyệt', sau: 'Hoàn thành', gioTruoc: 5 },
  { nguoi: 'tk001', role: 'TRUONG_KHOA', hanhDong: 'APPROVE_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Đang chờ duyệt cấp khoa', sau: 'Chuyển Phòng Đào tạo', gioTruoc: 9 },
  { nguoi: 'cv001', role: 'CO_VAN', hanhDong: 'APPROVE_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Đã nộp', sau: 'Chuyển Trưởng khoa', gioTruoc: 11 },
  { nguoi: 'cv001', role: 'CO_VAN', hanhDong: 'REQUEST_SUPPLEMENT', doiTuong: 'Hồ sơ một cửa', truoc: 'Đang chờ duyệt', sau: 'Cần bổ sung', gioTruoc: 13 },
  { nguoi: 'sv001', role: 'SINH_VIEN', hanhDong: 'SUPPLEMENT_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Cần bổ sung', sau: 'Đang chờ duyệt', gioTruoc: 14 },
  { nguoi: 'sv001', role: 'SINH_VIEN', hanhDong: 'SUBMIT_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Bản nháp', sau: 'Đã nộp', gioTruoc: 20 },
  { nguoi: 'tk002', role: 'TRUONG_KHOA', hanhDong: 'REJECT_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Đang chờ duyệt', sau: 'Từ chối', gioTruoc: 22 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'UPDATE_WORKFLOW', doiTuong: 'Luồng duyệt WF-03', truoc: 'SLA bước 1: 24 giờ', sau: 'SLA bước 1: 12 giờ', gioTruoc: 26 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'UPDATE_REQUEST_TYPE', doiTuong: 'Loại đơn DHT', truoc: 'Không bắt buộc minh chứng', sau: 'Bắt buộc minh chứng', gioTruoc: 27 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'UPDATE_TEMPLATE', doiTuong: 'Mẫu văn bản MVT-GXN', truoc: 'Phiên bản 3', sau: 'Phiên bản 4', gioTruoc: 30 },
  { nguoi: 'pdt002', role: 'PHONG_DAO_TAO', hanhDong: 'REVOKE_DOCUMENT', doiTuong: 'Văn bản đã cấp', truoc: 'Hợp lệ', sau: 'Đã thu hồi', gioTruoc: 33 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'DELEGATE_APPROVAL', doiTuong: 'Ủy quyền duyệt', truoc: 'Không có', sau: 'Phạm Thu Hà nhận ủy quyền', gioTruoc: 36 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'UPDATE_USER', doiTuong: 'Người dùng CV002', truoc: 'Cố vấn lớp K19-CNTT2', sau: 'Cố vấn lớp K20-KHMT1, K20-DTD1', gioTruoc: 38 },
  { nguoi: 'sv020', role: 'SINH_VIEN', hanhDong: 'DOWNLOAD_DOCUMENT', doiTuong: 'Văn bản', truoc: '', sau: 'Tải lần 1', gioTruoc: 42 },
  { nguoi: 'sv008', role: 'SINH_VIEN', hanhDong: 'CANCEL_APPLICATION', doiTuong: 'Hồ sơ một cửa', truoc: 'Đã nộp', sau: 'Đã rút', gioTruoc: 46 },
  { nguoi: 'cv003', role: 'CO_VAN', hanhDong: 'LOGIN', doiTuong: 'Phiên đăng nhập', gioTruoc: 50 },
  { nguoi: 'tk003', role: 'TRUONG_KHOA', hanhDong: 'LOGIN', doiTuong: 'Phiên đăng nhập', gioTruoc: 54 },
  { nguoi: 'admin', role: 'ADMIN', hanhDong: 'CREATE_APPLICATION', doiTuong: 'Loại đơn DCN', truoc: 'Không có', sau: 'Đang hoạt động', gioTruoc: 58 },
  { nguoi: 'pdt001', role: 'PHONG_DAO_TAO', hanhDong: 'LOGOUT', doiTuong: 'Phiên đăng nhập', gioTruoc: 60 },
]

const DEVICES = ['Chrome 133 / Windows 11', 'Edge 132 / Windows 10', 'Safari 18 / macOS 15', 'Chrome 134 / Android 15']

export const AUDIT_LOG_LIST: AuditLog[] = (() => {
  const rng = createRng(4477)
  const now = Date.now()
  return ENTRIES.map((e, i) => {
    const app = APPLICATION_LIST[i % APPLICATION_LIST.length]
    return {
      id: `log${String(i + 1).padStart(3, '0')}`,
      luc: new Date(now - e.gioTruoc * 3_600_000).toISOString(),
      nguoiThucHienId: e.nguoi,
      nguoiThucHienTen:
        e.nguoi === 'admin'
          ? 'Đỗ Minh Tuấn'
          : e.nguoi === 'sv001'
            ? 'Nguyễn Văn An'
            : e.nguoi === 'sv008'
              ? 'Nguyễn Thị Kim Oanh'
              : e.nguoi === 'sv020'
                ? 'Trương Mỹ Duyên'
                : e.nguoi === 'cv001'
                  ? 'Trần Thị Mai'
                  : e.nguoi === 'cv003'
                    ? 'Hoàng Thị Lan'
                    : e.nguoi === 'tk001'
                      ? 'Lê Quang Huy'
                      : e.nguoi === 'tk002'
                        ? 'Nguyễn Thị Hồng'
                        : e.nguoi === 'tk003'
                          ? 'Trịnh Văn Khánh'
                          : e.nguoi === 'pdt001'
                            ? 'Phạm Thu Hà'
                            : 'Ngô Văn Dũng',
      vaiTro: e.role,
      hanhDong: e.hanhDong,
      doiTuong: e.doiTuong,
      doiTuongId: app?.maHoSo ?? '—',
      giaTriTruoc: e.truoc,
      giaTriSau: e.sau,
      diaChiIp: `113.161.${rng.int(1, 60)}.${rng.int(2, 250)}`,
      thietBi: rng.pick(DEVICES),
    }
  })
})()
