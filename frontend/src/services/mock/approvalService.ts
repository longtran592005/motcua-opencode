import { ApiError, type ApplicationDetail, type Role, type User } from '@/types'
import { MOCK_OTP_CODE, OTP_CONFIG } from '@/lib/constants'
import { readOp, writeOp } from './helpers'
import { approveApplication, rejectApplication, requestSupplement } from './domain'
import {
  addAudit,
  buildDetail,
  db,
  findApplication,
  isWaitingAt,
  nextSeq,
} from './store'
import type { ApprovalService, BatchApproveResult, OtpChallenge, OtpService } from '../contracts/approval'
import type { DelegationService } from '../contracts/approval'
import type { Delegation } from '../contracts/delegation'

function currentUser(): User {
  const user = db.currentUser
  if (!user) throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
  return user
}

/* =============================== OTP =============================== */
interface ChallengeState {
  id: string
  maHoSo: string
  nguoiDungId: string
  ma: string
  hetHanLuc: number
  choGuiLaiLuc: number
  soLanSai: number
  khoaDenLuc?: number
}

const challenges = new Map<string, ChallengeState>()

function toChallenge(s: ChallengeState): OtpChallenge {
  const now = Date.now()
  return {
    challengeId: s.id,
    hetHanLuc: new Date(s.hetHanLuc).toISOString(),
    conLaiGiay: Math.max(0, Math.round((s.hetHanLuc - now) / 1000)),
    choGuiLaiGiay: Math.max(0, Math.round((s.choGuiLaiLuc - now) / 1000)),
    soLanConLai: Math.max(0, OTP_CONFIG.soLanSaiToiDa - s.soLanSai),
    khoaDenLuc: s.khoaDenLuc ? new Date(s.khoaDenLuc).toISOString() : undefined,
  }
}

function taoChallenge(maHoSo: string, user: User): ChallengeState {
  const now = Date.now()
  const state: ChallengeState = {
    id: `otp_${nextSeq('signature')}`,
    maHoSo,
    nguoiDungId: user.id,
    // Bản mock chấp nhận mã cố định; hệ thống thật sinh mã ngẫu nhiên và gửi qua SMS/email.
    ma: MOCK_OTP_CODE,
    hetHanLuc: now + OTP_CONFIG.hanSuDungGiay * 1000,
    choGuiLaiLuc: now + OTP_CONFIG.choGuiLaiGiay * 1000,
    soLanSai: 0,
  }
  challenges.set(state.id, state)
  return state
}

function kiemTraOtp(challengeId: string, otp: string, user: User): void {
  const state = challenges.get(challengeId)
  const now = Date.now()
  if (!state || state.nguoiDungId !== user.id) {
    throw new ApiError('OTP_EXPIRED', 'Mã OTP không tồn tại hoặc đã hết hiệu lực.', 410)
  }
  if (state.khoaDenLuc && now < state.khoaDenLuc) {
    throw new ApiError(
      'OTP_LOCKED',
      `Bạn đã nhập sai quá ${OTP_CONFIG.soLanSaiToiDa} lần. Vui lòng thử lại sau.`,
      423,
      { khoaDenLuc: new Date(state.khoaDenLuc).toISOString() },
    )
  }
  if (now > state.hetHanLuc) {
    throw new ApiError(
      'OTP_EXPIRED',
      'Mã OTP đã hết hiệu lực. Vui lòng gửi lại mã mới.',
      410,
    )
  }
  if (otp.trim() !== state.ma) {
    state.soLanSai += 1
    const conLai = OTP_CONFIG.soLanSaiToiDa - state.soLanSai
    if (conLai <= 0) {
      state.khoaDenLuc = now + OTP_CONFIG.thoiGianKhoaPhut * 60_000
      throw new ApiError(
        'OTP_LOCKED',
        `Bạn đã nhập sai quá ${OTP_CONFIG.soLanSaiToiDa} lần. Chức năng ký bị tạm khoá ${OTP_CONFIG.thoiGianKhoaPhut} phút.`,
        423,
        { khoaDenLuc: new Date(state.khoaDenLuc).toISOString() },
      )
    }
    throw new ApiError(
      'OTP_INVALID',
      `Mã OTP không đúng. Bạn còn ${conLai} lần thử.`,
      400,
      { soLanConLai: conLai },
    )
  }
  challenges.delete(challengeId)
}

