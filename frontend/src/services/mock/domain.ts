import {
  ApiError,
  type Application,
  type ApprovalAction,
  type Attachment,
  type SignedDocument,
  type Signature,
  type User,
} from '@/types'
import { quickHash } from '@/lib/utils'
import { buildSignedDocument } from './documentFactory'
import { addHoursIso, nowIso } from './helpers'
import {
  addAudit,
  db,
  findWorkflowById,
  inScope,
  nextSeq,
  notifyRole,
  pushNotification,
  signaturesOf,
} from './store'

function pushAction(
  app: Application,
  action: Omit<ApprovalAction, 'id' | 'applicationId'>,
): void {
  app.lichSu.push({
    ...action,
    id: `act_${app.maHoSo}_${app.lichSu.length + 1}`,
    applicationId: app.id,
  })
}

export function assertInScope(app: Application, user: User): void {
  if (!inScope(app, user)) {
    throw new ApiError(
      'FORBIDDEN_SCOPE',
      'Bạn không có quyền truy cập hồ sơ này.',
      403,
    )
  }
}

export function assertCanApprove(app: Application, user: User): void {
  assertInScope(app, user)
  const dangCho =
    app.trangThai === 'PENDING_APPROVAL' ||
    (app.trangThai === 'SUBMITTED' && app.buocHienTai?.order === 1)
  if (!dangCho) {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Hồ sơ không ở trạng thái chờ duyệt nên không thể phê duyệt.',
      409,
    )
  }
  if (user.role !== 'ADMIN' && app.buocHienTai?.role !== user.role) {
    throw new ApiError(
      'FORBIDDEN_SCOPE',
      'Hồ sơ này không thuộc cấp xử lý của bạn.',
      403,
    )
  }
}

function createSignature(
  app: Application,
  user: User,
  mode: 'ONE_CLICK' | 'OTP',
  luc: string,
): Signature {
  const step = app.buocHienTai!
  const maBam = quickHash(
    `${app.maHoSo}|${step.order}|${user.id}|${JSON.stringify(app.duLieu)}|${luc}`,
  )
  const signature: Signature = {
    id: `sig_${nextSeq('signature')}`,
    applicationId: app.id,
    buocOrder: step.order,
    tenBuoc: step.ten,
    nguoiKyId: user.id,
    hoTen: user.hoTen,
    chucVu: user.chucVu ?? '',
    vaiTro: user.role,
    phuongThuc: mode === 'OTP' ? 'OTP' : 'ELECTRONIC',
    thoiDiemKy: luc,
    maBam,
    maChuKy: maBam.slice(0, 8).toUpperCase(),
    hopLe: true,
  }
  db.signatures.push(signature)
  return signature
}

function issueDocument(app: Application, user: User): SignedDocument {
  const rt = db.requestTypes.find((r) => r.id === app.requestTypeId)!
  const soVanBan = `${nextSeq('document')}/${rt.ma}-ĐHTB`
  const ngayCap = nowIso()
  const doc = buildSignedDocument(
    app,
    signaturesOf(app.id),
    soVanBan,
    ngayCap,
    `vb_${app.id}`,
  )
  db.documents.unshift(doc)
  app.vanBanId = doc.id
  app.soVanBan = soVanBan
  app.tokenXacThuc = doc.tokenXacThuc
  app.ngayHoanThanh = ngayCap
  app.trangThai = 'COMPLETED'
  app.buocHienTai = null
  app.hanXuLy = ngayCap
  pushAction(app, {
    buocOrder: app.tongSoBuoc,
    hanhDong: 'ISSUE_DOCUMENT',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    chucVu: user.chucVu,
    vaiTro: user.role,
    ghiChu: `Cấp văn bản số ${soVanBan}, ký số và sinh mã QR xác thực.`,
    luc: ngayCap,
  })
  return doc
}

