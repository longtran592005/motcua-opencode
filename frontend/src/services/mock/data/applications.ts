import type {
  Application,
  ApplicationStatus,
  ApprovalAction,
  Attachment,
  Role,
  Signature,
  StudentSummary,
  User,
  WorkflowStep,
} from '@/types'
import { quickHash } from '@/lib/utils'
import { buildAttachments, buildDuLieu, buildExtraAttachments } from './answers'
import { findKhoa, findKhoaHoc, findLop, findNganh } from './org'
import { createRng } from './rng'
import { findRequestType, REQUEST_TYPE_LIST } from './requestTypes'
import { findUserById } from './users'
import { findWorkflow } from './workflows'

const NOW = new Date()
const YEAR = NOW.getFullYear()

function dayOffset(days: number, hour = 9, minute = 15): string {
  const d = new Date(NOW.getTime() - days * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

export function maHoSo(seq: number): string {
  return `MC-${YEAR}-${String(seq).padStart(6, '0')}`
}

interface Blueprint {
  sv: string
  rt: string
  status: ApplicationStatus
  /** Số ngày trước đây hồ sơ được nộp. */
  nop: number
  /** PENDING_APPROVAL: bước đang chờ duyệt. */
  step?: number
  /** NEED_SUPPLEMENT: bước đã yêu cầu bổ sung. */
  quayVe?: number
  /** REJECTED: bước từ chối. */
  rejectStep?: number
  /** Số ngày trước đây hồ sơ hoàn thành (COMPLETED). */
  xong?: number
}

/**
 * 35 hồ sơ trải đủ 7 trạng thái; 12 hồ sơ đã hoàn thành sẽ được cấp văn bản.
 * sv001 (Nguyễn Văn An) là tài khoản demo chính nên nắm nhiều hồ sơ nhất.
 */
const BLUEPRINTS: Blueprint[] = [
  { sv: 'sv001', rt: 'rt_gxn', status: 'COMPLETED', nop: 9, xong: 7 },
  { sv: 'sv001', rt: 'rt_dht', status: 'PENDING_APPROVAL', nop: 3, step: 2 },
  { sv: 'sv001', rt: 'rt_dbt', status: 'NEED_SUPPLEMENT', nop: 5, quayVe: 1 },
  { sv: 'sv001', rt: 'rt_dbl', status: 'DRAFT', nop: 0 },
  { sv: 'sv001', rt: 'rt_dcn', status: 'PENDING_APPROVAL', nop: 1, step: 1 },
  { sv: 'sv001', rt: 'rt_gxn', status: 'REJECTED', nop: 8, rejectStep: 1 },
  { sv: 'sv001', rt: 'rt_dht', status: 'COMPLETED', nop: 24, xong: 21 },
  { sv: 'sv001', rt: 'rt_dbt', status: 'CANCELLED', nop: 12 },
  { sv: 'sv001', rt: 'rt_gxn', status: 'SUBMITTED', nop: 0 },
  { sv: 'sv001', rt: 'rt_dht', status: 'NEED_SUPPLEMENT', nop: 9, quayVe: 2 },
  { sv: 'sv002', rt: 'rt_gxn', status: 'COMPLETED', nop: 14, xong: 12 },
  { sv: 'sv002', rt: 'rt_dht', status: 'PENDING_APPROVAL', nop: 2, step: 1 },
  { sv: 'sv010', rt: 'rt_gxn', status: 'COMPLETED', nop: 11, xong: 9 },
  { sv: 'sv010', rt: 'rt_dbt', status: 'REJECTED', nop: 15, rejectStep: 1 },
  { sv: 'sv011', rt: 'rt_dcn', status: 'PENDING_APPROVAL', nop: 4, step: 2 },
  { sv: 'sv003', rt: 'rt_dht', status: 'PENDING_APPROVAL', nop: 3, step: 2 },
  { sv: 'sv003', rt: 'rt_gxn', status: 'COMPLETED', nop: 16, xong: 14 },
  { sv: 'sv013', rt: 'rt_dbt', status: 'SUBMITTED', nop: 0 },
  { sv: 'sv004', rt: 'rt_dbt', status: 'PENDING_APPROVAL', nop: 5, step: 2 },
  { sv: 'sv012', rt: 'rt_gxn', status: 'NEED_SUPPLEMENT', nop: 7, quayVe: 1 },
  { sv: 'sv005', rt: 'rt_dbl', status: 'REJECTED', nop: 18, rejectStep: 2 },
  { sv: 'sv006', rt: 'rt_gxn', status: 'COMPLETED', nop: 20, xong: 18 },
  { sv: 'sv014', rt: 'rt_dht', status: 'CANCELLED', nop: 14 },
  { sv: 'sv007', rt: 'rt_gxn', status: 'PENDING_APPROVAL', nop: 2, step: 1 },
  { sv: 'sv015', rt: 'rt_dbl', status: 'COMPLETED', nop: 30, xong: 26 },
  { sv: 'sv008', rt: 'rt_dbt', status: 'PENDING_APPROVAL', nop: 6, step: 2 },
  { sv: 'sv016', rt: 'rt_gxn', status: 'DRAFT', nop: 0 },
  { sv: 'sv009', rt: 'rt_dcn', status: 'PENDING_APPROVAL', nop: 8, step: 3 },
  { sv: 'sv017', rt: 'rt_gxn', status: 'SUBMITTED', nop: 0 },
  { sv: 'sv018', rt: 'rt_dbt', status: 'NEED_SUPPLEMENT', nop: 11, quayVe: 1 },
  /* Hồ sơ cũ đã hoàn thành — nguồn dữ liệu cho trang Văn bản đã cấp. */
  { sv: 'sv002', rt: 'rt_dbt', status: 'COMPLETED', nop: 35, xong: 31 },
  { sv: 'sv004', rt: 'rt_gxn', status: 'COMPLETED', nop: 40, xong: 38 },
  { sv: 'sv006', rt: 'rt_dbt', status: 'COMPLETED', nop: 46, xong: 41 },
  { sv: 'sv008', rt: 'rt_gxn', status: 'COMPLETED', nop: 52, xong: 50 },
  { sv: 'sv020', rt: 'rt_dht', status: 'COMPLETED', nop: 58, xong: 54 },
]

function pickApprover(role: Role, sv: User): User {
  if (role === 'CO_VAN') {
    const lop = findLop(sv.lopId)
    return findUserById(lop?.coVanId ?? 'cv001') ?? findUserById('cv001')!
  }
  if (role === 'TRUONG_KHOA') {
    const khoa = findKhoa(sv.donViId)
    return findUserById(khoa?.truongKhoaId ?? 'tk001') ?? findUserById('tk001')!
  }
  return findUserById('pdt001')!
}

function toStudentSummary(sv: User): StudentSummary {
  const lop = findLop(sv.lopId)
  const coVan = findUserById(lop?.coVanId ?? '')
  return {
    id: sv.id,
    maSo: sv.maSo,
    hoTen: sv.hoTen,
    lop: lop?.ma ?? sv.lopTen ?? '—',
    khoa: findKhoa(sv.donViId)?.ten ?? sv.donViTen ?? '—',
    nganh: findNganh(
      lop?.nganhId,
    )?.ten ?? sv.nganhTen ?? '—',
    khoaHoc: findKhoaHoc(lop?.khoaHocId)?.ten ?? sv.khoaHoc ?? '—',
    email: sv.email,
    soDienThoai: sv.soDienThoai,
    coVanId: coVan?.id,
    coVanTen: coVan?.hoTen,
  }
}

function ghiChuDuyet(role: Role, rng: ReturnType<typeof createRng>): string {
  const pool: Record<string, string[]> = {
    CO_VAN: [
      'Đã kiểm tra thông tin sinh viên thuộc lớp phụ trách, đề nghị các cấp tiếp theo xem xét.',
      'Sinh viên thuộc diện quản lý của tôi, hồ sơ hợp lệ.',
    ],
    TRUONG_KHOA: [
      'Thống nhất nội dung đề nghị của sinh viên, chuyển Phòng Đào tạo xử lý.',
      'Xét theo điều kiện của khoa, đồng ý cho hồ sơ chuyển bước tiếp theo.',
    ],
    PHONG_DAO_TAO: [
      'Hồ sơ đầy đủ, đã ký số và phát hành văn bản cho sinh viên.',
      'Kiểm tra dữ liệu trên hệ thống trùng khớp, phát hành văn bản.',
    ],
  }
  return rng.pick(pool[role] ?? ['Đồng ý.'])
}

interface BuiltApplication {
  application: Application
  signatures: Signature[]
}

function buildOne(
  bp: Blueprint,
  index: number,
  rng: ReturnType<typeof createRng>,
): BuiltApplication {
  const sv = findUserById(bp.sv)!
  const rt = findRequestType(bp.rt)!
  const wf = findWorkflow(rt.workflowId)!
  const steps = [...wf.steps].sort((a, b) => a.order - b.order)
  const code = maHoSo(120 + index)
  const ngayTao = dayOffset(bp.nop + 0.3, 8, 40)
  const ngayNop = bp.status === 'DRAFT' ? undefined : dayOffset(bp.nop, 10, 20)
  const duLieu = buildDuLieu(rt, sv, rng)
  const tepDinhKem: Attachment[] = ngayNop
    ? [...buildAttachments(rt, rng, ngayNop), ...buildExtraAttachments(rng, ngayNop)]
    : []

  const lichSu: ApprovalAction[] = []
  const signatures: Signature[] = []
  let cursor = ngayNop ?? ngayTao

  const pushAction = (a: Omit<ApprovalAction, 'id' | 'applicationId'>) => {
    lichSu.push({
      ...a,
      id: `act_${code}_${lichSu.length + 1}`,
      applicationId: code,
    })
  }

  if (ngayNop) {
    pushAction({
      buocOrder: 0,
      hanhDong: 'SUBMIT',
      nguoiThucHienId: sv.id,
      nguoiThucHienTen: sv.hoTen,
      chucVu: `Sinh viên lớp ${toStudentSummary(sv).lop}`,
      vaiTro: 'SINH_VIEN',
      ghiChu: 'Nộp hồ sơ trực tuyến trên Cổng Một cửa điện tử.',
      luc: ngayNop,
    })
  }

  const approvedSteps: number[] = []
  let buocDaDuyet = 0
  let currentStepOrder = 0
  let buocHienTai: WorkflowStep | null = steps[0] ?? null
  let hanXuLy: string | undefined
  let ngayHoanThanh: string | undefined
  let lyDoTuChoi: string | undefined
  let yeuCauBoSung: Application['yeuCauBoSung']

  const approveStep = (order: number) => {
    const step = steps.find((s) => s.order === order)!
    const approver = pickApprover(step.role, sv)
    cursor = addHours(cursor, rng.int(3, Math.max(4, step.slaHours - 2)))
    const luc = cursor
    const action = {
      buocOrder: step.order,
      hanhDong: 'APPROVE' as const,
      nguoiThucHienId: approver.id,
      nguoiThucHienTen: approver.hoTen,
      chucVu: approver.chucVu,
      vaiTro: approver.role,
      ghiChu: ghiChuDuyet(step.role, rng),
      phuongThuc: step.mode === 'OTP' ? ('OTP' as const) : ('ONE_CLICK' as const),
      luc,
    }
    pushAction(action)
    const maBam = quickHash(
      `${code}|${step.order}|${step.role}|${JSON.stringify(duLieu)}|${luc}`,
    )
    signatures.push({
      id: `sig_${code}_${step.order}`,
      applicationId: code,
      buocOrder: step.order,
      tenBuoc: step.ten,
      nguoiKyId: approver.id,
      hoTen: approver.hoTen,
      chucVu: approver.chucVu ?? '',
      vaiTro: approver.role,
      phuongThuc: step.mode === 'OTP' ? 'OTP' : 'ELECTRONIC',
      thoiDiemKy: luc,
      maBam,
      maChuKy: maBam.slice(0, 8).toUpperCase(),
      hopLe: true,
    })
    approvedSteps.push(step.order)
    buocDaDuyet = approvedSteps.length
  }

  switch (bp.status) {
    case 'DRAFT':
      break

    case 'SUBMITTED':
      currentStepOrder = 0
      buocHienTai = steps[0]
      hanXuLy = addHours(ngayNop!, steps[0].slaHours)
      break

    case 'PENDING_APPROVAL': {
      const target = bp.step ?? 1
      for (let o = 1; o < target; o += 1) approveStep(o)
      currentStepOrder = target
      buocHienTai = steps.find((s) => s.order === target) ?? null
      const step = buocHienTai!
      const startedAt = signatures.length
        ? signatures[signatures.length - 1].thoiDiemKy
        : ngayNop!
      hanXuLy = addHours(startedAt, step.slaHours)
      break
    }

    case 'NEED_SUPPLEMENT': {
      const target = bp.quayVe ?? 1
      for (let o = 1; o < target; o += 1) approveStep(o)
      const step = steps.find((s) => s.order === target)!
      const approver = pickApprover(step.role, sv)
      cursor = addHours(cursor, rng.int(4, 20))
      const luc = cursor
      const noiDung = rng.pick([
        'Đề nghị bổ sung bản chụp minh chứng rõ nét hơn, hiện tại tệp tải lên bị mờ và không đọc được nội dung.',
        'Thông tin kê khai chưa khớp với dữ liệu của Phòng Đào tạo, đề nghị sinh viên kiểm tra và chỉnh sửa lại.',
        'Hồ sơ còn thiếu giấy tờ bắt buộc theo danh mục, đề nghị bổ sung trước khi xét duyệt.',
      ])
      pushAction({
        buocOrder: step.order,
        hanhDong: 'REQUEST_SUPPLEMENT',
        nguoiThucHienId: approver.id,
        nguoiThucHienTen: approver.hoTen,
        chucVu: approver.chucVu,
        vaiTro: approver.role,
        lyDo: noiDung,
        luc,
      })
      yeuCauBoSung = {
        noiDung,
        boiAiId: approver.id,
        boiAiTen: approver.hoTen,
        luc,
        daBoSung: false,
        quayVeBuocOrder: step.order,
      }
      currentStepOrder = 0
      buocHienTai = null
      break
    }

    case 'REJECTED': {
      const target = bp.rejectStep ?? 1
      for (let o = 1; o < target; o += 1) approveStep(o)
      const step = steps.find((s) => s.order === target)!
      const approver = pickApprover(step.role, sv)
      cursor = addHours(cursor, rng.int(4, 20))
      const luc = cursor
      lyDoTuChoi = rng.pick([
        'Lý do sinh viên trình bày chưa đủ căn cứ theo quy chế đào tạo hiện hành.',
        'Hồ sơ không đáp ứng điều kiện xét duyệt của học kỳ này.',
        'Sinh viên đã hết thời hạn nộp hồ sơ theo thông báo của Phòng Đào tạo.',
      ])
      pushAction({
        buocOrder: step.order,
        hanhDong: 'REJECT',
        nguoiThucHienId: approver.id,
        nguoiThucHienTen: approver.hoTen,
        chucVu: approver.chucVu,
        vaiTro: approver.role,
        lyDo: lyDoTuChoi,
        luc,
      })
      currentStepOrder = step.order
      buocHienTai = null
      break
    }

    case 'CANCELLED': {
      cursor = addHours(cursor, rng.int(2, 12))
      pushAction({
        buocOrder: 0,
        hanhDong: 'CANCEL',
        nguoiThucHienId: sv.id,
        nguoiThucHienTen: sv.hoTen,
        vaiTro: 'SINH_VIEN',
        ghiChu: 'Sinh viên chủ động rút hồ sơ khi chưa có cấp nào phê duyệt.',
        luc: cursor,
      })
      currentStepOrder = 0
      buocHienTai = null
      break
    }

    case 'COMPLETED': {
      steps.forEach((s) => approveStep(s.order))
      currentStepOrder = steps.length
      buocHienTai = null
      ngayHoanThanh = dayOffset(bp.xong ?? Math.max(1, bp.nop - 2), 15, 30)
      hanXuLy = ngayHoanThanh
      pushAction({
        buocOrder: steps.length,
        hanhDong: 'ISSUE_DOCUMENT',
        nguoiThucHienId: 'pdt001',
        nguoiThucHienTen: 'Phạm Thu Hà',
        chucVu: 'Phó Trưởng phòng Đào tạo',
        vaiTro: 'PHONG_DAO_TAO',
        ghiChu: 'Văn bản đã được ký số và phát hành cho sinh viên.',
        luc: ngayHoanThanh,
      })
      break
    }
  }

  const soVanBan =
    bp.status === 'COMPLETED'
      ? `${118 + index}/${rt.ma}-ĐHTB`
      : undefined

  const application: Application = {
    id: code,
    maHoSo: code,
    requestTypeId: rt.id,
    requestType: {
      id: rt.id,
      ma: rt.ma,
      ten: rt.ten,
      nhom: rt.nhom,
      icon: rt.icon,
      mau: rt.mau,
    },
    sinhVienId: sv.id,
    sinhVien: toStudentSummary(sv),
    trangThai: bp.status,
    duLieu,
    tepDinhKem,
    workflowId: wf.id,
    currentStepOrder,
    buocHienTai,
    tongSoBuoc: steps.length,
    buocDaDuyet,
    lichSu,
    ngayTao,
    ngayNop,
    ngayCapNhat:
      lichSu.length > 0 ? lichSu[lichSu.length - 1].luc : ngayTao,
    hanXuLy,
    ngayHoanThanh,
    lyDoTuChoi,
    yeuCauBoSung,
    vanBanId: bp.status === 'COMPLETED' ? `vb_${code}` : undefined,
    tokenXacThuc:
      bp.status === 'COMPLETED' ? quickHash(`${code}-token`).slice(0, 24) : undefined,
    soVanBan,
  }

  return { application, signatures }
}

function buildAll(): {
  applications: Application[]
  signatures: Signature[]
} {
  const rng = createRng(20260216)
  const applications: Application[] = []
  const signatures: Signature[] = []
  BLUEPRINTS.forEach((bp, index) => {
    const built = buildOne(bp, index, rng)
    applications.push(built.application)
    signatures.push(...built.signatures)
  })
  return { applications, signatures }
}

const built = buildAll()

export const APPLICATION_LIST: Application[] = built.applications
export const SIGNATURE_LIST: Signature[] = built.signatures

export const REQUEST_TYPE_STATS = REQUEST_TYPE_LIST.map((rt) => ({
  requestTypeId: rt.id,
  ten: rt.ten,
  ma: rt.ma,
  soLuong: APPLICATION_LIST.filter((a) => a.requestTypeId === rt.id).length,
}))
