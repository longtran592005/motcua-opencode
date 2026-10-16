import {
  ApiError,
  type RequestType,
  type User,
  type Workflow,
} from '@/types'
import { clone, paginate, readOp, writeOp } from './helpers'
import { addAudit, db, nextSeq } from './store'
import type { CrudService, CatalogService, RequestTypeService, UserService, WorkflowService } from '../contracts/catalog'

function currentUser(): User {
  const user = db.currentUser
  if (!user) throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
  return user
}

function requireAdmin(): User {
  const user = currentUser()
  if (user.role !== 'ADMIN') {
    throw new ApiError('FORBIDDEN_SCOPE', 'Chức năng chỉ dành cho quản trị viên.', 403)
  }
  return user
}

function crud<T extends { id: string }>(
  items: () => T[],
  prefix: string,
  doiTuong: string,
): CrudService<T> {
  return {
    async list() {
      return readOp(() => clone(items()))
    },
    async create(input) {
      const user = requireAdmin()
      return writeOp(() => {
        const entity = { ...(input as object), id: `${prefix}_${nextSeq('entity')}` } as T
        items().unshift(entity)
        addAudit({
          nguoiThucHien: user,
          hanhDong: `CREATE_${prefix.toUpperCase()}`,
          doiTuong,
          doiTuongId: entity.id,
          giaTriSau: 'Tạo mới',
        })
        return clone(entity)
      })
    },
    async update(id, patch) {
      const user = requireAdmin()
      return writeOp(() => {
        const entity = items().find((x) => x.id === id)
        if (!entity) throw new ApiError('NOT_FOUND', `Không tìm thấy ${doiTuong.toLowerCase()}.`, 404)
        const truoc = JSON.stringify(entity).slice(0, 120)
        Object.assign(entity, patch, { id })
        addAudit({
          nguoiThucHien: user,
          hanhDong: `UPDATE_${prefix.toUpperCase()}`,
          doiTuong,
          doiTuongId: id,
          giaTriTruoc: truoc,
          giaTriSau: JSON.stringify(entity).slice(0, 120),
        })
        return clone(entity)
      })
    },
    async remove(id) {
      const user = requireAdmin()
      return writeOp(() => {
        const arr = items()
        const index = arr.findIndex((x) => x.id === id)
        if (index < 0) throw new ApiError('NOT_FOUND', `Không tìm thấy ${doiTuong.toLowerCase()}.`, 404)
        arr.splice(index, 1)
        addAudit({
          nguoiThucHien: user,
          hanhDong: `DELETE_${prefix.toUpperCase()}`,
          doiTuong,
          doiTuongId: id,
          giaTriTruoc: 'Tồn tại',
          giaTriSau: 'Đã xoá',
        })
      })
    },
  }
}

export const mockCatalogService: CatalogService = {
  khoa: crud(() => db.khoa, 'k', 'Khoa'),
  phongBan: crud(() => db.phongBan, 'p', 'Phòng ban'),
  nganh: crud(() => db.nganh, 'n', 'Ngành'),
  lop: crud(() => db.lop, 'l', 'Lớp'),
  khoaHoc: crud(() => db.khoaHoc, 'kh', 'Khóa học'),
}

