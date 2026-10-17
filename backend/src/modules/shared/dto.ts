import type { Prisma } from '@prisma/client'

/* ------------------------------------------------------------------ *
 * Ánh xạ từ mô hình CSDL sang đúng khuôn dữ liệu frontend (camelCase).
 * Bảng: applications, request_types, workflow_definitions, …
 * ------------------------------------------------------------------ */

/** Quan hệ nạp kèm cho mọi hồ sơ (danh sách và chi tiết dùng chung). */
export const applicationInclude = {
  requestType: {
    include: {
      formFields: { orderBy: { order: 'asc' } },
      requiredDocs: true,
    },
  },
  applicant: {
    select: { id: true, maSo: true, hoTen: true, email: true, soDienThoai: true },
  },
  class: {
    select: {
      id: true,
      ma: true,
      ten: true,
      coVanId: true,
      facultyId: true,
      major: { select: { ten: true } },
      faculty: { select: { ten: true } },
      academicYear: { select: { ten: true } },
      coVan: { select: { id: true, hoTen: true } },
    },
  },
  workflow: { include: { steps: { orderBy: { order: 'asc' } }, requestTypes: { select: { id: true, ma: true } } } },
  stepInstances: { orderBy: { stepOrder: 'asc' }, include: { workflowStep: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
  approvals: {
    orderBy: [{ createdAt: 'asc' }, { buocOrder: 'asc' }],
    select: {
      id: true,
      applicationId: true,
      buocOrder: true,
      hanhDong: true,
      actorId: true,
      vaiTro: true,
      chucVu: true,
      ghiChu: true,
      lyDo: true,
      phuongThuc: true,
      signatureId: true,
      createdAt: true,
      actor: { select: { hoTen: true, chucVu: true } },
    },
  },
  document: {
    select: { id: true, soVanBan: true, tokenXacThuc: true, trangThai: true },
  },
} satisfies Prisma.ApplicationInclude

export type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>
export type WorkflowRow = NonNullable<ApplicationRow['workflow']>
export type RequestTypeRow = ApplicationRow['requestType']

/* ------------------------------- Danh mục ------------------------------- */

const dateOnly = (d: Date | null | undefined): string | undefined =>
  d ? d.toISOString().slice(0, 10) : undefined

export function facultyDto(f: {
  id: string
  ma: string
  ten: string
  vietTat: string
  truongKhoaId: string | null
}) {
  return { id: f.id, ma: f.ma, ten: f.ten, vietTat: f.vietTat, truongKhoaId: f.truongKhoaId ?? '' }
}

export function departmentDto(d: {
  id: string
  ma: string
  ten: string
  vietTat: string
  truongPhongId: string | null
}) {
  return {
    id: d.id,
    ma: d.ma,
    ten: d.ten,
    vietTat: d.vietTat,
    ...(d.truongPhongId ? { truongPhongId: d.truongPhongId } : {}),
  }
}

/* ------------------------------ Loại đơn ------------------------------- */

export function requestTypeDto(rt: RequestTypeRow, soLuotNop?: number) {
  return {
    id: rt.id,
    ma: rt.ma,
    ten: rt.ten,
    nhom: rt.nhom,
    moTa: rt.moTa,
    icon: rt.icon,
    mau: rt.mau,
    formFields: rt.formFields.map((f) => ({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      ...(f.helpText ? { helpText: f.helpText } : {}),
      required: f.required,
      ...(f.options ? { options: f.options } : {}),
      ...(f.defaultValue !== null && f.defaultValue !== undefined
        ? { defaultValue: f.defaultValue }
        : {}),
      ...(f.min !== null ? { min: f.min } : {}),
      ...(f.max !== null ? { max: f.max } : {}),
      ...(f.rows !== null ? { rows: f.rows } : {}),
      ...(f.accept ? { accept: f.accept } : {}),
      ...(f.maxSizeMb !== null ? { maxSizeMb: f.maxSizeMb } : {}),
      ...(f.width ? { width: f.width } : {}),
      order: f.order,
      readOnly: f.readOnly,
    })),
    giayTo: rt.requiredDocs.map((g) => ({
      key: g.key,
      label: g.label,
      batBuoc: g.batBuoc,
      ...(g.accept ? { accept: g.accept } : {}),
      ...(g.helpText ? { helpText: g.helpText } : {}),
    })),
    workflowId: rt.workflowId ?? '',
    templateId: rt.templateId ?? '',
    soNgayXuLy: rt.soNgayXuLy,
    lePhi: rt.lePhi,
    hoatDong: rt.hoatDong,
    ...(soLuotNop !== undefined ? { soLuotNop } : {}),
  }
}

/* ------------------------------ Luồng duyệt ---------------------------- */

export function workflowDto(wf: WorkflowRow) {
  return {
    id: wf.id,
    ma: wf.ma,
    ten: wf.ten,
    version: wf.version,
    requestTypeIds: wf.requestTypes.map((r) => r.id),
    requestTypeMas: wf.requestTypes.map((r) => r.ma),
    steps: wf.steps.map((s) => ({
      id: s.id,
      order: s.order,
      ten: s.ten,
      role: s.role,
      mode: s.mode,
      slaHours: s.slaHours,
      nhacTruocGio: s.nhacTruocGio,
      leoThangSauGio: s.leoThangSauGio,
      ...(s.escalateTo ? { escalateTo: s.escalateTo } : {}),
      allowReject: s.allowReject,
      allowSupplement: s.allowSupplement,
      ...(s.moTa ? { moTa: s.moTa } : {}),
    })),
    hoatDong: wf.hoatDong,
    capDo: wf.capDo,
  }
}

/* -------------------------------- Hồ sơ -------------------------------- */

function studentSummaryDto(app: ApplicationRow) {
  const sv = app.applicant
  const cls = app.class
  return {
    id: sv.id,
    maSo: sv.maSo,
    hoTen: sv.hoTen,
    lop: cls?.ten ?? '',
    khoa: cls?.faculty.ten ?? '',
    nganh: cls?.major.ten ?? '',
    khoaHoc: cls?.academicYear.ten ?? '',
    email: sv.email,
    ...(sv.soDienThoai ? { soDienThoai: sv.soDienThoai } : {}),
    ...(cls?.coVanId ? { coVanId: cls.coVanId, coVanTen: cls.coVan?.hoTen ?? '' } : {}),
  }
}

function currentStepDto(app: ApplicationRow) {
  if (app.trangThai !== 'SUBMITTED' && app.trangThai !== 'PENDING_APPROVAL') return null
  const si = app.stepInstances.find((s) => s.stepOrder === app.currentStepOrder)
  if (!si) return null
  if (si.trangThai === 'APPROVED' || si.trangThai === 'REJECTED' || si.trangThai === 'SKIPPED') {
    return null
  }
  return {
    id: si.workflowStepId ?? si.id,
    order: si.stepOrder,
    ten: si.ten,
    role: si.role,
    mode: si.mode,
    // Lấy từ cấu hình ĐÃ ĐÓNG BĂNG ở step_instances (không phải luồng sống).
    slaHours: si.slaHours,
    nhacTruocGio: si.nhacTruocGio,
    leoThangSauGio: si.leoThangSauGio,
    ...(si.escalateTo ? { escalateTo: si.escalateTo } : {}),
    allowReject: si.allowReject,
    allowSupplement: si.allowSupplement,
    daQuaHan: si.daQuaHan,
    ...(si.slaDueAt ? { slaDueAt: si.slaDueAt.toISOString() } : {}),
    ...((si.workflowStep?.moTa ?? null) ? { moTa: si.workflowStep!.moTa! } : {}),
  }
}

function historyDto(app: ApplicationRow) {
  return app.approvals.map((a) => ({
    id: a.id,
    applicationId: a.applicationId,
    buocOrder: a.buocOrder,
    hanhDong: a.hanhDong,
    nguoiThucHienId: a.actorId ?? '',
    nguoiThucHienTen: a.actor?.hoTen ?? 'Hệ thống',
    ...(a.chucVu ?? a.actor?.chucVu ? { chucVu: a.chucVu ?? a.actor?.chucVu } : {}),
    vaiTro: a.vaiTro,
    ...(a.ghiChu ? { ghiChu: a.ghiChu } : {}),
    ...(a.lyDo ? { lyDo: a.lyDo } : {}),
    ...(a.phuongThuc ? { phuongThuc: a.phuongThuc } : {}),
    luc: a.createdAt.toISOString(),
    ...(a.signatureId ? { signatureId: a.signatureId } : {}),
  }))
}

function attachmentsDto(app: ApplicationRow) {
  return app.attachments.map((t) => ({
    id: t.id,
    ten: t.ten,
    loai: t.loai,
    kichThuoc: t.kichThuoc,
    url: `/api/v1/files/${t.id}`,
    uploadedAt: t.createdAt.toISOString(),
    ...(t.requirementKey ? { requirementKey: t.requirementKey } : {}),
  }))
}

/** Hồ sơ rút gọn — dùng cho danh sách, thẻ, thống kê. */
export function applicationDto(app: ApplicationRow) {
  return {
    id: app.id,
    maHoSo: app.maHoSo,
    requestTypeId: app.requestTypeId,
    requestType: {
      id: app.requestType.id,
      ma: app.requestType.ma,
      ten: app.requestType.ten,
      nhom: app.requestType.nhom,
      icon: app.requestType.icon,
      mau: app.requestType.mau,
    },
    sinhVienId: app.applicantId,
    sinhVien: studentSummaryDto(app),
    trangThai: app.trangThai,
    duLieu: (app.duLieu ?? {}) as Record<string, unknown>,
    tepDinhKem: attachmentsDto(app),
    workflowId: app.workflowId ?? '',
    currentStepOrder: app.currentStepOrder,
    buocHienTai: currentStepDto(app),
    tongSoBuoc: app.tongSoBuoc,
    buocDaDuyet: app.buocDaDuyet,
    lichSu: historyDto(app),
    ngayTao: app.createdAt.toISOString(),
    ...(app.ngayNop ? { ngayNop: app.ngayNop.toISOString() } : {}),
    ngayCapNhat: app.updatedAt.toISOString(),
    ...(app.hanXuLy ? { hanXuLy: app.hanXuLy.toISOString() } : {}),
    ...(app.ngayHoanThanh ? { ngayHoanThanh: app.ngayHoanThanh.toISOString() } : {}),
    ...(app.lyDoTuChoi ? { lyDoTuChoi: app.lyDoTuChoi } : {}),
    ...(app.yeuCauBoSung ? { yeuCauBoSung: app.yeuCauBoSung as Record<string, unknown> } : {}),
    ...(app.document
      ? {
          vanBanId: app.document.id,
          tokenXacThuc: app.document.tokenXacThuc,
          soVanBan: app.document.soVanBan,
        }
      : {}),
  }
}

/** Hồ sơ đầy đủ — thêm luồng duyệt và loại đơn đầy đủ (biểu mẫu động). */
export function applicationDetailDto(app: ApplicationRow) {
  return {
    ...applicationDto(app),
    workflow: app.workflow ? workflowDto(app.workflow) : null,
    requestTypeFull: requestTypeDto(app.requestType),
  }
}

export { dateOnly }
