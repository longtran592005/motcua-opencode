import type { Notification, NotificationType } from '@/types'
import { APPLICATION_LIST } from './applications'

interface Template {
  tieuDe: string
  noiDung: string
  loai: NotificationType
}

const HOUR = 3_600_000

function build(): Notification[] {
  const now = Date.now()
  const items: Notification[] = []
  let seq = 0

  const push = (
    nguoiNhanId: string,
    tpl: Template,
    gioTruoc: number,
    extra: Partial<Notification> = {},
  ) => {
    seq += 1
    items.push({
      id: `tb${String(seq).padStart(3, '0')}`,
      nguoiNhanId,
      daDoc: gioTruoc > 60,
      luc: new Date(now - gioTruoc * HOUR).toISOString(),
      ...tpl,
      ...extra,
    })
  }

  const sv1 = APPLICATION_LIST.filter((a) => a.sinhVienId === 'sv001')
  const gxn = sv1.find((a) => a.trangThai === 'COMPLETED')!
  const dht = sv1.find((a) => a.trangThai === 'PENDING_APPROVAL' && a.requestTypeId === 'rt_dht')!
  const dbt = sv1.find((a) => a.trangThai === 'NEED_SUPPLEMENT')!

  push(
    'sv001',
    {
      tieuDe: 'Văn bản của bạn đã được ký số và phát hành',
      noiDung: `Hồ sơ ${gxn.maHoSo} đã hoàn thành. Văn bản số ${gxn.soVanBan} đã được ký điện tử, bạn có thể tải về và in để sử dụng.`,
      loai: 'SUCCESS',
    },
    5,
    {
      applicationId: gxn.id,
      maHoSo: gxn.maHoSo,
      lienKet: `/don/${gxn.maHoSo}/van-ban`,
    },
  )

  push(
    'sv001',
    {
      tieuDe: 'Hồ sơ cần bổ sung thông tin',
      noiDung: `Hồ sơ ${dbt.maHoSo} đang ở trạng thái Cần bổ sung. Vui lòng xem nội dung yêu cầu và cập nhật hồ sơ trước ngày ${new Date(now + 3 * 24 * HOUR).toLocaleDateString('vi-VN')}.`,
      loai: 'WARNING',
    },
    20,
    {
      applicationId: dbt.id,
      maHoSo: dbt.maHoSo,
      lienKet: `/don/${dbt.maHoSo}`,
    },
  )

  push(
    'sv001',
    {
      tieuDe: 'Hồ sơ đã được Trưởng khoa phê duyệt',
      noiDung: `Hồ sơ ${dht.maHoSo} đã qua cấp Trưởng khoa và đang chờ Phòng Đào tạo ký số phát hành.`,
      loai: 'INFO',
    },
    28,
    {
      applicationId: dht.id,
      maHoSo: dht.maHoSo,
      lienKet: `/don/${dht.maHoSo}`,
    },
  )

  push(
    'sv001',
    {
      tieuDe: 'Nhắc nhở: bổ sung minh chứng hoãn thi',
      noiDung:
        'Tệp minh chứng bạn tải lên bị mờ, không đọc được nội dung. Cố vấn học tập đã yêu cầu bạn tải lại bản rõ nét hơn.',
      loai: 'DANGER',
    },
    34,
  )

  push(
    'sv001',
    {
      tieuDe: 'Cập nhật quy định về xác thực văn bản điện tử',
      noiDung:
        'Từ ngày 01/03/2026, toàn bộ văn bản do Trường phát hành đều có mã QR xác thực tại motcua.tbu.edu.vn/xac-thuc. Sinh viên nên kiểm tra tính hợp lệ trước khi sử dụng.',
      loai: 'INFO',
    },
    50,
  )

  push(
    'sv001',
    {
      tieuDe: 'Hồ sơ đã bị từ chối',
      noiDung: `Hồ sơ ${gxn.maHoSo} đã bị từ chối. Lý do đã được ghi rõ trong phần lịch sử xử lý của hồ sơ.`,
      loai: 'DANGER',
    },
    120,
    {
      applicationId: gxn.id,
      maHoSo: gxn.maHoSo,
      lienKet: `/don/${gxn.maHoSo}`,
    },
  )

  push(
    'sv001',
    {
      tieuDe: 'Hồ sơ của bạn đã được tiếp nhận',
      noiDung: `Hệ thống đã ghi nhận hồ sơ ${gxn.maHoSo} và chuyển tới cấp xử lý đầu tiên.`,
      loai: 'INFO',
    },
    150,
    { maHoSo: gxn.maHoSo, lienKet: `/don/${gxn.maHoSo}` },
  )

  push(
    'sv001',
    {
      tieuDe: 'Thư viện biểu mẫu đã có bản cập nhật',
      noiDung:
        'Mẫu "Đơn xin hoãn thi kết thúc học phần" vừa được cập nhật, bổ sung phần khai báo ca thi và học kỳ.',
      loai: 'INFO',
    },
    200,
    { lienKet: '/thu-vien-bieu-mau' },
  )

  const pending = APPLICATION_LIST.filter(
    (a) => a.trangThai === 'PENDING_APPROVAL',
  )

  push(
    'cv001',
    {
      tieuDe: 'Có hồ sơ mới chờ bạn xử lý',
      noiDung: `Hồ sơ ${pending.find((a) => a.sinhVienId === 'sv001' && a.requestTypeId === 'rt_dcn')?.maHoSo ?? pending[0]?.maHoSo} của sinh viên lớp bạn phụ trách đang chờ xác nhận.`,
      loai: 'INFO',
    },
    6,
    { maHoSo: pending[0]?.maHoSo, lienKet: '/quan-ly/cho-duyet' },
  )

  push(
    'cv001',
    {
      tieuDe: 'Hồ sơ sắp hết hạn xử lý',
      noiDung:
        'Có hồ sơ trong danh sách chờ của bạn chỉ còn dưới 24 giờ theo thời hạn cam kết (SLA). Vui lòng xử lý kịp thời.',
      loai: 'WARNING',
    },
    12,
    { lienKet: '/quan-ly/cho-duyet' },
  )

  push(
    'cv001',
    {
      tieuDe: 'Sinh viên đã bổ sung hồ sơ',
      noiDung:
        'Một hồ sơ trong danh sách đã được sinh viên cập nhật nội dung và sẵn sàng để bạn xem xét lại.',
      loai: 'SUCCESS',
    },
    40,
    { lienKet: '/quan-ly/cho-duyet' },
  )

  push(
    'tk001',
    {
      tieuDe: 'Hồ sơ trình Trưởng khoa phê duyệt',
      noiDung:
        'Hai hồ sơ của sinh viên Khoa Công nghệ thông tin đã qua cấp Cố vấn học tập và đang chờ phê duyệt cấp khoa.',
      loai: 'INFO',
    },
    9,
    { lienKet: '/quan-ly/cho-duyet' },
  )

  push(
    'tk001',
    {
      tieuDe: 'Nhắc nhở về thời hạn SLA cấp khoa',
      noiDung:
        'Thời hạn xử lý trung bình của cấp khoa trong tuần này là 19 giờ, thấp hơn mức cam kết 24 giờ. Ghi nhận kết quả tốt.',
      loai: 'SUCCESS',
    },
    70,
  )

  push(
    'pdt001',
    {
      tieuDe: 'Hồ sơ chờ ký số phát hành',
      noiDung:
        'Có 6 hồ sơ đã hoàn tất các cấp phê duyệt và đang chờ Phòng Đào tạo ký số, phát hành văn bản.',
      loai: 'WARNING',
    },
    3,
    { lienKet: '/quan-ly/cho-duyet' },
  )

  push(
    'pdt001',
    {
      tieuDe: 'Báo cáo tuần đã sẵn sàng',
      noiDung:
        'Báo cáo thống kê xử lý hồ sơ Một cửa tuần qua đã được tổng hợp, có thể xuất ra tệp Excel.',
      loai: 'INFO',
    },
    26,
    { lienKet: '/quan-ly/bao-cao' },
  )

  return items
}

export const NOTIFICATION_LIST: Notification[] = build()
