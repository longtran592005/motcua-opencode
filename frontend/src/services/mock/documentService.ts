import {
  ApiError,
  type DocumentTemplate,
  type SignedDocument,
  type User,
  type VerifyResult,
} from '@/types'
import { renderTemplate } from '@/lib/template'
import { clone, nowIso, paginate, readOp, writeOp } from './helpers'
import { revokeDocument } from './domain'
import { addAudit, db, findApplication, inScope, nextSeq } from './store'
import type {
  AvgStepDuration,
  DocumentListQuery,
  ReportOverview,
  ReportRow,
} from '../contracts/document'
import type { DocumentService, TemplateService, VerifyService } from '../contracts/document'

function currentUser(): User {
  const user = db.currentUser
  if (!user) throw new ApiError('UNAUTHORIZED', 'Phiên làm việc đã hết hạn.', 401)
  return user
}

function scopedDocuments(user: User): SignedDocument[] {
  if (user.role === 'SINH_VIEN') {
    return db.documents.filter((d) => {
      const app = findApplication(d.applicationId)
      return !!app && app.sinhVienId === user.id
    })
  }
  return db.documents.filter((d) => {
    const app = findApplication(d.applicationId)
    return !!app && inScope(app, user)
  })
}

function row(ten: string, soLuong: number, total: number): ReportRow {
  return { ten, soLuong, tyLe: total ? Math.round((soLuong / total) * 1000) / 10 : 0 }
}