export const mockOtpService: OtpService = {
  async gui(maHoSo: string) {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      if (!isWaitingAt(app, user)) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Hồ sơ không thuộc cấp xử lý của bạn.', 403)
      }
      if (app.buocHienTai?.mode !== 'OTP') {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Bước duyệt hiện tại không yêu cầu ký OTP.',
          409,
        )
      }
      const state = taoChallenge(maHoSo, user)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'SIGN_OTP_SENT',
        doiTuong: 'Hồ sơ một cửa',
        doiTuongId: maHoSo,
        giaTriSau: 'Đã gửi mã OTP',
      })
      return toChallenge(state)
    })
  },

  async guiLai(challengeId: string) {
    const user = currentUser()
    return writeOp(() => {
      const state = challenges.get(challengeId)
      if (!state || state.nguoiDungId !== user.id) {
        // Phiên cũ đã mất: cấp mã mới cho hồ sơ gần nhất của người dùng.
        throw new ApiError('OTP_EXPIRED', 'Phiên ký đã hết hiệu lực.', 410)
      }
      if (Date.now() < state.choGuiLaiLuc) {
        throw new ApiError(
          'VALIDATION_ERROR',
          `Vui lòng chờ ${toChallenge(state).choGuiLaiGiay} giây trước khi gửi lại mã.`,
          429,
        )
      }
      const now = Date.now()
      state.hetHanLuc = now + OTP_CONFIG.hanSuDungGiay * 1000
      state.choGuiLaiLuc = now + OTP_CONFIG.choGuiLaiGiay * 1000
      state.soLanSai = 0
      state.khoaDenLuc = undefined
      state.ma = MOCK_OTP_CODE
      return toChallenge(state)
    })
  },

  async trangThai(challengeId: string) {
    const user = currentUser()
    return readOp(() => {
      const state = challenges.get(challengeId)
      if (!state || state.nguoiDungId !== user.id) {
        throw new ApiError('OTP_EXPIRED', 'Phiên ký đã hết hiệu lực.', 410)
      }
      return toChallenge(state)
    })
  },
}

/* ============================ PHÊ DUYỆT ============================ */
export const mockApprovalService: ApprovalService = {
  async approve(input): Promise<ApplicationDetail> {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(input.maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      const step = app.buocHienTai
      if (step?.mode === 'OTP') {
        if (!input.challengeId || !input.otp) {
          throw new ApiError(
            'OTP_INVALID',
            'Bước duyệt này yêu cầu ký OTP. Vui lòng nhập mã xác thực.',
            400,
          )
        }
        kiemTraOtp(input.challengeId, input.otp, user)
      }
      approveApplication(app, user, {
        ghiChu: input.ghiChu,
        phuongThuc: step?.mode === 'OTP' ? 'OTP' : 'ONE_CLICK',
      })
      return buildDetail(app)
    })
  },

  async reject(maHoSo, lyDo): Promise<ApplicationDetail> {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      rejectApplication(app, user, lyDo)
      return buildDetail(app)
    })
  },

  async requestSupplement(maHoSo, noiDung): Promise<ApplicationDetail> {
    const user = currentUser()
    return writeOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      requestSupplement(app, user, noiDung)
      return buildDetail(app)
    })
  },

  async approveBatch(maHoSoList: string[], ghiChu?: string): Promise<BatchApproveResult> {
    const user = currentUser()
    return writeOp(() => {
      const result: BatchApproveResult = { thanhCong: [], thatBai: [] }
      maHoSoList.forEach((maHoSo) => {
        const app = findApplication(maHoSo)
        if (!app) {
          result.thatBai.push({ maHoSo, maLoi: 'NOT_FOUND', lyDo: 'Không tìm thấy hồ sơ.' })
          return
        }
        if (app.buocHienTai?.mode === 'OTP') {
          result.thatBai.push({
            maHoSo,
            maLoi: 'INVALID_TRANSITION',
            lyDo: 'Bước duyệt yêu cầu ký OTP, không hỗ trợ duyệt hàng loạt.',
          })
          return
        }
        try {
          approveApplication(app, user, { ghiChu, phuongThuc: 'ONE_CLICK' })
          result.thanhCong.push(maHoSo)
        } catch (err) {
          const e = err as ApiError
          result.thatBai.push({
            maHoSo,
            maLoi: e.code ?? 'UNKNOWN',
            lyDo: e.message ?? 'Không xử lý được hồ sơ.',
          })
        }
      })
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'APPROVE_APPLICATION',
        doiTuong: 'Duyệt hàng loạt',
        doiTuongId: `${result.thanhCong.length} hồ sơ`,
        giaTriSau: result.thanhCong.join(', ') || 'Không có hồ sơ nào được duyệt',
      })
      return result
    })
  },

  async pendingCount() {
    const user = currentUser()
    return readOp(
      () => db.applications.filter((a) => isWaitingAt(a, user)).length,
    )
  },
}

