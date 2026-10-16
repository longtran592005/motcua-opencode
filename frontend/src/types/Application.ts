import type { ApprovalAction } from './ApprovalAction'
import type { ApplicationStatus } from './common'
import type { RequestType } from './RequestType'
import type { Workflow, WorkflowStep } from './WorkflowStep'

export interface Attachment {
  id: string
  ten: string
  loai: string
  kichThuoc: number
  url: string
  uploadedAt: string
  nguoiTaiLen?: string
  /** Khớp với AttachmentRequirement.key nếu là giấy tờ bắt buộc. */
  requirementKey?: string
}

export interface StudentSummary {
  id: string
  maSo: string
  hoTen: string
  lop: string
  khoa: string
  nganh: string
  khoaHoc: string
  email: string
  soDienThoai?: string
  /** Cố vấn học tập phụ trách. */
  coVanId?: string
  coVanTen?: string
}

export interface SupplementRequest {
  noiDung: string
  boiAiId: string
  boiAiTen: string
  luc: string
  daBoSung: boolean
  /** Bước đã yêu cầu bổ sung — sau khi sinh viên bổ sung sẽ quay về đúng bước này. */
  quayVeBuocOrder: number
}

export interface Application {
  id: string
  maHoSo: string
  requestTypeId: string
  requestType: Pick<RequestType, 'id' | 'ma' | 'ten' | 'nhom' | 'icon' | 'mau'>
  sinhVienId: string
  sinhVien: StudentSummary
  trangThai: ApplicationStatus
  duLieu: Record<string, unknown>
  tepDinhKem: Attachment[]
  workflowId: string
  currentStepOrder: number
  buocHienTai: WorkflowStep | null
  tongSoBuoc: number
  buocDaDuyet: number
  lichSu: ApprovalAction[]
  ngayTao: string
  ngayNop?: string
  ngayCapNhat: string
  hanXuLy?: string
  ngayHoanThanh?: string
  lyDoTuChoi?: string
  yeuCauBoSung?: SupplementRequest
  vanBanId?: string
  tokenXacThuc?: string
  soVanBan?: string
}

export interface ApplicationDetail extends Application {
  workflow: Workflow
  requestTypeFull: RequestType
}

export interface CreateApplicationPayload {
  requestTypeId: string
  duLieu: Record<string, unknown>
  tepDinhKem: Attachment[]
}

export interface ApplicationListQuery {
  page?: number
  pageSize?: number
  trangThai?: ApplicationStatus | 'ALL'
  requestTypeId?: string
  tuKhoa?: string
  khoa?: string
  lop?: string
  /** Chỉ lấy đơn quá hạn / sắp hết hạn. */
  hanXuLy?: 'ALL' | 'SAP_HET_HAN' | 'QUA_HAN'
  sapXep?: 'MOI_NHAT' | 'CU_NHAT' | 'HAN_GAN_NHAT'
  /** Dùng cho khu vực phê duyệt: chỉ lấy đơn chờ vai trò này. */
  choVaiTro?: string
}
