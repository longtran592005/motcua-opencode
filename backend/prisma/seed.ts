/**
 * Seed dữ liệu thật vào PostgreSQL từ snapshot dữ liệu mock của frontend
 * (`prisma/seed-data.json`, sinh bởi `frontend/scripts/dump-seed.ts`).
 *
 * Quy ước trường `ma` (xem docs/QUYET_DINH.md):
 *   - Khoa / Phòng ban / Khóa học / Ngành / Lớp / Loại đơn: `ma` = id cũ của mock
 *     (k_cntt, p_pdt, kh_k18, n_cntt, l_cntt1_k19, rt_gxn) để tra cứu ổn định.
 *   - Workflow / Mẫu văn bản: giữ `ma` sẵn có của mock (WF-01, MVT-GXN).
 *   - Người dùng: dùng `maSo` (20211234, CV001, TK001, PDT001, ADMIN).
 * Mọi khóa chính/khóa ngoại là UUID sinh tất định (UUID v5) từ id mock để chạy lại
 * cho ra cùng kết quả.
 *
 * Chạy: npm run seed  (hoặc npx prisma db seed)
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const here = dirname(fileURLToPath(import.meta.url))

type Json = unknown
interface Dict<T = Json> {
  [key: string]: T
}

const data = JSON.parse(readFileSync(resolve(here, 'seed-data.json'), 'utf8')) as Dict<Dict[] | string | number>

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

/** UUID v5 tất định: cùng (namespace, key) cho ra cùng UUID. */
function detUuid(namespace: string, key: string | number): string {
  const h = createHash('sha1').update(`motcua:${namespace}:${key}`).digest()
  const b = Buffer.from(h.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const id = {
  faculty: (v: string) => detUuid('faculty', v),
  department: (v: string) => detUuid('department', v),
  academicYear: (v: string) => detUuid('academicYear', v),
  major: (v: string) => detUuid('major', v),
  lop: (v: string) => detUuid('class', v),
  user: (v: string) => detUuid('user', v),
  student: (v: string) => detUuid('student', v),
  staffPosition: (v: string) => detUuid('staffPosition', v),
  template: (v: string) => detUuid('template', v),
  workflow: (v: string) => detUuid('workflow', v),
  workflowStep: (wf: string, s: string) => detUuid('workflowStep', `${wf}:${s}`),
  requestType: (v: string) => detUuid('requestType', v),
  requestTypeField: (rt: string, f: string) => detUuid('requestTypeField', `${rt}:${f}`),
  requiredDocument: (rt: string, k: string) => detUuid('requiredDocument', `${rt}:${k}`),
  application: (v: string) => detUuid('application', v),
  attachment: (v: string) => detUuid('attachment', v),
  approval: (v: string) => detUuid('approval', v),
  stepInstance: (app: string, order: number) => detUuid('stepInstance', `${app}:${order}`),
  document: (v: string) => detUuid('signedDocument', v),
  signature: (v: string) => detUuid('signature', v),
  download: (v: string) => detUuid('documentDownload', v),
  notification: (v: string) => detUuid('notification', v),
  auditLog: (v: string) => detUuid('auditLog', v),
  library: (v: string) => detUuid('libraryDocument', v),
}

const d = (v: Json): Date | null => (v ? new Date(String(v)) : null)

/** Loại bỏ khóa ngoại trỏ tới bản ghi không tồn tại. */
const asRef = (map: Map<string, string>, key: Json): string | null =>
  key == null || !map.has(String(key)) ? null : map.get(String(key))!

// ---------------------------------------------------------------------------
// Ánh xạ id mock -> UUID
// ---------------------------------------------------------------------------

const khoaList = data.khoa as Dict[]
const phongBanList = data.phongBan as Dict[]
const khoaHocList = data.khoaHoc as Dict[]
const nganhList = data.nganh as Dict[]
const lopList = data.lop as Dict[]
const userList = data.users as Dict[]
const templateList = data.templates as Dict[]
const workflowList = data.workflows as Dict[]
const requestTypeList = data.requestTypes as Dict[]
const applicationList = data.applications as Dict[]
const signatureList = data.signatures as Dict[]
const documentList = data.documents as Dict[]
const notificationList = data.notifications as Dict[]
const auditLogList = data.auditLogs as Dict[]
const libraryList = data.library as Dict[]

const mapKhoa = new Map(khoaList.map((k) => [String(k.id), id.faculty(String(k.id))]))
const mapPhongBan = new Map(phongBanList.map((p) => [String(p.id), id.department(String(p.id))]))
const mapKhoaHoc = new Map(khoaHocList.map((k) => [String(k.id), id.academicYear(String(k.id))]))
const mapNganh = new Map(nganhList.map((n) => [String(n.id), id.major(String(n.id))]))
const mapLop = new Map(lopList.map((l) => [String(l.id), id.lop(String(l.id))]))
const mapUser = new Map(userList.map((u) => [String(u.id), id.user(String(u.id))]))
const mapTemplate = new Map(templateList.map((t) => [String(t.id), id.template(String(t.id))]))
const mapWorkflow = new Map(workflowList.map((w) => [String(w.id), id.workflow(String(w.id))]))
const mapRequestType = new Map(requestTypeList.map((r) => [String(r.id), id.requestType(String(r.id))]))
const mapApplication = new Map(applicationList.map((a) => [String(a.maHoSo), id.application(String(a.maHoSo))]))
const mapDocument = new Map(documentList.map((doc) => [String(doc.id), id.document(String(doc.id))]))

const userById = new Map(userList.map((u) => [String(u.id), u]))
const userByHoTen = new Map(userList.map((u) => [String(u.hoTen), u]))
const workflowById = new Map(workflowList.map((w) => [String(w.id), w]))
const templateById = new Map(templateList.map((t) => [String(t.id), t]))

const staffPositionDefs = [
  { ma: 'CV', ten: 'Cố vấn học tập', moTa: 'Giảng viên cố vấn học tập theo lớp.' },
  { ma: 'TK', ten: 'Trưởng khoa', moTa: 'Lãnh đạo khoa.' },
  { ma: 'TP', ten: 'Trưởng phòng', moTa: 'Lãnh đạo phòng ban.' },
  { ma: 'CVT', ten: 'Chuyên viên', moTa: 'Chuyên viên nghiệp vụ.' },
  { ma: 'QT', ten: 'Quản trị hệ thống', moTa: 'Quản trị viên Cổng Một cửa.' },
]
const mapStaffPosition = new Map(staffPositionDefs.map((p) => [p.ma, id.staffPosition(p.ma)]))

function staffPositionFor(user: Dict): string {
  switch (user.role) {
    case 'ADMIN':
      return 'QT'
    case 'CO_VAN':
      return 'CV'
    case 'TRUONG_KHOA':
      return 'TK'
    case 'PHONG_DAO_TAO':
      return String(user.chucVu ?? '').startsWith('Trưởng phòng') ? 'TP' : 'CVT'
    default:
      return 'CVT'
  }
}

// ---------------------------------------------------------------------------
// Xóa và nạp lại
// ---------------------------------------------------------------------------

// Chặn chạy seed ở môi trường thật: seed tạo dữ liệu demo (mật khẩu chung, hash/token tạm).
if (process.env.NODE_ENV === 'production') {
  process.stderr.write(
    'TỪ CHỐI CHẠY SEED: NODE_ENV=production.\n' +
      'Seed chỉ dùng cho phát triển (tạo tài khoản demo, hash/token tạm).\n' +
      'Nếu cố ý nạp dữ liệu mẫu, hãy chạy với NODE_ENV=development.\n',
  )
  process.exit(1)
}

/** Các bảng được seed — dùng để đánh dấu is_demo = true sau khi nạp. */
const DEMO_TABLES = [
  'faculties',
  'departments',
  'academic_years',
  'majors',
  'classes',
  'staff_positions',
  'users',
  'students',
  'request_types',
  'workflow_definitions',
  'document_templates',
  'applications',
  'signed_documents',
  'document_downloads',
  'notifications',
  'audit_logs',
  'library_documents',
]

const TABLES = [
  'document_downloads',
  'signatures',
  'otp_challenges',
  'approvals',
  'step_instances',
  'application_attachments',
  'applications',
  'signed_documents',
  'notifications',
  'audit_logs',
  'idempotency_keys',
  'delegations',
  'chat_messages',
  'chat_sessions',
  'refresh_tokens',
  'request_type_fields',
  'required_documents',
  'request_types',
  'workflow_steps',
  'workflow_definitions',
  'document_templates',
  'students',
  'staff_positions',
  'classes',
  'users',
  'major_academic_years',
  'majors',
  'academic_years',
  'departments',
  'faculties',
  'library_documents',
]

async function main() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )

  // --- Khóa học -----------------------------------------------------------
  await prisma.academicYear.createMany({
    data: khoaHocList.map((k) => ({
      id: id.academicYear(String(k.id)),
      ma: String(k.id),
      ten: String(k.ten),
      namBatDau: Number(k.namBatDau),
      namKetThuc: Number(k.namKetThuc),
    })),
  })

  // --- Khoa (chưa gắn trưởng khoa vì người dùng chưa tồn tại) --------------
  await prisma.faculty.createMany({
    data: khoaList.map((k) => ({
      id: id.faculty(String(k.id)),
      ma: String(k.id),
      ten: String(k.ten),
      vietTat: String(k.vietTat),
    })),
  })

  // --- Phòng ban (chưa gắn trưởng phòng) ---------------------------------
  await prisma.department.createMany({
    data: phongBanList.map((p) => ({
      id: id.department(String(p.id)),
      ma: String(p.id),
      ten: String(p.ten),
      vietTat: String(p.vietTat),
    })),
  })

  // --- Ngành + ngành-khóa học --------------------------------------------
  await prisma.major.createMany({
    data: nganhList.map((n) => ({
      id: id.major(String(n.id)),
      ma: String(n.id),
      // Mã ngành chính thức của Bộ GD&ĐT (dữ liệu mock đã có sẵn)
      maChinhThuc: (n.ma as string) ?? null,
      ten: String(n.ten),
      facultyId: asRef(mapKhoa, n.khoaId)!,
    })),
  })
  const majorYears: { majorId: string; academicYearId: string }[] = []
  for (const n of nganhList) {
    for (const kh of (n.khoaHocIds as string[]) ?? []) {
      const academicYearId = asRef(mapKhoaHoc, kh)
      if (academicYearId) majorYears.push({ majorId: id.major(String(n.id)), academicYearId })
    }
  }
  await prisma.majorAcademicYear.createMany({ data: majorYears })

  // --- Vị trí viên chức ---------------------------------------------------
  await prisma.staffPosition.createMany({
    data: staffPositionDefs.map((p) => ({
      id: id.staffPosition(p.ma),
      ma: p.ma,
      ten: p.ten,
      moTa: p.moTa,
    })),
  })

  // --- Người dùng ---------------------------------------------------------
  const passwordHash = bcrypt.hashSync(String(data.demoPassword ?? 'demo1234'), 10)
  await prisma.user.createMany({
    data: userList.map((u) => {
      const donVi = String(u.donViId ?? '')
      return {
        id: id.user(String(u.id)),
        maSo: String(u.maSo),
        hoTen: String(u.hoTen),
        email: String(u.email),
        passwordHash,
        role: u.role as never,
        soDienThoai: (u.soDienThoai as string) ?? null,
        ngaySinh: d(u.ngaySinh),
        gioiTinh: (u.gioiTinh as never) ?? null,
        chucVu: (u.chucVu as string) ?? null,
        trangThai: (u.trangThai as never) ?? 'ACTIVE',
        facultyId: mapKhoa.has(donVi) ? mapKhoa.get(donVi)! : null,
        departmentId: mapPhongBan.has(donVi) ? mapPhongBan.get(donVi)! : null,
        staffPositionId: mapStaffPosition.get(staffPositionFor(u)) ?? null,
      }
    }),
  })

  // --- Gắn trưởng khoa / trưởng phòng (giờ đã có người dùng) --------------
  for (const k of khoaList) {
    const head = asRef(mapUser, k.truongKhoaId)
    if (head) await prisma.faculty.update({ where: { id: id.faculty(String(k.id)) }, data: { truongKhoaId: head } })
  }
  for (const p of phongBanList) {
    const head = asRef(mapUser, p.truongPhongId)
    if (head)
      await prisma.department.update({ where: { id: id.department(String(p.id)) }, data: { truongPhongId: head } })
  }

  // --- Lớp ----------------------------------------------------------------
  await prisma.class.createMany({
    data: lopList.map((l) => ({
      id: id.lop(String(l.id)),
      ma: String(l.id),
      ten: String(l.ten),
      facultyId: asRef(mapKhoa, l.khoaId)!,
      majorId: asRef(mapNganh, l.nganhId)!,
      academicYearId: asRef(mapKhoaHoc, l.khoaHocId)!,
      coVanId: asRef(mapUser, l.coVanId),
      siSo: Number(l.siSo ?? 0),
    })),
  })

  // --- Hồ sơ sinh viên ----------------------------------------------------
  const students = userList
    .filter((u) => u.role === 'SINH_VIEN' && mapLop.has(String(u.lopId ?? '')))
    .map((u) => ({
      id: id.student(String(u.id)),
      userId: id.user(String(u.id)),
      classId: mapLop.get(String(u.lopId))!,
    }))
  await prisma.student.createMany({ data: students })

  await seedCatalog()
  await seedApplications()

  // --- Thông báo ----------------------------------------------------------
  await prisma.notification.createMany({
    data: notificationList.map((n) => ({
      id: id.notification(String(n.id)),
      tieuDe: String(n.tieuDe),
      noiDung: String(n.noiDung),
      loai: n.loai as never,
      nguoiNhanId: asRef(mapUser, n.nguoiNhanId)!,
      applicationId: asRef(mapApplication, n.applicationId),
      maHoSo: (n.maHoSo as string) ?? null,
      daDoc: Boolean(n.daDoc),
      lienKet: (n.lienKet as string) ?? null,
      createdAt: d(n.luc)!,
    })),
  })

  // --- Nhật ký kiểm toán --------------------------------------------------
  await prisma.auditLog.createMany({
    data: auditLogList.map((a) => ({
      id: id.auditLog(String(a.id)),
      luc: d(a.luc)!,
      nguoiThucHienId: asRef(mapUser, a.nguoiThucHienId),
      nguoiThucHienTen: String(a.nguoiThucHienTen),
      vaiTro: a.vaiTro as never,
      hanhDong: String(a.hanhDong),
      doiTuong: String(a.doiTuong),
      doiTuongId: String(a.doiTuongId),
      giaTriTruoc: (a.giaTriTruoc as string) ?? null,
      giaTriSau: (a.giaTriSau as string) ?? null,
      diaChiIp: String(a.diaChiIp),
      thietBi: String(a.thietBi),
    })),
  })

  // --- Thư viện tài liệu --------------------------------------------------
  await prisma.libraryDocument.createMany({
    data: libraryList.map((l) => ({
      id: id.library(String(l.id)),
      ten: String(l.ten),
      nhom: String(l.nhom),
      moTa: String(l.moTa ?? ''),
      loaiTep: String(l.loaiTep),
      kichThuoc: String(l.kichThuoc),
      url: String(l.url),
      luotTai: Number(l.luotTai ?? 0),
      createdAt: d(l.capNhatLuc)!,
      updatedAt: d(l.capNhatLuc)!,
    })),
  })

  // Đánh dấu toàn bộ dữ liệu vừa nạp là DỮ LIỆU DEMO (xem docs/QUY_TRINH_VAN_HANH.md).
  // audit_logs là bảng append-only nên phải tạm tắt trigger để gắn cờ.
  await prisma.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only')
  try {
    for (const t of DEMO_TABLES) {
      await prisma.$executeRawUnsafe(`UPDATE "${t}" SET is_demo = true`)
    }
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_append_only')
  }

  const counts = {
    faculties: khoaList.length,
    departments: phongBanList.length,
    academicYears: khoaHocList.length,
    majors: nganhList.length,
    classes: lopList.length,
    users: userList.length,
    students: students.length,
    templates: templateList.length,
    workflows: workflowList.length,
    requestTypes: requestTypeList.length,
    applications: applicationList.length,
    signatures: signatureList.length,
    documents: documentList.length,
    notifications: notificationList.length,
    auditLogs: auditLogList.length,
    library: libraryList.length,
  }
  process.stdout.write(`Seed xong: ${JSON.stringify(counts)}\n`)
}