/* ============================ ỦY QUYỀN ============================ */
export const mockDelegationService: DelegationService = {
  async list() {
    const user = currentUser()
    return readOp(() =>
      db.delegations.filter(
        (d) =>
          user.role === 'ADMIN' ||
          d.nguoiUyQuyenId === user.id ||
          d.nguoiNhanId === user.id,
      ),
    )
  },

  async create(input) {
    const user = currentUser()
    return writeOp(() => {
      const nhan = db.users.find((u) => u.id === input.nguoiNhanId)
      if (!nhan) throw new ApiError('NOT_FOUND', 'Không tìm thấy người nhận ủy quyền.', 404)
      if (new Date(input.denNgay) <= new Date(input.tuNgay)) {
        throw new ApiError('VALIDATION_ERROR', 'Ngày kết thúc phải sau ngày bắt đầu.', 422)
      }
      if (!input.lyDo.trim()) {
        throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do ủy quyền.', 422)
      }
      const delegation: Delegation = {
        id: `uq_${nextSeq('entity')}`,
        nguoiUyQuyenId: user.id,
        nguoiUyQuyenTen: user.hoTen,
        nguoiNhanId: nhan.id,
        nguoiNhanTen: nhan.hoTen,
        vaiTro: input.vaiTro,
        tuNgay: input.tuNgay,
        denNgay: input.denNgay,
        lyDo: input.lyDo,
        hieuLuc: true,
        taoLuc: new Date().toISOString(),
      }
      db.delegations.unshift(delegation)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'DELEGATE_APPROVAL',
        doiTuong: 'Ủy quyền duyệt',
        doiTuongId: delegation.id,
        giaTriSau: `${nhan.hoTen} nhận ủy quyền ${input.vaiTro}`,
      })
      return delegation
    })
  },

  async cancel(id: string) {
    const user = currentUser()
    return writeOp(() => {
      const d = db.delegations.find((x) => x.id === id)
      if (!d) throw new ApiError('NOT_FOUND', 'Không tìm thấy bản ghi ủy quyền.', 404)
      if (user.role !== 'ADMIN' && d.nguoiUyQuyenId !== user.id) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không thể huỷ ủy quyền này.', 403)
      }
      d.hieuLuc = false
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'DELEGATE_APPROVAL',
        doiTuong: 'Ủy quyền duyệt',
        doiTuongId: d.id,
        giaTriTruoc: 'Đang hiệu lực',
        giaTriSau: 'Đã huỷ',
      })
    })
  },

  async eligibleUsers(vaiTro: Role) {
    return readOp(() =>
      db.users.filter((u) => u.role === vaiTro && u.trangThai === 'ACTIVE'),
    )
  },
}
