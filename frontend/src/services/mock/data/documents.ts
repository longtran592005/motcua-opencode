import type { SignedDocument } from '@/types'
import { APPLICATION_LIST, SIGNATURE_LIST } from './applications'
import { buildSignedDocument } from '../documentFactory'
import { createRng } from './rng'

const ARCHIVE_NGUOI_TAI = [
  'Nguyễn Văn An',
  'Trần Thị Bích Ngọc',
  'Lê Hoàng Nam',
  'Phòng Công tác Sinh viên',
  'Đặng Thùy Linh',
]

/** 12 văn bản đã cấp, sinh từ các hồ sơ ở trạng thái Hoàn thành. */
function buildDocuments(): SignedDocument[] {
  const rng = createRng(90210)
  return APPLICATION_LIST.filter((a) => a.trangThai === 'COMPLETED').map(
    (app) => {
      const ngayCap = app.ngayHoanThanh ?? app.ngayCapNhat
      const soVanBan = app.soVanBan ?? '000/ĐHTB'
      const doc = buildSignedDocument(
        app,
        SIGNATURE_LIST.filter((s) => s.applicationId === app.id),
        soVanBan,
        ngayCap,
        `vb_${app.id}`,
      )
      doc.luotTai = Array.from({ length: rng.int(0, 4) }, (_, i) => ({
        id: `dl_${app.id}_${i}`,
        luc: new Date(
          new Date(ngayCap).getTime() + (i + 1) * rng.int(3, 40) * 3_600_000,
        ).toISOString(),
        nguoiTai: i === 0 ? app.sinhVien.hoTen : rng.pick(ARCHIVE_NGUOI_TAI),
        diaChiIp: `10.20.${rng.int(1, 30)}.${rng.int(2, 240)}`,
      }))
      return doc
    },
  )
}

export const DOCUMENT_LIST: SignedDocument[] = buildDocuments()

/* Hai văn bản được đặt trạng thái đặc biệt để minh hoạ trang xác thực. */
if (DOCUMENT_LIST[3]) {
  DOCUMENT_LIST[3].trangThai = 'REVOKED'
  DOCUMENT_LIST[3].lyDoThuHoi =
    'Văn bản bị thu hồi do phát hiện sai lệch thông tin ngành học của sinh viên tại thời điểm cấp.'
  DOCUMENT_LIST[3].ngayThuHoi = new Date(
    new Date(DOCUMENT_LIST[3].ngayCap).getTime() + 5 * 86_400_000,
  ).toISOString()
}

if (DOCUMENT_LIST[7]) {
  DOCUMENT_LIST[7].chuKyConHieuLuc = false
  DOCUMENT_LIST[7].trangThai = 'INVALID'
}

export function findDocumentByToken(token: string) {
  return DOCUMENT_LIST.find((d) => d.tokenXacThuc === token)
}

export function findDocumentById(id: string) {
  return DOCUMENT_LIST.find((d) => d.id === id)
}

export function findDocumentByApplication(appId: string) {
  return DOCUMENT_LIST.find((d) => d.applicationId === appId)
}

export function findDocumentBySoVanBan(so: string) {
  const key = so.trim().toLowerCase()
  return DOCUMENT_LIST.find((d) => d.soVanBan.toLowerCase() === key)
}