/** Duyệt hồ sơ ở bước hiện tại; tự động chuyển bước hoặc hoàn thành nếu là bước cuối. */
export function approveApplication(
  app: Application,
  user: User,
  input: { ghiChu?: string; phuongThuc: 'ONE_CLICK' | 'OTP' },
): Application {
  assertCanApprove(app, user)
  const step = app.buocHienTai!
  const luc = nowIso()
  createSignature(
    app,
    user,
    step.mode === 'OTP' ? 'OTP' : input.phuongThuc,
    luc,
  )
  pushAction(app, {
    buocOrder: step.order,
    hanhDong: 'APPROVE',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    chucVu: user.chucVu,
    vaiTro: user.role,
    ghiChu: input.ghiChu,
    phuongThuc: step.mode,
    luc,
  })
  app.buocDaDuyet = step.order
  app.ngayCapNhat = luc

  const workflow = findWorkflowById(app.workflowId)!
  const next =
    workflow.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((s) => s.order > step.order) ?? null

  if (next) {
    app.trangThai = 'PENDING_APPROVAL'
    app.currentStepOrder = next.order
    app.buocHienTai = next
    app.hanXuLy = addHoursIso(next.slaHours)
    pushNotification({
      nguoiNhanId: app.sinhVienId,
      tieuDe: 'Hồ sơ đã qua một cấp phê duyệt',
      noiDung: `Hồ sơ ${app.maHoSo} đã được ${user.chucVu ?? user.hoTen} phê duyệt và chuyển tới bước "${next.ten}".`,
      loai: 'INFO',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}`,
    })
    notifyRole(next.role, {
      tieuDe: 'Có hồ sơ mới chờ bạn xử lý',
      noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.sinhVien.hoTen} đã tới bước "${next.ten}".`,
      loai: 'INFO',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/quan-ly/don/${app.maHoSo}`,
    })
  } else {
    const doc = issueDocument(app, user)
    pushNotification({
      nguoiNhanId: app.sinhVienId,
      tieuDe: 'Văn bản đã được ký số và phát hành',
      noiDung: `Hồ sơ ${app.maHoSo} đã hoàn thành. Văn bản số ${doc.soVanBan} đã được ký điện tử, bạn có thể tải về và in.`,
      loai: 'SUCCESS',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/don/${app.maHoSo}/van-ban`,
    })
  }

  addAudit({
    nguoiThucHien: user,
    hanhDong: 'APPROVE_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: `Bước ${step.order}: Đang chờ duyệt`,
    giaTriSau: next ? `Chuyển bước ${next.order}` : 'Hoàn thành',
  })

  return app
}

export function rejectApplication(
  app: Application,
  user: User,
  lyDo: string,
): Application {
  assertCanApprove(app, user)
  if (!lyDo.trim()) {
    throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do từ chối.', 422)
  }
  const step = app.buocHienTai!
  if (!step.allowReject) {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Bước duyệt này không cho phép từ chối hồ sơ.',
      409,
    )
  }
  const luc = nowIso()
  pushAction(app, {
    buocOrder: step.order,
    hanhDong: 'REJECT',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    chucVu: user.chucVu,
    vaiTro: user.role,
    lyDo,
    luc,
  })
  app.trangThai = 'REJECTED'
  app.lyDoTuChoi = lyDo
  app.buocHienTai = null
  app.currentStepOrder = step.order
  app.ngayCapNhat = luc
  app.hanXuLy = undefined

  pushNotification({
    nguoiNhanId: app.sinhVienId,
    tieuDe: 'Hồ sơ đã bị từ chối',
    noiDung: `Hồ sơ ${app.maHoSo} bị từ chối ở bước "${step.ten}". Lý do: ${lyDo}`,
    loai: 'DANGER',
    applicationId: app.id,
    maHoSo: app.maHoSo,
    lienKet: `/don/${app.maHoSo}`,
  })
  addAudit({
    nguoiThucHien: user,
    hanhDong: 'REJECT_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đang chờ duyệt',
    giaTriSau: 'Từ chối',
  })
  return app
}

export function requestSupplement(
  app: Application,
  user: User,
  noiDung: string,
): Application {
  assertCanApprove(app, user)
  if (!noiDung.trim()) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Vui lòng nhập nội dung cần bổ sung.',
      422,
    )
  }
  const step = app.buocHienTai!
  if (!step.allowSupplement) {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Bước duyệt này không cho phép yêu cầu bổ sung.',
      409,
    )
  }
  const luc = nowIso()
  pushAction(app, {
    buocOrder: step.order,
    hanhDong: 'REQUEST_SUPPLEMENT',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    chucVu: user.chucVu,
    vaiTro: user.role,
    lyDo: noiDung,
    luc,
  })
  app.trangThai = 'NEED_SUPPLEMENT'
  app.yeuCauBoSung = {
    noiDung,
    boiAiId: user.id,
    boiAiTen: user.hoTen,
    luc,
    daBoSung: false,
    quayVeBuocOrder: step.order,
  }
  app.currentStepOrder = 0
  app.buocHienTai = null
  app.ngayCapNhat = luc

  pushNotification({
    nguoiNhanId: app.sinhVienId,
    tieuDe: 'Hồ sơ cần bổ sung thông tin',
    noiDung: `Hồ sơ ${app.maHoSo} cần bổ sung: ${noiDung}`,
    loai: 'WARNING',
    applicationId: app.id,
    maHoSo: app.maHoSo,
    lienKet: `/don/${app.maHoSo}`,
  })
  addAudit({
    nguoiThucHien: user,
    hanhDong: 'REQUEST_SUPPLEMENT',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đang chờ duyệt',
    giaTriSau: 'Cần bổ sung',
  })
  return app
}

