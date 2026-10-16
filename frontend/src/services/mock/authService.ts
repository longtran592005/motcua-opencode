import { ApiError, type LoginPayload, type Role, type Session, type User } from '@/types'
import { DEMO_PASSWORD, findUserByDinhDanh } from './data/users'
import { mockDelay } from './helpers'
import { addAudit, db } from './store'
import type { AuthService } from '../contracts/auth'

const SESSION_KEY = 'motcua.session.userId'

function makeSession(user: User): Session {
  return {
    token: `mock-token-${user.id}-${Date.now().toString(36)}`,
    user,
    hetHan: new Date(Date.now() + 8 * 3_600_000).toISOString(),
  }
}

/** Khôi phục phiên từ lần tải trước (giữ đăng nhập khi F5). */
export function restoreSession(): User | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const user = db.users.find((u) => u.id === id) ?? null
    db.currentUser = user
    return user
  } catch {
    return null
  }
}

function persist(user: User | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, user.id)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* bỏ qua khi trình duyệt chặn localStorage */
  }
}

export const mockAuthService: AuthService = {
  async login(payload: LoginPayload) {
    await mockDelay()
    const user = findUserByDinhDanh(payload.dinhDanh)
    const matKhauDung =
      payload.matKhau === DEMO_PASSWORD ||
      (user?.maSo.toLowerCase() === payload.dinhDanh.trim().toLowerCase() &&
        payload.matKhau === DEMO_PASSWORD)
    if (!user || !matKhauDung) {
      throw new ApiError(
        'UNAUTHORIZED',
        'Mã số/email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.',
        401,
      )
    }
    if (user.trangThai === 'LOCKED') {
      throw new ApiError(
        'UNAUTHORIZED',
        'Tài khoản đang bị tạm khoá. Vui lòng liên hệ Phòng Đào tạo.',
        403,
      )
    }
    db.currentUser = user
    persist(user)
    addAudit({
      nguoiThucHien: user,
      hanhDong: 'LOGIN',
      doiTuong: 'Phiên đăng nhập',
      doiTuongId: user.maSo,
    })
    return makeSession(user)
  },

  async quickLogin(role: Role) {
    await mockDelay()
    const user = db.users.find((u) => u.role === role)
    if (!user) {
      throw new ApiError('NOT_FOUND', 'Không tìm thấy tài khoản demo cho vai trò này.', 404)
    }
    db.currentUser = user
    persist(user)
    return makeSession(user)
  },

  async me() {
    await mockDelay()
    const user = db.currentUser ?? restoreSession()
    if (!user) {
      throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
    }
    return user
  },

  async logout() {
    await mockDelay()
    const user = db.currentUser
    if (user) {
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'LOGOUT',
        doiTuong: 'Phiên đăng nhập',
        doiTuongId: user.maSo,
      })
    }
    db.currentUser = null
    persist(null)
  },

  async updateProfile(patch: Partial<User>) {
    await mockDelay()
    const user = db.currentUser
    if (!user) throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
    Object.assign(user, patch, { id: user.id, role: user.role })
    addAudit({
      nguoiThucHien: user,
      hanhDong: 'UPDATE_USER',
      doiTuong: 'Hồ sơ cá nhân',
      doiTuongId: user.maSo,
      giaTriSau: Object.keys(patch).join(', '),
    })
    return { ...user }
  },
}