export const mockRequestTypeService: RequestTypeService = {
  async list() {
    return readOp(() => clone(db.requestTypes))
  },
  async listActive() {
    return readOp(() => clone(db.requestTypes.filter((r) => r.hoatDong)))
  },
  async get(id) {
    return readOp(() => {
      const rt = db.requestTypes.find((r) => r.id === id)
      if (!rt) throw new ApiError('NOT_FOUND', 'Không tìm thấy loại đơn.', 404)
      return clone(rt)
    })
  },
  async create(input) {
    const user = requireAdmin()
    return writeOp(() => {
      if (!input.ten.trim() || !input.ma.trim()) {
        throw new ApiError('VALIDATION_ERROR', 'Mã và tên loại đơn không được để trống.', 422)
      }
      if (!input.formFields.length) {
        throw new ApiError('VALIDATION_ERROR', 'Biểu mẫu cần có ít nhất một trường thông tin.', 422)
      }
      if (!input.workflowId) {
        throw new ApiError('VALIDATION_ERROR', 'Vui lòng chọn luồng duyệt cho loại đơn.', 422)
      }
      const rt: RequestType = {
        ...input,
        id: `rt_${nextSeq('entity')}`,
        formFields: input.formFields.map((f, i) => ({ ...f, order: i + 1 })),
        soLuotNop: 0,
      }
      db.requestTypes.push(rt)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'CREATE_REQUEST_TYPE',
        doiTuong: 'Loại đơn',
        doiTuongId: rt.ma,
        giaTriSau: rt.ten,
      })
      return clone(rt)
    })
  },
  async update(id, patch) {
    const user = requireAdmin()
    return writeOp(() => {
      const rt = db.requestTypes.find((r) => r.id === id)
      if (!rt) throw new ApiError('NOT_FOUND', 'Không tìm thấy loại đơn.', 404)
      const truoc = `${rt.ma} — ${rt.ten}`
      Object.assign(rt, patch, { id })
      if (patch.formFields) {
        rt.formFields = patch.formFields.map((f, i) => ({ ...f, order: i + 1 }))
      }
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_REQUEST_TYPE',
        doiTuong: 'Loại đơn',
        doiTuongId: rt.ma,
        giaTriTruoc: truoc,
        giaTriSau: `${rt.ma} — ${rt.ten}`,
      })
      return clone(rt)
    })
  },
  async remove(id) {
    const user = requireAdmin()
    return writeOp(() => {
      const rt = db.requestTypes.find((r) => r.id === id)
      if (!rt) throw new ApiError('NOT_FOUND', 'Không tìm thấy loại đơn.', 404)
      const dangCo = db.applications.some(
        (a) => a.requestTypeId === id && a.trangThai !== 'COMPLETED',
      )
      if (dangCo) {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Loại đơn đang có hồ sơ chưa hoàn thành, không thể xoá. Hãy chuyển sang trạng thái ngừng hoạt động.',
          409,
        )
      }
      db.requestTypes = db.requestTypes.filter((r) => r.id !== id)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'DELETE_REQUEST_TYPE',
        doiTuong: 'Loại đơn',
        doiTuongId: rt.ma,
        giaTriTruoc: 'Tồn tại',
        giaTriSau: 'Đã xoá',
      })
    })
  },
  async stats() {
    return readOp(() =>
      db.requestTypes.map((rt) => ({
        requestTypeId: rt.id,
        ten: rt.ten,
        ma: rt.ma,
        soLuong: db.applications.filter((a) => a.requestTypeId === rt.id).length,
      })),
    )
  },
}

export const mockWorkflowService: WorkflowService = {
  async list() {
    return readOp(() => clone(db.workflows))
  },
  async get(id) {
    return readOp(() => {
      const wf = db.workflows.find((w) => w.id === id)
      if (!wf) throw new ApiError('NOT_FOUND', 'Không tìm thấy luồng duyệt.', 404)
      return clone(wf)
    })
  },
  async create(input) {
    const user = requireAdmin()
    return writeOp(() => {
      const wf: Workflow = {
        ...input,
        id: `wf_${nextSeq('entity')}`,
        steps: input.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({ ...s, order: i + 1 })),
        capDo: Math.min(3, Math.max(1, input.steps.length)) as 1 | 2 | 3,
      }
      db.workflows.push(wf)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_WORKFLOW',
        doiTuong: 'Luồng duyệt',
        doiTuongId: wf.ma,
        giaTriSau: `Tạo mới ${wf.steps.length} bước`,
      })
      return clone(wf)
    })
  },
  async update(id, patch) {
    const user = requireAdmin()
    return writeOp(() => {
      const wf = db.workflows.find((w) => w.id === id)
      if (!wf) throw new ApiError('NOT_FOUND', 'Không tìm thấy luồng duyệt.', 404)
      const truoc = `${wf.steps.length} bước`
      Object.assign(wf, patch, { id })
      if (patch.steps) {
        wf.steps = patch.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((s, i) => ({ ...s, order: i + 1 }))
        wf.capDo = Math.min(3, Math.max(1, wf.steps.length)) as 1 | 2 | 3
      }
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_WORKFLOW',
        doiTuong: 'Luồng duyệt',
        doiTuongId: wf.ma,
        giaTriTruoc: truoc,
        giaTriSau: `${wf.steps.length} bước`,
      })
      return clone(wf)
    })
  },
  async remove(id) {
    const user = requireAdmin()
    return writeOp(() => {
      const dangDung = db.requestTypes.some((r) => r.workflowId === id)
      if (dangDung) {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Luồng duyệt đang được áp dụng cho một loại đơn.',
          409,
        )
      }
      const wf = db.workflows.find((w) => w.id === id)
      if (!wf) throw new ApiError('NOT_FOUND', 'Không tìm thấy luồng duyệt.', 404)
      db.workflows = db.workflows.filter((w) => w.id !== id)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_WORKFLOW',
        doiTuong: 'Luồng duyệt',
        doiTuongId: wf.ma,
        giaTriTruoc: 'Tồn tại',
        giaTriSau: 'Đã xoá',
      })
    })
  },
  async validate(workflow) {
    return readOp(() => {
      const canhBao: string[] = []
      const steps = workflow.steps.slice().sort((a, b) => a.order - b.order)
      if (!steps.length) canhBao.push('Luồng duyệt cần có ít nhất một bước.')
      steps.forEach((s, i) => {
        if (s.order !== i + 1) canhBao.push(`Thứ tự bước ${i + 1} không liên tục.`)
        if (s.slaHours <= 0) canhBao.push(`Bước "${s.ten}" chưa có thời hạn SLA hợp lệ.`)
      })
      if (!steps.some((s) => s.mode === 'OTP')) {
        canhBao.push('Nên có ít nhất một bước Ký OTP để đảm bảo tính pháp lý của văn bản.')
      }
      const roles = steps.map((s) => s.role)
      if (new Set(roles).size !== roles.length) {
        canhBao.push('Một vai trò đang xuất hiện ở nhiều bước; hãy đảm bảo điều này là chủ đích.')
      }
      return { hopLe: canhBao.length === 0, canhBao }
    })
  },
}