// ---------------------------------------------------------------------------
// Mẫu văn bản, luồng duyệt, loại đơn
// ---------------------------------------------------------------------------

async function seedCatalog() {
  await prisma.documentTemplate.createMany({
    data: templateList.map((t) => ({
      id: id.template(String(t.id)),
      ma: String(t.ma),
      ten: String(t.ten),
      loaiVanBan: String(t.loaiVanBan),
      noiDung: String(t.noiDung),
      hoatDong: Boolean(t.hoatDong),
      createdAt: d(t.capNhatLuc)!,
      updatedAt: d(t.capNhatLuc)!,
    })),
  })

  for (const w of workflowList) {
    await prisma.workflow.create({
      data: {
        id: id.workflow(String(w.id)),
        ma: String(w.ma),
        ten: String(w.ten),
        version: 1,
        capDo: Number(w.capDo),
        hoatDong: Boolean(w.hoatDong),
      },
    })
    await prisma.workflowStep.createMany({
      data: (w.steps as Dict[]).map((s) => ({
        id: id.workflowStep(String(w.id), String(s.id)),
        workflowId: id.workflow(String(w.id)),
        order: Number(s.order),
        ten: String(s.ten),
        role: s.role as never,
        mode: s.mode as never,
        slaHours: Number(s.slaHours ?? 48),
        allowReject: Boolean(s.allowReject),
        allowSupplement: Boolean(s.allowSupplement),
        moTa: (s.moTa as string) ?? null,
      })),
    })
  }

  for (const r of requestTypeList) {
    await prisma.requestType.create({
      data: {
        id: id.requestType(String(r.id)),
        ma: String(r.id),
        ten: String(r.ten),
        nhom: String(r.nhom),
        moTa: String(r.moTa),
        icon: String(r.icon),
        mau: String(r.mau),
        workflowId: asRef(mapWorkflow, r.workflowId),
        templateId: asRef(mapTemplate, r.templateId),
        soNgayXuLy: Number(r.soNgayXuLy ?? 3),
        lePhi: Number(r.lePhi ?? 0),
        hoatDong: Boolean(r.hoatDong),
      },
    })
    await prisma.requestTypeField.createMany({
      data: (r.formFields as Dict[]).map((f) => ({
        id: id.requestTypeField(String(r.id), String(f.id)),
        requestTypeId: id.requestType(String(r.id)),
        key: String(f.key),
        label: String(f.label),
        type: f.type as never,
        placeholder: (f.placeholder as string) ?? null,
        helpText: (f.helpText as string) ?? null,
        required: Boolean(f.required),
        options: (f.options as never) ?? undefined,
        defaultValue: (f.defaultValue as never) ?? undefined,
        min: f.min == null ? null : Number(f.min),
        max: f.max == null ? null : Number(f.max),
        rows: f.rows == null ? null : Number(f.rows),
        accept: (f.accept as string) ?? null,
        maxSizeMb: f.maxSizeMb == null ? null : Number(f.maxSizeMb),
        width: (f.width as string) ?? null,
        order: Number(f.order),
        readOnly: Boolean(f.readOnly),
      })),
    })
    await prisma.requiredDocument.createMany({
      data: ((r.giayTo as Dict[]) ?? []).map((g) => ({
        id: id.requiredDocument(String(r.id), String(g.key)),
        requestTypeId: id.requestType(String(r.id)),
        key: String(g.key),
        label: String(g.label),
        batBuoc: Boolean(g.batBuoc),
        accept: (g.accept as string) ?? null,
        helpText: (g.helpText as string) ?? null,
      })),
    })
  }
}

