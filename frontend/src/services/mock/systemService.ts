import { ApiError, type AuditLog, type LibraryItem, type Notification, type User } from '@/types'
import { AUDIT_ACTION_LABELS } from '@/types'
import { CHATBOT_SUGGESTIONS } from '@/lib/constants'
import { includesText, sleep } from '@/lib/utils'
import { clone, paginate, readOp, writeOp } from './helpers'
import { addAudit, db } from './store'
import type { AuditService, ChatChunk, ChatService, LibraryService, NotificationService } from '../contracts/system'

function currentUser(): User {
  const user = db.currentUser
  if (!user) throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
  return user
}

export const mockNotificationService: NotificationService = {
  async listMine() {
    const user = currentUser()
    return readOp(() =>
      db.notifications
        .filter((n) => n.nguoiNhanId === user.id)
        .sort((a, b) => b.luc.localeCompare(a.luc))
        .map((n) => ({ ...n })),
    )
  },
  async unreadCount() {
    const user = currentUser()
    return readOp(
      () => db.notifications.filter((n) => n.nguoiNhanId === user.id && !n.daDoc).length,
    )
  },
  async markRead(id: string) {
    return writeOp(() => {
      const n = db.notifications.find((x) => x.id === id)
      if (n) n.daDoc = true
    })
  },
  async markAllRead() {
    const user = currentUser()
    return writeOp(() => {
      db.notifications.forEach((n) => {
        if (n.nguoiNhanId === user.id) n.daDoc = true
      })
    })
  },
  async remove(id: string) {
    return writeOp(() => {
      db.notifications = db.notifications.filter((n) => n.id !== id)
    })
  },
}

