import {
  ApiError,
  type Application,
  type ApplicationDetail,
  type ApplicationListQuery,
  type ApplicationStatus,
  type Attachment,
  type CreateApplicationPayload,
  type RequestType,
  type Role,
  type User,
} from '@/types'
import { includesText } from '@/lib/utils'
import { slaText } from '@/lib/formatters'
import { paginate, readOp, writeOp } from './helpers'
import {
  addAudit,
  buildDetail,
  db,
  findApplication,
  findRequestTypeById,
  findWorkflowById,
  inScope,
  isWaitingAt,
  nextSeq,
  notifyRole,
  scopeApplications,
  signaturesOf,
} from './store'
import { cancelApplication, supplementApplication } from './domain'
import type { ApprovalStats, MyStats } from '../contracts/application'

function currentUser(): User {
  const user = db.currentUser
  if (!user) {
    throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
  }
  return user
}

function matchQuery(app: Application, query: ApplicationListQuery): boolean {
  if (query.trangThai && query.trangThai !== 'ALL' && app.trangThai !== query.trangThai) {
    return false
  }
  if (query.requestTypeId && app.requestTypeId !== query.requestTypeId) return false
  if (query.khoa && app.sinhVien.khoa !== query.khoa) return false
  if (query.lop && app.sinhVien.lop !== query.lop) return false
  if (query.tuKhoa) {
    const haystack = `${app.maHoSo} ${app.sinhVien.hoTen} ${app.sinhVien.maSo} ${app.requestType.ten}`
    if (!includesText(haystack, query.tuKhoa)) return false
  }
  if (query.hanXuLy && query.hanXuLy !== 'ALL') {
    const mucDo = slaText(app.hanXuLy).mucDo
    if (query.hanXuLy === 'QUA_HAN' && mucDo !== 'QUA_HAN') return false
    if (query.hanXuLy === 'SAP_HET_HAN' && mucDo !== 'SAP_HET_HAN') return false
  }
  return true
}

function sortApplications(
  items: Application[],
  sapXep: ApplicationListQuery['sapXep'] = 'MOI_NHAT',
): Application[] {
  const copy = [...items]
  switch (sapXep) {
    case 'CU_NHAT':
      return copy.sort((a, b) =>
        (a.ngayNop ?? a.ngayTao).localeCompare(b.ngayNop ?? b.ngayTao),
      )
    case 'HAN_GAN_NHAT':
      return copy.sort((a, b) => (a.hanXuLy ?? 'z').localeCompare(b.hanXuLy ?? 'z'))
    default:
      return copy.sort((a, b) =>
        (b.ngayCapNhat ?? b.ngayTao).localeCompare(a.ngayCapNhat ?? a.ngayTao),
      )
  }
}

function taoMaHoSo(): string {
  return `MC-${new Date().getFullYear()}-${String(nextSeq('application')).padStart(6, '0')}`
}