/** Sinh viên bổ sung hồ sơ: quay lại đúng cấp đã yêu cầu. */
export function supplementApplication(
  app: Application,
  user: User,
  input: { duLieu?: Record<string, unknown>; tepDinhKem?: Attachment[]; ghiChu?: string },
): Application {
  if (app.sinhVienId !== user.id) {
    throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không sở hữu hồ sơ này.', 403)
  }
  if (app.trangThai !== 'NEED_SUPPLEMENT') {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Chỉ hồ sơ đang ở trạng thái Cần bổ sung mới có thể bổ sung.',
      409,
    )
  }
  const luc = nowIso()
  if (input.duLieu) app.duLieu = { ...app.duLieu, ...input.duLieu }
  if (input.tepDinhKem?.length) {
    app.tepDinhKem = [...app.tepDinhKem, ...input.tepDinhKem]
  }
  pushAction(app, {
    buocOrder: 0,
    hanhDong: 'SUPPLEMENT',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    vaiTro: 'SINH_VIEN',
    ghiChu: input.ghiChu ?? 'Sinh viên bổ sung hồ sơ theo yêu cầu.',
    luc,
  })

  const quayVe = app.yeuCauBoSung?.quayVeBuocOrder ?? 1
  const workflow = findWorkflowById(app.workflowId)!
  const step = workflow.steps.find((s) => s.order === quayVe)!
  if (app.yeuCauBoSung) app.yeuCauBoSung.daBoSung = true
  app.trangThai = 'PENDING_APPROVAL'
  app.currentStepOrder = step.order
  app.buocHienTai = step
  app.hanXuLy = addHoursIso(step.slaHours)
  app.ngayCapNhat = luc

  notifyRole(step.role, {
    tieuDe: 'Sinh viên đã bổ sung hồ sơ',
    noiDung: `Hồ sơ ${app.maHoSo} của sinh viên ${app.sinhVien.hoTen} đã được bổ sung và quay lại bước "${step.ten}".`,
    loai: 'SUCCESS',
    applicationId: app.id,
    maHoSo: app.maHoSo,
    lienKet: `/quan-ly/don/${app.maHoSo}`,
  })
  addAudit({
    nguoiThucHien: user,
    hanhDong: 'SUPPLEMENT_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Cần bổ sung',
    giaTriSau: `Quay lại bước ${step.order}`,
  })
  return app
}

/** Sinh viên rút hồ sơ — chỉ khi chưa cấp nào phê duyệt. */
export function cancelApplication(
  app: Application,
  user: User,
  lyDo?: string,
): Application {
  if (app.sinhVienId !== user.id) {
    throw new ApiError('FORBIDDEN_SCOPE', 'Bạn không sở hữu hồ sơ này.', 403)
  }
  if (app.buocDaDuyet > 0) {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Hồ sơ đã được phê duyệt ở một cấp nên không thể rút.',
      409,
    )
  }
  if (!['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'].includes(app.trangThai)) {
    throw new ApiError(
      'INVALID_TRANSITION',
      'Hồ sơ ở trạng thái hiện tại không thể rút.',
      409,
    )
  }
  const luc = nowIso()
  pushAction(app, {
    buocOrder: 0,
    hanhDong: 'CANCEL',
    nguoiThucHienId: user.id,
    nguoiThucHienTen: user.hoTen,
    vaiTro: 'SINH_VIEN',
    ghiChu: lyDo ?? 'Sinh viên chủ động rút hồ sơ.',
    luc,
  })
  app.trangThai = 'CANCELLED'
  app.buocHienTai = null
  app.hanXuLy = undefined
  app.ngayCapNhat = luc
  addAudit({
    nguoiThucHien: user,
    hanhDong: 'CANCEL_APPLICATION',
    doiTuong: 'Hồ sơ một cửa',
    doiTuongId: app.maHoSo,
    giaTriTruoc: 'Đã nộp',
    giaTriSau: 'Đã rút',
  })
  return app
}

export function revokeDocument(
  doc: SignedDocument,
  user: User,
  lyDo: string,
): SignedDocument {
  if (!lyDo.trim()) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Vui lòng nhập lý do thu hồi văn bản.',
      422,
    )
  }
  if (doc.trangThai === 'REVOKED') {
    throw new ApiError('INVALID_TRANSITION', 'Văn bản đã bị thu hồi.', 409)
  }
  doc.trangThai = 'REVOKED'
  doc.lyDoThuHoi = lyDo
  doc.ngayThuHoi = nowIso()
  const app = db.applications.find((a) => a.id === doc.applicationId)
  if (app) {
    pushAction(app, {
      buocOrder: 0,
      hanhDong: 'REVOKE_DOCUMENT',
      nguoiThucHienId: user.id,
      nguoiThucHienTen: user.hoTen,
      chucVu: user.chucVu,
      vaiTro: user.role,
      lyDo,
      luc: doc.ngayThuHoi,
    })
    pushNotification({
      nguoiNhanId: app.sinhVienId,
      tieuDe: 'Văn bản đã bị thu hồi',
      noiDung: `Văn bản số ${doc.soVanBan} đã bị thu hồi. Lý do: ${lyDo}`,
      loai: 'DANGER',
      applicationId: app.id,
      maHoSo: app.maHoSo,
      lienKet: `/xac-thuc/${doc.tokenXacThuc}`,
    })
  }
  addAudit({
    nguoiThucHien: user,
    hanhDong: 'REVOKE_DOCUMENT',
    doiTuong: 'Văn bản đã cấp',
    doiTuongId: doc.soVanBan,
    giaTriTruoc: 'Hợp lệ',
    giaTriSau: 'Đã thu hồi',
  })
  return doc
}