export const mockAuditService: AuditService = {
  async list(query = {}) {
    const user = currentUser()
    if (user.role !== 'ADMIN') {
      throw new ApiError('FORBIDDEN_SCOPE', 'Chỉ quản trị viên xem được nhật ký hệ thống.', 403)
    }
    return readOp(() => {
      let items: AuditLog[] = [...db.auditLogs]
      if (query.tuKhoa) {
        items = items.filter((l) =>
          includesText(`${l.nguoiThucHienTen} ${l.hanhDong} ${l.doiTuong} ${l.doiTuongId}`, query.tuKhoa!),
        )
      }
      if (query.nguoiThucHienId) {
        items = items.filter((l) => l.nguoiThucHienId === query.nguoiThucHienId)
      }
      if (query.hanhDong) items = items.filter((l) => l.hanhDong === query.hanhDong)
      if (query.tuNgay) items = items.filter((l) => l.luc >= query.tuNgay!)
      if (query.denNgay) items = items.filter((l) => l.luc <= `${query.denNgay}T23:59:59`)
      items.sort((a, b) => b.luc.localeCompare(a.luc))
      return paginate(items, query.page, query.pageSize)
    })
  },
  async get(id) {
    currentUser()
    return readOp(() => {
      const log = db.auditLogs.find((l) => l.id === id)
      if (!log) throw new ApiError('NOT_FOUND', 'Không tìm thấy bản ghi nhật ký.', 404)
      return clone(log)
    })
  },
  async actions() {
    currentUser()
    return readOp(() => {
      const set = new Set(db.auditLogs.map((l) => l.hanhDong))
      return [...set].map((ma) => ({ ma, nhan: AUDIT_ACTION_LABELS[ma] ?? ma }))
    })
  },
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const mockLibraryService: LibraryService = {
  async list(query = {}) {
    return readOp(() => {
      let items = [...db.library]
      if (query.nhom) items = items.filter((i) => i.nhom === query.nhom)
      if (query.tuKhoa) {
        items = items.filter((i) => includesText(`${i.ten} ${i.moTa} ${i.nhom}`, query.tuKhoa!))
      }
      return items.map((i) => ({ ...i }))
    })
  },
  async groups() {
    return readOp(() => [...new Set(db.library.map((i) => i.nhom))])
  },
  async get(id) {
    return readOp(() => {
      const item = db.library.find((i) => i.id === id)
      if (!item) throw new ApiError('NOT_FOUND', 'Không tìm thấy biểu mẫu.', 404)
      return { ...item }
    })
  },
  async download(id) {
    // Thư viện là trang công khai: khách chưa đăng nhập vẫn tải được tài liệu.
    const user = db.currentUser
    return writeOp(() => {
      const item = db.library.find((i) => i.id === id)
      if (!item) throw new ApiError('NOT_FOUND', 'Không tìm thấy biểu mẫu.', 404)
      item.luotTai += 1
      if (user) {
        addAudit({
          nguoiThucHien: user,
          hanhDong: 'DOWNLOAD_DOCUMENT',
          doiTuong: 'Biểu mẫu',
          doiTuongId: item.ten,
        })
      }
      if (item.url) {
        return {
          ten: `${item.ten}.${item.loaiTep}`,
          mime: MIME_BY_EXT[item.loaiTep] ?? 'application/octet-stream',
          noiDung: item.url,
          url: item.url,
        }
      }
      return {
        ten: `${item.ten}.${item.loaiTep}`,
        mime: 'application/octet-stream',
        noiDung: `Biểu mẫu: ${item.ten}\nNhóm: ${item.nhom}\nMô tả: ${item.moTa}\n\n(Dữ liệu mô phỏng — backend sẽ trả về tệp thật.)`,
      }
    })
  },
}

/* ============================== CHATBOT ============================== */
interface KbEntry {
  tuKhoa: string[]
  traLoi: string
  nguon: { tenFile: string; trang: number; trichDoan: string }[]
  goiYForm?: { requestTypeId: string; ten: string }
}

const KB: KbEntry[] = [
  {
    tuKhoa: ['giấy xác nhận', 'xac nhan sinh vien', 'gxn'],
    traLoi:
      'Bạn có thể nộp đơn "Giấy xác nhận sinh viên" ngay trên Cổng Một cửa. Cách làm: vào mục Dịch vụ Một cửa, chọn thẻ "Giấy xác nhận sinh viên", điền mục đích xác nhận và nơi nhận, sau đó bấm Nộp hồ sơ. Hồ sơ này chỉ qua 1 cấp duyệt là Phòng Đào tạo, thời hạn xử lý trong 24 giờ làm việc. Khi hoàn thành, bạn tải văn bản PDF có chữ ký số và mã QR để in.',
    nguon: [
      { tenFile: 'Huong-dan-cong-mot-cua.pdf', trang: 6, trichDoan: 'Mục 3.1 — Quy trình cấp giấy xác nhận sinh viên.' },
      { tenFile: 'Danh-muc-ho-so-mot-cua.xlsx', trang: 1, trichDoan: 'Dòng 1 — GXN, 24 giờ, lệ phí 0 đồng.' },
    ],
    goiYForm: { requestTypeId: 'rt_gxn', ten: 'Giấy xác nhận sinh viên' },
  },
  {
    tuKhoa: ['hoãn thi', 'hoan thi', 'thi bù', 'dht'],
    traLoi:
      'Đơn xin hoãn thi đi qua 3 cấp: Cố vấn học tập xác nhận, Trưởng khoa phê duyệt, sau đó Phòng Đào tạo ký số phát hành. Thời hạn cam kết là 12 giờ cho cấp Cố vấn và 24 giờ cho mỗi cấp còn lại. Bắt buộc đính kèm giấy tờ minh chứng lý do (ví dụ giấy khám bệnh). Bạn cần khai rõ học phần, mã học phần, ngày thi và ca thi.',
    nguon: [
      { tenFile: 'Quy-dinh-hoc-vu.pdf', trang: 12, trichDoan: 'Điều 15 — Hoãn thi kết thúc học phần và thi bù.' },
      { tenFile: 'Don-hoan-thi.docx', trang: 1, trichDoan: 'Phần khai báo học phần, ca thi và minh chứng.' },
    ],
    goiYForm: { requestTypeId: 'rt_dht', ten: 'Đơn xin hoãn thi' },
  },
  {
    tuKhoa: ['bảo lưu', 'bao luu', 'dbl', 'tạm dừng học'],
    traLoi:
      'Đơn xin bảo lưu kết quả học tập đi qua 2 cấp: Cố vấn học tập và Phòng Đào tạo. Bạn cần đính kèm giấy tờ minh chứng (giấy khám bệnh, giấy gọi nhập ngũ...). Thời hạn bảo lưu có thể chọn 01 học kỳ, 01 năm học hoặc 02 năm học. Kết quả học tập đã tích lũy được giữ nguyên trong thời gian bảo lưu.',
    nguon: [
      { tenFile: 'Quy-dinh-bao-luu.pdf', trang: 3, trichDoan: 'Điều 6 — Thời hạn bảo lưu và điều kiện trở lại học tập.' },
    ],
    goiYForm: { requestTypeId: 'rt_dbl', ten: 'Đơn xin bảo lưu kết quả học tập' },
  },
  {
    tuKhoa: ['bảng điểm', 'bang diem', 'dbt', 'học phí bảng điểm'],
    traLoi:
      'Đơn xin cấp bảng điểm có lệ phí 30.000 đồng cho mỗi bản, thời hạn xử lý 05 ngày làm việc. Bạn chọn loại bảng điểm (toàn khóa hoặc theo học kỳ), ngôn ngữ (Tiếng Việt / Tiếng Anh) và hình thức nhận (trực tiếp tại Phòng Đào tạo hoặc gửi bưu điện). Hồ sơ qua 2 cấp: Cố vấn học tập và Phòng Đào tạo.',
    nguon: [
      { tenFile: 'Danh-muc-ho-so-mot-cua.xlsx', trang: 1, trichDoan: 'Dòng 2 — DBT, lệ phí 30.000 đồng, 05 ngày làm việc.' },
      { tenFile: 'Huong-dan-cong-mot-cua.pdf', trang: 9, trichDoan: 'Mục 4.2 — Cấp bảng điểm học tập.' },
    ],
    goiYForm: { requestTypeId: 'rt_dbt', ten: 'Đơn xin cấp bảng điểm' },
  },
  {
    tuKhoa: ['chuyển ngành', 'chuyen nganh', 'dcn'],
    traLoi:
      'Đơn xin chuyển ngành áp dụng theo quy chế đào tạo tín chỉ, thời hạn xử lý 10 ngày làm việc với lệ phí 100.000 đồng. Hồ sơ qua 3 cấp duyệt. Bạn cần đính kèm bảng điểm tích lũy và ảnh Căn cước công dân hai mặt. Việc xét chuyển ngành căn cứ vào điểm trung bình tích lũy và chỉ tiêu của ngành nhận.',
    nguon: [
      { tenFile: 'Quy-che-dao-tao.pdf', trang: 22, trichDoan: 'Điều 10 — Chuyển ngành, chuyển cơ sở đào tạo.' },
    ],
    goiYForm: { requestTypeId: 'rt_dcn', ten: 'Đơn xin chuyển ngành' },
  },
  {
    tuKhoa: ['quy trình', 'luồng', 'luong duyet', 'mấy cấp', 'bao nhiêu cấp'],
    traLoi:
      'Luồng duyệt liên thông gồm 4 bước: Nộp đơn trực tuyến → Duyệt cấp 1 (Cố vấn học tập) → Duyệt cấp 2 (Trưởng khoa, nếu loại đơn yêu cầu) → Nhận văn bản có mã QR. Tùy loại đơn mà luồng có 1, 2 hoặc 3 cấp. Mỗi cấp duyệt bằng nút một chạm hoặc ký OTP; khi cấp cuối ký xong, hệ thống cấp số văn bản và sinh mã QR xác thực.',
    nguon: [
      { tenFile: 'Huong-dan-cong-mot-cua.pdf', trang: 3, trichDoan: 'Mục 2 — Sơ đồ luồng duyệt liên thông 4 bước.' },
    ],
  },
  {
    tuKhoa: ['xác thực', 'xac thuc', 'qr', 'mã băm', 'giả mạo', 'kiểm tra văn bản'],
    traLoi:
      'Mọi văn bản do Trường phát hành đều có mã QR trỏ tới trang xác thực công khai. Bạn quét mã QR hoặc nhập số văn bản tại mục "Xác thực văn bản". Hệ thống hiển thị 3 trạng thái: Hợp lệ (xanh lá), Không hợp lệ (đỏ) và Đã thu hồi (cam), kèm danh sách người ký và mã băm SHA-256 để đối chiếu với tệp PDF bạn đang có.',
    nguon: [
      { tenFile: 'Huong-dan-xac-thuc-qr.pdf', trang: 2, trichDoan: 'Mục 2 — Ba trạng thái xác thực văn bản.' },
    ],
  },
  {
    tuKhoa: ['bổ sung', 'bo sung', 'cần bổ sung', 'sửa hồ sơ'],
    traLoi:
      'Khi cán bộ xử lý yêu cầu bổ sung, hồ sơ của bạn chuyển về trạng thái "Cần bổ sung" và xuất hiện cảnh báo nổi bật ở trang chủ. Bạn vào chi tiết hồ sơ, bấm "Bổ sung hồ sơ", cập nhật nội dung hoặc tệp còn thiếu rồi gửi lại. Hồ sơ sẽ quay lại đúng cấp đã yêu cầu bổ sung, không phải xét lại từ đầu.',
    nguon: [
      { tenFile: 'Huong-dan-cong-mot-cua.pdf', trang: 7, trichDoan: 'Mục 3.4 — Xử lý hồ sơ cần bổ sung.' },
    ],
  },
  {
    tuKhoa: ['rút đơn', 'hủy đơn', 'rut don', 'huy don'],
    traLoi:
      'Bạn có thể rút hồ sơ khi chưa có cấp nào phê duyệt. Nút "Rút đơn" nằm trong trang chi tiết hồ sơ. Sau khi rút, hồ sơ chuyển sang trạng thái "Đã rút" và không thể nộp lại — bạn cần tạo hồ sơ mới nếu vẫn có nguyện vọng.',
    nguon: [
      { tenFile: 'Huong-dan-cong-mot-cua.pdf', trang: 8, trichDoan: 'Mục 3.5 — Rút hồ sơ đã nộp.' },
    ],
  },
]

function timCauTraLoi(cauHoi: string): KbEntry | null {
  const diem = KB.map((kb) => ({
    kb,
    score: kb.tuKhoa.reduce((n, t) => (includesText(cauHoi, t) ? n + t.length : n), 0),
  })).sort((a, b) => b.score - a.score)
  return diem[0] && diem[0].score > 0 ? diem[0].kb : null
}

async function* streamText(text: string, maLoi?: string): AsyncGenerator<ChatChunk> {
  const words = text.split(/(\s+)/)
  let buf = ''
  for (let i = 0; i < words.length; i += 1) {
    buf += words[i]
    if (i % 3 === 2 || i === words.length - 1) {
      yield { loai: 'token', noiDung: buf, maLoi }
      buf = ''
      await sleep(Math.round(30 + Math.random() * 45))
    }
  }
}

export const mockChatService: ChatService = {
  async *hoi(cauHoi: string): AsyncGenerator<ChatChunk, void, unknown> {
    await sleep(280)
    const entry = timCauTraLoi(cauHoi)
    if (!entry) {
      const fallback =
        'Tôi chưa tìm thấy quy định tương ứng trong kho văn bản của Trường. Bạn có thể diễn đạt lại câu hỏi, hoặc xem mục Biểu mẫu & tài liệu để tra cứu quy chế, quy định liên quan. Nếu cần hỗ trợ trực tiếp, vui lòng liên hệ Phòng Đào tạo qua hotline 0227.3633669.'
      yield* streamText(fallback)
      yield { loai: 'nguon', nguon: [] }
      yield { loai: 'xong', traLoiDayDu: fallback }
      return
    }
    yield* streamText(entry.traLoi)
    yield { loai: 'nguon', nguon: entry.nguon, goiYForm: entry.goiYForm }
    yield { loai: 'xong', traLoiDayDu: entry.traLoi, goiYForm: entry.goiYForm }
  },

  async cauHoiGoiY() {
    await sleep(120)
    return [...CHATBOT_SUGGESTIONS]
  },

  async danhGia() {
    await sleep(180)
  },
}

export type { LibraryItem, Notification }