export const mockDocumentService: DocumentService = {
  async getByApplication(maHoSo: string) {
    const user = currentUser()
    return readOp(() => {
      const app = findApplication(maHoSo)
      if (!app) throw new ApiError('NOT_FOUND', 'Không tìm thấy hồ sơ.', 404)
      if (!inScope(app, user)) {
        throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không có quyền xem văn bản này.', 403)
      }
      const doc = db.documents.find((d) => d.applicationId === app.id)
      if (!doc) {
        throw new ApiError(
          'NOT_FOUND',
          'Hồ sơ chưa hoàn thành nên chưa có văn bản được cấp.',
          404,
        )
      }
      return clone(doc)
    })
  },

  async listIssued(query: DocumentListQuery = {}) {
    const user = currentUser()
    return readOp(() => {
      let items = scopedDocuments(user)
      if (query.trangThai && query.trangThai !== 'ALL') {
        items = items.filter((d) => d.trangThai === query.trangThai)
      }
      if (query.loaiVanBan) items = items.filter((d) => d.loaiVanBan === query.loaiVanBan)
      if (query.khoa) items = items.filter((d) => d.sinhVien.khoa === query.khoa)
      if (query.tuKhoa) {
        const k = query.tuKhoa.toLowerCase()
        items = items.filter(
          (d) =>
            d.soVanBan.toLowerCase().includes(k) ||
            d.maHoSo.toLowerCase().includes(k) ||
            d.sinhVien.hoTen.toLowerCase().includes(k) ||
            d.sinhVien.mssv.includes(k),
        )
      }
      if (query.tuNgay) items = items.filter((d) => d.ngayCap >= query.tuNgay!)
      if (query.denNgay) items = items.filter((d) => d.ngayCap <= query.denNgay!)
      const sorted = [...items].sort((a, b) => b.ngayCap.localeCompare(a.ngayCap))
      const page = paginate(sorted, query.page, query.pageSize).items
      return { ...paginate(sorted, query.page, query.pageSize), items: clone(page) }
    })
  },

  async revoke(id: string, lyDo: string) {
    const user = currentUser()
    if (user.role !== 'ADMIN' && user.role !== 'PHONG_DAO_TAO') {
      throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không có quyền thu hồi văn bản.', 403)
    }
    return writeOp(() => {
      const doc = db.documents.find((d) => d.id === id)
      if (!doc) throw new ApiError('NOT_FOUND', 'Không tìm thấy văn bản.', 404)
      revokeDocument(doc, user, lyDo)
      return clone(doc)
    })
  },

  async logDownload(id: string) {
    const user = currentUser()
    return writeOp(() => {
      const doc = db.documents.find((d) => d.id === id)
      if (!doc) throw new ApiError('NOT_FOUND', 'Không tìm thấy văn bản.', 404)
      doc.luotTai.unshift({
        id: `dl_${nextSeq('entity')}`,
        luc: nowIso(),
        nguoiTai: user.hoTen,
        diaChiIp: '113.161.72.18',
      })
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'DOWNLOAD_DOCUMENT',
        doiTuong: 'Văn bản',
        doiTuongId: doc.soVanBan,
        giaTriSau: 'Tải văn bản',
      })
      return clone(doc)
    })
  },

  async exportAs(id: string, dinhDang) {
    currentUser()
    return readOp(() => {
      const doc = db.documents.find((d) => d.id === id)
      if (!doc) throw new ApiError('NOT_FOUND', 'Không tìm thấy văn bản.', 404)
      if (doc.trangThai === 'REVOKED') {
        throw new ApiError(
          'DOCUMENT_REVOKED',
          'Văn bản đã bị thu hồi nên không thể tải về.',
          410,
        )
      }
      const ten = `${doc.soVanBan.replace(/[/\\]/g, '-')}.${dinhDang === 'pdf' ? 'pdf' : 'html'}`
      return {
        ten,
        mime: dinhDang === 'pdf' ? 'application/pdf' : 'text/html;charset=utf-8',
        noiDung: buildPrintableHtml(doc),
      }
    })
  },

  async report(): Promise<ReportOverview> {
    const user = currentUser()
    return readOp(() => {
      const apps = db.applications.filter((a) => inScope(a, user))
      const total = apps.length
      const count = (s: string) => apps.filter((a) => a.trangThai === s).length
      const completed = apps.filter((a) => a.trangThai === 'COMPLETED')
      const quaHan = apps.filter(
        (a) =>
          ['PENDING_APPROVAL', 'SUBMITTED'].includes(a.trangThai) &&
          !!a.hanXuLy &&
          new Date(a.hanXuLy).getTime() < Date.now(),
      ).length

      const dungHan = completed.filter(
        (a) =>
          !a.ngayHoanThanh || !a.hanXuLy || a.ngayHoanThanh <= a.hanXuLy,
      ).length

      const tb =
        completed.length === 0
          ? 0
          : completed.reduce((sum, a) => {
              const start = new Date(a.ngayNop ?? a.ngayTao).getTime()
              const end = new Date(a.ngayHoanThanh ?? a.ngayCapNhat).getTime()
              return sum + (end - start) / 3_600_000
            }, 0) / completed.length

      const theoLoaiDon = db.requestTypes.map((rt) =>
        row(rt.ten, apps.filter((a) => a.requestTypeId === rt.id).length, total),
      )
      const khoaMap = new Map<string, number>()
      apps.forEach((a) => khoaMap.set(a.sinhVien.khoa, (khoaMap.get(a.sinhVien.khoa) ?? 0) + 1))
      const nhan: Record<string, string> = {
        DRAFT: 'Bản nháp',
        SUBMITTED: 'Đã nộp',
        PENDING_APPROVAL: 'Đang chờ duyệt',
        NEED_SUPPLEMENT: 'Cần bổ sung',
        REJECTED: 'Từ chối',
        COMPLETED: 'Hoàn thành',
        CANCELLED: 'Đã rút',
      }

      const buocMap = new Map<string, { vaiTro: string; tong: number; so: number }>()
      apps.forEach((a) => {
        const sigs = db.signatures
          .filter((s) => s.applicationId === a.id)
          .sort((x, y) => x.buocOrder - y.buocOrder)
        sigs.forEach((s, i) => {
          const prev = i === 0 ? a.ngayNop ?? a.ngayTao : sigs[i - 1].thoiDiemKy
          const gio = (new Date(s.thoiDiemKy).getTime() - new Date(prev).getTime()) / 3_600_000
          const key = `${s.tenBuoc}`
          const cur = buocMap.get(key) ?? { vaiTro: s.vaiTro, tong: 0, so: 0 }
          cur.tong += Math.max(0, gio)
          cur.so += 1
          buocMap.set(key, cur)
        })
      })
      const thoiGianTungBuoc: AvgStepDuration[] = [...buocMap.entries()].map(
        ([buoc, v]) => ({
          buoc,
          vaiTro: v.vaiTro,
          gioTrungBinh: v.so ? Math.round((v.tong / v.so) * 10) / 10 : 0,
          soHoSo: v.so,
        }),
      )

      const theoThang = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() - (5 - i))
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return {
          thang: `${d.getMonth() + 1}/${d.getFullYear()}`,
          nop: apps.filter((a) => (a.ngayNop ?? '').slice(0, 7) === key).length,
          hoanThanh: apps.filter((a) => (a.ngayHoanThanh ?? '').slice(0, 7) === key).length,
        }
      })

      return {
        tongHoSo: total,
        hoanThanh: count('COMPLETED'),
        dangXuLy: count('PENDING_APPROVAL') + count('SUBMITTED'),
        tuChoi: count('REJECTED'),
        quaHan,
        tyLeDungHan: completed.length
          ? Math.round((dungHan / completed.length) * 1000) / 10
          : 0,
        thoiGianXuLyTrungBinhGio: Math.round(tb * 10) / 10,
        theoLoaiDon,
        theoKhoa: [...khoaMap.entries()].map(([ten, soLuong]) => row(ten, soLuong, total)),
        theoTrangThai: Object.entries(nhan).map(([ma, label]) =>
          row(label, apps.filter((a) => a.trangThai === ma).length, total),
        ),
        thoiGianTungBuoc,
        theoThang,
      }
    })
  },

  async reportRows() {
    const overview = await this.report()
    return {
      theoLoaiDon: overview.theoLoaiDon,
      theoKhoa: overview.theoKhoa,
      theoTrangThai: overview.theoTrangThai,
      thoiGianTungBuoc: overview.thoiGianTungBuoc,
    }
  },
}