// ---------------------------------------------------------------------------
// Hồ sơ, bước duyệt, phê duyệt, văn bản, chữ ký
// ---------------------------------------------------------------------------

async function seedApplications() {
  const approvals: Dict[] = []
  const stepInstances: Dict[] = []
  const attachments: Dict[] = []

  for (const app of applicationList) {
    const maHoSo = String(app.maHoSo)
    const appId = id.application(maHoSo)
    const applicant = userById.get(String(app.sinhVienId))
    const donVi = String(applicant?.donViId ?? '')

    const lichSu = (app.lichSu as Dict[]) ?? []
    const rejected = lichSu.find((h) => h.hanhDong === 'REJECT')
    const supplement = lichSu.find((h) => h.hanhDong === 'REQUEST_SUPPLEMENT')

    await prisma.application.create({
      data: {
        id: appId,
        maHoSo,
        requestTypeId: asRef(mapRequestType, app.requestTypeId)!,
        applicantId: asRef(mapUser, app.sinhVienId)!,
        facultyId: mapKhoa.has(donVi) ? mapKhoa.get(donVi)! : null,
        classId: asRef(mapLop, applicant?.lopId),
        trangThai: app.trangThai as never,
        duLieu: (app.duLieu as never) ?? {},
        workflowId: asRef(mapWorkflow, app.workflowId),
        workflowVersion: app.workflowId ? 1 : null,
        currentStepOrder: Number(app.currentStepOrder ?? 0),
        tongSoBuoc: Number(app.tongSoBuoc ?? 0),
        buocDaDuyet: Number(app.buocDaDuyet ?? 0),
        hanXuLy: d(app.hanXuLy),
        ngayNop: d(app.ngayNop),
        ngayHoanThanh: d(app.ngayHoanThanh),
        lyDoTuChoi: (rejected?.lyDo as string) ?? null,
        yeuCauBoSung: supplement
          ? ({
              lyDo: String(supplement.lyDo),
              buocOrder: Number(supplement.buocOrder),
              luc: String(supplement.luc),
            } as never)
          : undefined,
        createdAt: d(app.ngayTao)!,
        updatedAt: d(app.ngayCapNhat)!,
      },
    })

    // Tệp đính kèm
    for (const t of (app.tepDinhKem as Dict[]) ?? []) {
      attachments.push({
        id: id.attachment(String(t.id)),
        applicationId: appId,
        ten: String(t.ten),
        loai: String(t.loai),
        kichThuoc: Number(t.kichThuoc ?? 0),
        storageKey: String(t.url ?? ''),
        requirementKey: (t.requirementKey as string) ?? null,
        nguoiTaiLenId: asRef(mapUser, app.sinhVienId),
        createdAt: d(t.uploadedAt)!,
      })
    }

    // Lịch sử -> approvals
    for (const h of lichSu) {
      approvals.push({
        id: id.approval(String(h.id)),
        applicationId: appId,
        stepInstanceId:
          Number(h.buocOrder) > 0 && Number(h.buocOrder) <= Number(app.tongSoBuoc ?? 0)
            ? id.stepInstance(maHoSo, Number(h.buocOrder))
            : null,
        buocOrder: Number(h.buocOrder ?? 0),
        hanhDong: h.hanhDong as never,
        actorId: asRef(mapUser, h.nguoiThucHienId),
        vaiTro: h.vaiTro as never,
        chucVu: (h.chucVu as string) ?? null,
        ghiChu: (h.ghiChu as string) ?? null,
        lyDo: (h.lyDo as string) ?? null,
        phuongThuc: (h.phuongThuc as never) ?? null,
        createdAt: d(h.luc)!,
      })
    }

    // Bước duyệt (step_instances) suy ra từ định nghĩa luồng + tiến độ
    const wf = workflowById.get(String(app.workflowId))
    const buocDaDuyet = Number(app.buocDaDuyet ?? 0)
    const currentStep = Number(app.currentStepOrder ?? 0)
    for (const st of ((wf?.steps as Dict[]) ?? [])) {
      const order = Number(st.order)
      let trangThai = 'PENDING'
      if (app.trangThai === 'COMPLETED' || order <= buocDaDuyet) {
        trangThai = 'APPROVED'
      } else if (app.trangThai === 'CANCELLED') {
        trangThai = 'SKIPPED'
      } else if (order === currentStep) {
        trangThai = app.trangThai === 'REJECTED' ? 'REJECTED' : 'IN_PROGRESS'
      }
      const doneAt = (approvals.find(
        (x) => x.applicationId === appId && Number(x.buocOrder) === order && x.hanhDong === 'APPROVE',
      )?.createdAt as Date | undefined) ?? null
      stepInstances.push({
        id: id.stepInstance(maHoSo, order),
        applicationId: appId,
        workflowStepId: id.workflowStep(String(app.workflowId), String(st.id)),
        stepOrder: order,
        ten: String(st.ten),
        role: st.role as never,
        mode: st.mode as never,
        trangThai: trangThai as never,
        slaDueAt: d(app.hanXuLy),
        startedAt: trangThai === 'PENDING' ? null : d(app.ngayNop),
        completedAt: trangThai === 'APPROVED' ? (doneAt ?? d(app.ngayCapNhat)) : null,
      })
    }
  }

  await prisma.applicationAttachment.createMany({ data: attachments as never })
  await prisma.stepInstance.createMany({ data: stepInstances as never })
  await prisma.approval.createMany({ data: approvals as never })

  // --- Văn bản đã cấp -----------------------------------------------------
  await prisma.signedDocument.createMany({
    data: documentList.map((doc) => {
      const revoked = doc.trangThai === 'REVOKED'
      return {
        id: id.document(String(doc.id)),
        soVanBan: String(doc.soVanBan),
        trichYeu: String(doc.trichYeu),
        loaiVanBan: String(doc.loaiVanBan),
        templateId: asRef(mapTemplate, doc.templateId),
        applicationId: asRef(mapApplication, doc.applicationId)!,
        sinhVienSnapshot: (doc.sinhVien as never) ?? {},
        noiDung: String(doc.noiDung),
        ngayCap: d(doc.ngayCap)!,
        // Token xác thực thật (256 bit) sinh tất định từ id mock.
        // Bản mock chỉ có token 96 bit; Giai đoạn 5 sẽ sinh token thật khi phát hành.
        tokenXacThuc: createHash('sha256').update(`motcua:token:${String(doc.id)}`).digest('hex'),
        maBamSha256: String(doc.maBamSha256),
        trangThai: doc.trangThai as never,
        chuKyConHieuLuc: Boolean(doc.chuKyConHieuLuc),
        lyDoThuHoi: revoked ? 'Phát hiện sai sót thông tin trên văn bản, thu hồi để cấp lại.' : null,
        ngayThuHoi: revoked ? d(doc.ngayCap) : null,
        createdAt: d(doc.ngayCap)!,
      }
    }),
  })

  // --- Chữ ký -------------------------------------------------------------
  await prisma.signature.createMany({
    data: signatureList.map((s) => ({
      id: id.signature(String(s.id)),
      applicationId: asRef(mapApplication, s.applicationId)!,
      vanBanId: s.vanBanId ? asRef(mapDocument, s.vanBanId) : null,
      buocOrder: Number(s.buocOrder),
      tenBuoc: String(s.tenBuoc),
      nguoiKyId: asRef(mapUser, s.nguoiKyId)!,
      hoTen: String(s.hoTen),
      chucVu: (s.chucVu as string) ?? null,
      vaiTro: s.vaiTro as never,
      phuongThuc: s.phuongThuc as never,
      thoiDiemKy: d(s.thoiDiemKy)!,
      maBam: String(s.maBam),
      maChuKy: String(s.maChuKy),
      hopLe: Boolean(s.hopLe),
    })),
  })

  // --- Lượt tải văn bản ---------------------------------------------------
  const downloads: Dict[] = []
  for (const doc of documentList) {
    for (const dl of (doc.luotTai as Dict[]) ?? []) {
      downloads.push({
        id: id.download(String(dl.id)),
        documentId: id.document(String(doc.id)),
        nguoiTaiId: asRef(mapUser, userByHoTen.get(String(dl.nguoiTai))?.id),
        nguoiTaiTen: String(dl.nguoiTai),
        diaChiIp: String(dl.diaChiIp),
        userAgent: null,
        mucDich: 'download',
        createdAt: d(dl.luc)!,
      })
    }
  }
  await prisma.documentDownload.createMany({ data: downloads as never })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    process.stderr.write(`${String(error)}\n`)
    await prisma.$disconnect()
    process.exit(1)
  })
