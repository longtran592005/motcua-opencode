import type { Workflow } from '@/types'

/**
 * Ba luồng duyệt mẫu: 1 cấp, 2 cấp và 3 cấp.
 * Bước "một chạm" (ONE_CLICK) chỉ cần bấm Duyệt; bước OTP yêu cầu ký bằng mã OTP.
 */
export const WORKFLOW_LIST: Workflow[] = [
  {
    id: 'wf_1cap',
    ma: 'WF-01',
    ten: 'Duyệt 1 cấp (Phòng Đào tạo)',
    requestTypeIds: ['rt_gxn'],
    hoatDong: true,
    capDo: 1,
    steps: [
      {
        id: 'ws_1cap_1',
        order: 1,
        ten: 'Phòng Đào tạo phát hành giấy xác nhận',
        role: 'PHONG_DAO_TAO',
        mode: 'OTP',
        slaHours: 24,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Kiểm tra dữ liệu sinh viên và ký số OTP để phát hành giấy xác nhận.',
      },
    ],
  },
  {
    id: 'wf_2cap',
    ma: 'WF-02',
    ten: 'Duyệt 2 cấp (Cố vấn học tập → Phòng Đào tạo)',
    requestTypeIds: ['rt_dbt', 'rt_dbl'],
    hoatDong: true,
    capDo: 2,
    steps: [
      {
        id: 'ws_2cap_1',
        order: 1,
        ten: 'Cố vấn học tập xác nhận',
        role: 'CO_VAN',
        mode: 'ONE_CLICK',
        slaHours: 24,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Xác nhận sinh viên thuộc lớp phụ trách và thông tin kê khai là đúng.',
      },
      {
        id: 'ws_2cap_2',
        order: 2,
        ten: 'Phòng Đào tạo ký số phát hành',
        role: 'PHONG_DAO_TAO',
        mode: 'OTP',
        slaHours: 24,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Ký số OTP và phát hành văn bản có mã QR xác thực.',
      },
    ],
  },
  {
    id: 'wf_3cap',
    ma: 'WF-03',
    ten: 'Duyệt 3 cấp (Cố vấn → Trưởng khoa → Phòng Đào tạo)',
    requestTypeIds: ['rt_dht', 'rt_dcn'],
    hoatDong: true,
    capDo: 3,
    steps: [
      {
        id: 'ws_3cap_1',
        order: 1,
        ten: 'Cố vấn học tập xác nhận',
        role: 'CO_VAN',
        mode: 'ONE_CLICK',
        slaHours: 12,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Xác nhận hoàn cảnh và tính xác thực của lý do sinh viên trình bày.',
      },
      {
        id: 'ws_3cap_2',
        order: 2,
        ten: 'Trưởng khoa phê duyệt',
        role: 'TRUONG_KHOA',
        mode: 'ONE_CLICK',
        slaHours: 24,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Phê duyệt ở cấp khoa trước khi chuyển Phòng Đào tạo.',
      },
      {
        id: 'ws_3cap_3',
        order: 3,
        ten: 'Phòng Đào tạo ký số phát hành',
        role: 'PHONG_DAO_TAO',
        mode: 'OTP',
        slaHours: 24,
        allowReject: true,
        allowSupplement: true,
        moTa: 'Ký số OTP, cấp số văn bản và sinh mã QR xác thực.',
      },
    ],
  },
]

export function findWorkflow(id: string) {
  return WORKFLOW_LIST.find((w) => w.id === id)
}