function buildPrintableHtml(doc: SignedDocument): string {
  const chuKy = doc.chuKy
    .map(
      (s) =>
        `<div style="display:inline-block;border:1px solid #0E9AE0;border-radius:6px;padding:8px 12px;margin:6px 8px 0 0;font-family:Arial,sans-serif;font-size:11px">
          <div style="font-weight:bold;color:#0B3C6F">Đã ký điện tử bởi: ${s.hoTen}</div>
          <div>${s.chucVu}</div>
          <div>Thời gian ký: ${new Date(s.thoiDiemKy).toLocaleString('vi-VN')}</div>
          <div>Phương thức: ${s.phuongThuc === 'OTP' ? 'Ký OTP' : 'Duyệt điện tử'}</div>
          <div>Mã chữ ký: ${s.maChuKy}</div>
        </div>`,
    )
    .join('')
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${doc.soVanBan}</title></head>
<body style="font-family:'Times New Roman',serif;max-width:800px;margin:24px auto;line-height:1.5">
  <div style="text-align:center"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>Độc lập - Tự do - Hạnh phúc</div>
  <h2 style="text-align:center">${doc.trichYeu}</h2>
  <div style="text-align:center">Số: ${doc.soVanBan}</div>
  <pre style="white-space:pre-wrap;font-family:inherit;font-size:15px">${doc.noiDung}</pre>
  <div>${chuKy}</div>
  <p style="font-size:11px;color:#555">Văn bản được ký điện tử, quét mã QR để xác thực tại motcua.tbu.edu.vn/xac-thuc.</p>
</body></html>`
}

export const mockTemplateService: TemplateService = {
  async list() {
    return readOp(() => [...db.templates])
  },
  async get(id: string) {
    return readOp(() => {
      const t = db.templates.find((x) => x.id === id)
      if (!t) throw new ApiError('NOT_FOUND', 'Không tìm thấy mẫu văn bản.', 404)
      return { ...t }
    })
  },
  async create(input) {
    const user = currentUser()
    return writeOp(() => {
      if (!input.ten.trim() || !input.noiDung.trim()) {
        throw new ApiError('VALIDATION_ERROR', 'Tên mẫu và nội dung không được để trống.', 422)
      }
      const tpl: DocumentTemplate = {
        ...input,
        id: `tpl_${nextSeq('entity')}`,
        capNhatLuc: nowIso(),
      }
      db.templates.push(tpl)
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_TEMPLATE',
        doiTuong: 'Mẫu văn bản',
        doiTuongId: tpl.ma,
        giaTriSau: 'Tạo mới',
      })
      return tpl
    })
  },
  async update(id, patch) {
    const user = currentUser()
    return writeOp(() => {
      const t = db.templates.find((x) => x.id === id)
      if (!t) throw new ApiError('NOT_FOUND', 'Không tìm thấy mẫu văn bản.', 404)
      const truoc = t.ten
      Object.assign(t, patch, { id: t.id, capNhatLuc: nowIso() })
      addAudit({
        nguoiThucHien: user,
        hanhDong: 'UPDATE_TEMPLATE',
        doiTuong: 'Mẫu văn bản',
        doiTuongId: t.ma,
        giaTriTruoc: truoc,
        giaTriSau: t.ten,
      })
      return { ...t }
    })
  },
  async remove(id: string) {
    return writeOp(() => {
      const t = db.templates.find((x) => x.id === id)
      if (!t) throw new ApiError('NOT_FOUND', 'Không tìm thấy mẫu văn bản.', 404)
      const dangDung = db.requestTypes.some((r) => r.templateId === id)
      if (dangDung) {
        throw new ApiError(
          'INVALID_TRANSITION',
          'Mẫu đang được dùng cho loại đơn nên không thể xoá.',
          409,
        )
      }
      db.templates = db.templates.filter((x) => x.id !== id)
    })
  },
  async renderPreview(id: string, values: Record<string, string>) {
    return readOp(() => {
      const t = db.templates.find((x) => x.id === id)
      if (!t) throw new ApiError('NOT_FOUND', 'Không tìm thấy mẫu văn bản.', 404)
      return renderTemplate(t.noiDung, values)
    })
  },
}

export const mockVerifyService: VerifyService = {
  async byToken(token: string): Promise<VerifyResult> {
    return readOp(() => {
      const doc = db.documents.find((d) => d.tokenXacThuc === token)
      if (!doc) throw new ApiError('NOT_FOUND', 'Mã xác thực không tồn tại.', 404)
      return { trangThai: doc.trangThai, vanBan: clone(doc) }
    })
  },

  async bySoVanBan(soVanBan: string): Promise<VerifyResult> {
    return readOp(() => {
      const key = soVanBan.trim().toLowerCase()
      const doc = db.documents.find((d) => d.soVanBan.toLowerCase() === key)
      if (!doc) throw new ApiError('NOT_FOUND', 'Không tìm thấy văn bản với số đã nhập.', 404)
      return { trangThai: doc.trangThai, vanBan: clone(doc) }
    })
  },

  async compareFileHash(token: string, maBamNguoiDung: string): Promise<VerifyResult> {
    return readOp(() => {
      const doc = db.documents.find((d) => d.tokenXacThuc === token)
      if (!doc) throw new ApiError('NOT_FOUND', 'Mã xác thực không tồn tại.', 404)
      const trungKhop = doc.maBamSha256.toLowerCase() === maBamNguoiDung.trim().toLowerCase()
      return {
        trangThai: doc.trangThai,
        vanBan: clone(doc),
        ketQuaDoiChieu: {
          maBamNguoiDung,
          trungKhop,
          luc: nowIso(),
        },
      }
    })
  },

  async recentDocuments(limit = 5) {
    return readOp(() =>
      [...db.documents]
        .sort((a, b) => b.ngayCap.localeCompare(a.ngayCap))
        .slice(0, limit)
        .map((d) => ({
          id: d.id,
          soVanBan: d.soVanBan,
          trichYeu: d.trichYeu,
          loaiVanBan: d.loaiVanBan,
          ngayCap: d.ngayCap,
          tokenXacThuc: d.tokenXacThuc,
          maHoSo: d.maHoSo,
          trangThai: d.trangThai,
          sinhVien: d.sinhVien,
          maBamSha256: d.maBamSha256,
          chuKy: d.chuKy,
          templateId: d.templateId,
          applicationId: d.applicationId,
          noiDung: '',
          chuKyConHieuLuc: d.chuKyConHieuLuc,
          luotTai: [],
        })),
    )
  },
}