export const mockUserService: UserService = {
  async list(query = {}) {
    return readOp(() => {
      let items = [...db.users]
      if (query.vaiTro && query.vaiTro !== 'ALL') {
        items = items.filter((u) => u.role === query.vaiTro)
      }
      if (query.trangThai && query.trangThai !== 'ALL') {
        items = items.filter((u) => u.trangThai === query.trangThai)
      }
      if (query.donViId) items = items.filter((u) => u.donViId === query.donViId)
      if (query.tuKhoa) {
        const k = query.tuKhoa.toLowerCase()
        items = items.filter(
          (u) =>
            u.hoTen.toLowerCase().includes(k) ||
            u.maSo.toLowerCase().includes(k) ||
            u.email.toLowerCase().includes(k),
        )
      }
      return paginate(clone(items), query.page, query.pageSize)
    })
  },
  async get(id) {
    return readOp(() => {
      const u = db.users.find((x) => x.id === id)
      if (!u) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', 404)
      return clone(u)
    })
  },
  async create(input) {
    const admin = requireAdmin()
    return writeOp(() => {
      if (db.users.some((u) => u.maSo.toLowerCase() === input.maSo.toLowerCase())) {
        throw new ApiError('VALIDATION_ERROR', 'Mã số này đã tồn tại.', 422)
      }
      const user: User = { ...input, id: `u_${nextSeq('entity')}` }
      db.users.push(user)
      addAudit({
        nguoiThucHien: admin,
        hanhDong: 'UPDATE_USER',
        doiTuong: 'Người dùng',
        doiTuongId: user.maSo,
        giaTriSau: `Tạo mới — ${user.role}`,
      })
      return clone(user)
    })
  },
  async update(id, patch) {
    const admin = requireAdmin()
    return writeOp(() => {
      const u = db.users.find((x) => x.id === id)
      if (!u) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', 404)
      const truoc = `Vai trò: ${u.role}, trạng thái: ${u.trangThai}`
      Object.assign(u, patch, { id })
      addAudit({
        nguoiThucHien: admin,
        hanhDong: 'UPDATE_USER',
        doiTuong: 'Người dùng',
        doiTuongId: u.maSo,
        giaTriTruoc: truoc,
        giaTriSau: `Vai trò: ${u.role}, trạng thái: ${u.trangThai}`,
      })
      return clone(u)
    })
  },
  async remove(id) {
    const admin = requireAdmin()
    return writeOp(() => {
      const u = db.users.find((x) => x.id === id)
      if (!u) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', 404)
      if (u.role === 'ADMIN') {
        throw new ApiError('FORBIDDEN_SCOPE', 'Không thể xoá tài khoản quản trị.', 403)
      }
      db.users = db.users.filter((x) => x.id !== id)
      addAudit({
        nguoiThucHien: admin,
        hanhDong: 'UPDATE_USER',
        doiTuong: 'Người dùng',
        doiTuongId: u.maSo,
        giaTriTruoc: 'Tồn tại',
        giaTriSau: 'Đã xoá',
      })
    })
  },
  async resetPassword(id) {
    const admin = requireAdmin()
    return writeOp(() => {
      const u = db.users.find((x) => x.id === id)
      if (!u) throw new ApiError('NOT_FOUND', 'Không tìm thấy người dùng.', 404)
      const matKhauTam = `Tbu@${Math.floor(100000 + Math.random() * 899999)}`
      addAudit({
        nguoiThucHien: admin,
        hanhDong: 'UPDATE_USER',
        doiTuong: 'Người dùng',
        doiTuongId: u.maSo,
        giaTriSau: 'Đặt lại mật khẩu',
      })
      return { matKhauTam }
    })
  },
  async advisors() {
    return readOp(() => clone(db.users.filter((u) => u.role === 'CO_VAN')))
  },
}