function kiemTraBatBuoc(
  rt: RequestType,
  duLieu: Record<string, unknown>,
  tepDinhKem: Attachment[],
): void {
  const thieu = rt.formFields
    .filter((f) => f.required && !f.readOnly)
    .filter((f) => {
      const v = duLieu[f.key]
      return v === undefined || v === null || v === '' || (f.type === 'checkbox' && v !== true)
    })
    .map((f) => f.label)
  if (thieu.length) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Vui lòng hoàn thiện các trường bắt buộc: ${thieu.join(', ')}.`,
      422,
      { truongThieu: thieu },
    )
  }
  const keyDaCo = new Set(tepDinhKem.map((t) => t.requirementKey).filter(Boolean))
  const thieuTep = rt.giayTo.filter((g) => g.batBuoc && !keyDaCo.has(g.key))
  if (thieuTep.length) {
    throw new ApiError(
      'MISSING_ATTACHMENT',
      `Thiếu giấy tờ bắt buộc: ${thieuTep.map((g) => g.label).join(', ')}.`,
      422,
      { giayToThieu: thieuTep.map((g) => g.key) },
    )
  }
}

export const mockApplicationService = {
  async listMine(query: ApplicationListQuery = {}) {
    const user = currentUser()
    return readOp(() => {
      const mine = db.applications.filter((a) => a.sinhVienId === user.id)
      const filtered = sortApplications(
        mine.filter((a) => matchQuery(a, query)),
        query.sapXep,
      )
      return paginate(filtered, query.page, query.pageSize)
    })
  },

  async recentMine(limit = 5) {
    const user = currentUser()
    return readOp(() =>
      sortApplications(
        db.applications.filter(
          (a) => a.sinhVienId === user.id && a.trangThai !== 'DRAFT',
        ),
      ).slice(0, limit),
    )
  },

  async statsMine(): Promise<MyStats> {
    const user = currentUser()
    return readOp(() => {
      const mine = db.applications.filter((a) => a.sinhVienId === user.id)
      const count = (s: ApplicationStatus) => mine.filter((a) => a.trangThai === s).length
      return {
        nhap: count('DRAFT'),
        dangXuLy: count('SUBMITTED') + count('PENDING_APPROVAL'),
        canBoSung: count('NEED_SUPPLEMENT'),
        hoanThanh: count('COMPLETED'),
        tong: mine.length,
      }
    })
  },

  async getByCode(maHoSo: string): Promise<ApplicationDetail> {
    const user = currentUser()
    return readOp(() => {
      const app = findApplication(maHoSo)
      if (!app) {
        throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      }
      if (!inScope(app, user)) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không có quyền xem hồ sơ này.', 403)
      }
      return buildDetail(app)
    })
  },

  async createDraft(payload: CreateApplicationPayload): Promise<Application> {
    const user = currentUser()
    if (user.role !== 'SINH_VIEN') {
      throw new ApiError('FORBIDDEN_SCOPE', 'Chỉ sinh viên được tạo hồ sơ.', 403)
    }
    return writeOp(() => {
      const rt = findRequestTypeById(payload.requestTypeId)
      if (!rt) throw new ApiError('NOT_FOUND', 'Loại đơn không tồn tại.', 404)
      const wf = findWorkflowById(rt.workflowId)!
      const step1 = wf.steps.find((s) => s.order === 1) ?? null
      const maHoSo = taoMaHoSo()
      const app: Application = {
        id: maHoSo,
        maHoSo,
        requestTypeId: rt.id,
        requestType: {
          id: rt.id,
          ma: rt.ma,
          ten: rt.ten,
          nhom: rt.nhom,
          icon: rt.icon,
          mau: rt.mau,
        },
        sinhVienId: user.id,
        sinhVien: {
          id: user.id,
          maSo: user.maSo,
          hoTen: user.hoTen,
          lop: user.lopTen ?? '',
          khoa: user.donViTen ?? '',
          nganh: user.nganhTen ?? '',
          khoaHoc: user.khoaHoc ?? '',
          email: user.email,
          soDienThoai: user.soDienThoai,
        },
        trangThai: 'DRAFT',
        duLieu: payload.duLieu,
        tepDinhKem: payload.tepDinhKem,
        workflowId: wf.id,
        currentStepOrder: 0,
        buocHienTai: step1,
        tongSoBuoc: wf.steps.length,
        buocDaDuyet: 0,
        lichSu: [],
        ngayTao: new Date().toISOString(),
        ngayCapNhat: new Date().toISOString(),
      }
      db.applications.unshift(app)
      return app
    })
  },

  async updateDraft(maHoSo: string, payload: CreateApplicationPayload) {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      if (app.sinhVienId !== user.id) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không sở hữu hồ sơ này.', 403)
      }
      if (app.trangThai !== 'DRAFT' && app.trangThai !== 'NEED_SUPPLEMENT') {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Chỉ có thể sửa hồ sơ ở trạng thái Bản nháp hoặc Cần bổ sung.',
          409,
        )
      }
      app.duLieu = payload.duLieu
      app.tepDinhKem = payload.tepDinhKem
      app.ngayCapNhat = new Date().toISOString()
      return app
    })
  },

  async deleteDraft(maHoSo: string) {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      if (app.sinhVienId !== user.id) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không sở hữu hồ sơ này.', 403)
      }
      if (!['DRAFT', 'CANCELLED'].includes(app.trangThai)) {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Chỉ có thể xoá hồ sơ ở trạng thái Bản nháp hoặc Đã rút.',
          409,
        )
      }
      db.applications = db.applications.filter((a) => a.id !== app.id)
    })
  },

  async submit(maHoSo: string) {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      if (app.sinhVienId !== user.id) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không sở hữu hồ sơ này.', 403)
      }
      if (app.trangThai !== 'DRAFT') {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Chỉ hồ sơ ở trạng thái Bản nháp mới có thể nộp.',
          409,
        )
      }
      const rt = findRequestTypeById(app.requestTypeId)!
      kiemTraBatBuoc(rt, app.duLieu, app.tepDinhKem)

      const wf = findWorkflowById(app.workflowId)!
      const step1 = wf.steps.find((s) => s.order === 1)!
      const luc = new Date().toISOString()
      app.trangThai = 'SUBMITTED'
      app.ngayNop = luc
      app.ngayCapNhat = luc
      app.currentStepOrder = 0
      app.buocHienTai = step1
      app.hanXuLy = new Date(new Date(luc).getTime() + step1.slaHours * 3_600_000).toISOString()
      app.lichSu.push({
        id: `act_${app.maHoSo}_${app.lichSu.length + 1}`,
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'SUBMIT',
        nguoiThucHienId: user.id,
        nguoiThucHienTen: user.hoTen,
        chucVu: `Sinh viên lớp ${app.sinhVien.lop}`,
        vaiTro: 'SINH_VIEN',
        ghiChu: 'Nộp hồ sơ trực tuyến trên Cổng Một cửa điện tử.',
        luc,
      })
      notifyRole(step1.role, {
        tieuDe: 'Có hồ sơ mới chờ xử lý',
        noiDung: `Sinh viên ${user.hoTen} (${user.maSo}) vừa nộp hồ sơ ${app.maHoSo} — ${rt.ten}.`,
        loai: 'INFO',
        applicationId: app.id,
        maHoSo: app.maHoSo,
        lienKet: '/quan-ly/cho-duyet',
      })
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'SUBMIT_APPLICATION',
        doiTuong: 'Hồ sơ một cửa',
        doiTuongId: app.maHoSo,
        giaTriTruoc: 'Bản nháp',
        giaTriSau: 'Đã nộp',
      })
      return app
    })
  },

  async cancel(maHoSo: string, lyDo?: string) {
    const user = currentUser()
    return writeOp(() => cancelApplication(findApplication(maHoSo)!, user, lyDo))
  },

  async supplement(
    maHoSo: string,
    input: { duLieu?: Record<string, unknown>; tepDinhKem?: Attachment[]; ghiChu?: string },
  ) {
    const user = currentUser()
    return writeOp(() => supplementApplication(findApplication(maHoSo)!, user, input))
  },

  async listForApproval(query: ApplicationListQuery = {}) {
    const user = currentUser()
    return readOp(() => {
      const pending = db.applications
        .filter((a) => inScope(a, user) && isWaitingAt(a, user))
        .filter((a) => matchQuery(a, query))
      const sorted = sortApplications(
        pending,
        query.sapXep ?? 'HAN_GAN_NHAT',
      )
      return paginate(sorted, query.page, query.pageSize)
    })
  },

  async listProcessed(query: ApplicationListQuery = {}) {
    const user = currentUser()
    return readOp(() => {
      const acted = db.applications.filter(
        (a) =>
          inScope(a, user) &&
          a.lichSu.some(
            (h) =>
              h.nguoiThucHienId === user.id &&
              ['APPROVE', 'REJECT', 'REQUEST_SUPPLEMENT', 'ISSUE_DOCUMENT'].includes(h.hanhDong),
          ),
      )
      const filtered = acted.filter((a) => matchQuery(a, query))
      return paginate(
        sortApplications(filtered, query.sapXep ?? 'MOI_NHAT'),
        query.page,
        query.pageSize,
      )
    })
  },

  async statsApproval(): Promise<ApprovalStats> {
    const user = currentUser()
    return readOp(() => {
      const pending = db.applications.filter((a) => inScope(a, user) && isWaitingAt(a, user))
      const scoped = scopeApplications(user)
      const demHan = (muc: 'SAP_HET_HAN' | 'QUA_HAN') =>
        scoped.filter(
          (a) =>
            (a.trangThai === 'PENDING_APPROVAL' || a.trangThai === 'SUBMITTED') &&
            slaText(a.hanXuLy).mucDo === muc,
        ).length

      const tuanNay = Date.now() - 7 * 86_400_000
      const daXuLyTuanNay = scoped.filter((a) =>
        a.lichSu.some(
          (h) =>
            h.nguoiThucHienId === user.id &&
            new Date(h.luc).getTime() >= tuanNay &&
            ['APPROVE', 'REJECT', 'REQUEST_SUPPLEMENT'].includes(h.hanhDong),
        ),
      ).length

      const trangThaiList: ApplicationStatus[] = [
        'DRAFT',
        'SUBMITTED',
        'PENDING_APPROVAL',
        'NEED_SUPPLEMENT',
        'REJECTED',
        'COMPLETED',
        'CANCELLED',
      ]
      const nhan: Record<ApplicationStatus, string> = {
        DRAFT: 'Bản nháp',
        SUBMITTED: 'Đã nộp',
        PENDING_APPROVAL: 'Đang chờ duyệt',
        NEED_SUPPLEMENT: 'Cần bổ sung',
        REJECTED: 'Từ chối',
        COMPLETED: 'Hoàn thành',
        CANCELLED: 'Đã rút',
      }

      const theoLoaiDon = db.requestTypes.map((rt) => ({
        ten: rt.ma,
        soLuong: scoped.filter((a) => a.requestTypeId === rt.id).length,
      }))

      const theoKhoaMap = new Map<string, number>()
      scoped.forEach((a) => {
        theoKhoaMap.set(a.sinhVien.khoa, (theoKhoaMap.get(a.sinhVien.khoa) ?? 0) + 1)
      })

      const xuHuong7Ngay = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(Date.now() - (6 - i) * 86_400_000)
        const key = day.toISOString().slice(0, 10)
        const nop = scoped.filter((a) => (a.ngayNop ?? '').slice(0, 10) === key).length
        const duyet = scoped.filter((a) =>
          a.lichSu.some(
            (h) => h.hanhDong === 'APPROVE' && h.luc.slice(0, 10) === key,
          ),
        ).length
        return { ngay: `${day.getDate()}/${day.getMonth() + 1}`, nop, duyet }
      })

      return {
        choToiDuyet: pending.length,
        sapHetHan: demHan('SAP_HET_HAN'),
        quaHan: demHan('QUA_HAN'),
        daXuLyTuanNay,
        theoTrangThai: trangThaiList.map((s) => ({
          trangThai: s,
          nhan: nhan[s],
          soLuong: scoped.filter((a) => a.trangThai === s).length,
        })),
        theoLoaiDon,
        theoKhoa: [...theoKhoaMap.entries()].map(([ten, soLuong]) => ({ ten, soLuong })),
        xuHuong7Ngay,
      }
    })
  },

  async listOverdue(limit = 5) {
    const user = currentUser()
    return readOp(() =>
      db.applications
        .filter(
          (a) =>
            inScope(a, user) &&
            ['PENDING_APPROVAL', 'SUBMITTED'].includes(a.trangThai) &&
            slaText(a.hanXuLy).mucDo !== 'BINH_THUONG',
        )
        .sort((a, b) => (a.hanXuLy ?? '').localeCompare(b.hanXuLy ?? ''))
        .slice(0, limit),
    )
  },

  async requestTypes() {
    return readOp(() => db.requestTypes.filter((r) => r.hoatDong))
  },

  async allowedRequestTypes(userId: string) {
    return readOp(() => {
      const user = db.users.find((u) => u.id === userId)
      if (!user) return []
      return db.requestTypes.filter((r) => r.hoatDong)
    })
  },

  async nextApproverRoles(maHoSo: string): Promise<Role[]> {
    return readOp(() => {
      const app = findApplication(maHoSo)
      if (!app?.buocHienTai) return []
      return [app.buocHienTai.role]
    })
  },

  /** Dùng nội bộ cho trang xem văn bản: chữ ký đã thu thập của hồ sơ. */
  async getSignatures(maHoSo: string) {
    return readOp(() => signaturesOf(findApplication(maHoSo)?.id ?? maHoSo))
  },
}
