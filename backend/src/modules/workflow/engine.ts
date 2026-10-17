/**
 * Workflow engine (Giai đoạn 4).
 *
 * Mọi thay đổi trạng thái của hồ sơ đi qua **một** hàm `transition()`:
 *   DRAFT ──SUBMIT──▶ SUBMITTED ──APPROVE──▶ PENDING_APPROVAL ──APPROVE(cuối)──▶ COMPLETED
 *                          │                        │
 *                          │                        ├──REJECT──▶ REJECTED
 *                          │                        └──REQUEST_SUPPLEMENT──▶ NEED_SUPPLEMENT
 *                          │                                                     │
 *                          └──────────────CANCEL──▶ CANCELLED      SUPPLEMENT────┘
 *
 * Ba bảo đảm kỹ thuật:
 *  1. **Khoá dòng**: mỗi lần chuyển trạng thái mở đầu bằng `SELECT … FOR UPDATE`
 *     trên hàng `applications`, nên hai người duyệt cùng lúc được tuần tự hoá;
 *     người thứ hai thấy bước đã xử lý ⇒ `ALREADY_PROCESSED`.
 *  2. **Ảnh chụp luồng**: lúc nộp, luồng duyệt được đóng băng vào
 *     `applications.workflow_snapshot` và vào từng hàng `step_instances`. Sửa
 *     workflow sau đó KHÔNG làm đổi đơn đang chạy.
 *  3. **Chữ ký kiểm chứng được**: xem `lib/signature.ts`.
 */
import type {
  ApplicationStatus,
  ApprovalMode,
  Prisma,
  Role,
} from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { assertInScope, type ScopeUser } from '../../lib/scope'
import { getSignatureProvider, payloadHash, signaturePayloadOf } from '../../lib/signature'
import { addHours, naturalAssigneeOf, pickAssignee, stepAfter } from '../shared/workflow'
import { activeDelegationFor } from '../delegations/service'
import { consumeOtp } from '../otp/service'
import { issueDocument } from '../documents/issuer'
import { applicationInclude, type ApplicationRow } from '../shared/dto'

/* ==================================================================== *
 * 1. Ảnh chụp luồng duyệt
 * ==================================================================== */

export interface SnapshotStep {
  /** `workflow_steps.id` — null nếu dựng từ ảnh chụp cũ. */
  id: string | null
  order: number
  ten: string
  role: Role
  mode: ApprovalMode
  slaHours: number
  nhacTruocGio: number
  leoThangSauGio: number
  escalateTo: Role | null
  allowReject: boolean
  allowSupplement: boolean
  moTa: string | null
}

export interface WorkflowSnapshot {
  workflowId: string
  ma: string
  ten: string
  version: number
  capDo: number
  chupLuc: string
  steps: SnapshotStep[]
}

type WorkflowWithSteps = {
  id: string
  ma: string
  ten: string
  version: number
  capDo: number
  steps: Array<SnapshotStep>
}

/** Dựng ảnh chụp luồng từ luồng sống (dùng đúng lúc nộp hồ sơ). */
export function buildSnapshot(wf: WorkflowWithSteps, luc: Date = new Date()): WorkflowSnapshot {
  return {
    workflowId: wf.id,
    ma: wf.ma,
    ten: wf.ten,
    version: wf.version,
    capDo: wf.capDo,
    chupLuc: luc.toISOString(),
    steps: [...wf.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        id: s.id,
        order: s.order,
        ten: s.ten,
        role: s.role,
        mode: s.mode,
        slaHours: s.slaHours,
        nhacTruocGio: s.nhacTruocGio ?? 12,
        leoThangSauGio: s.leoThangSauGio ?? 24,
        escalateTo: s.escalateTo ?? null,
        allowReject: s.allowReject,
        allowSupplement: s.allowSupplement,
        moTa: s.moTa ?? null,
      })),
  }
}

/** Đọc ảnh chụp từ JSON đã lưu (bỏ qua dữ liệu hỏng). */
export function readSnapshot(value: unknown): WorkflowSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snap = value as WorkflowSnapshot
  if (!Array.isArray(snap.steps) || snap.steps.length === 0) return null
  return snap
}

/**
 * Các bước hiệu lực của một hồ sơ: ưu tiên ẢNH CHỤP; nếu hồ sơ được nộp trước
 * Giai đoạn 4 (chưa có ảnh chụp) thì lùi về luồng sống để vẫn xử lý được.
 */
export function workflowStepsOf(
  app: Pick<ApplicationRow, 'workflowSnapshot' | 'workflow'>,
): SnapshotStep[] {
  const snap = readSnapshot(app.workflowSnapshot)
  if (snap) return [...snap.steps].sort((a, b) => a.order - b.order)
  const live = app.workflow?.steps ?? []
  return [...live]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      order: s.order,
      ten: s.ten,
      role: s.role,
      mode: s.mode,
      slaHours: s.slaHours,
      nhacTruocGio: s.nhacTruocGio ?? 12,
      leoThangSauGio: s.leoThangSauGio ?? 24,
      escalateTo: s.escalateTo ?? null,
      allowReject: s.allowReject,
      allowSupplement: s.allowSupplement,
      moTa: s.moTa ?? null,
    }))
}

/** Bước đã đóng băng tương ứng với một hàng `step_instances`. */
export function stepDefOf(app: ApplicationRow, si: ApplicationRow['stepInstances'][number]): SnapshotStep {
  const fromSnapshot = workflowStepsOf(app).find((s) => s.order === si.stepOrder)
  if (fromSnapshot) return fromSnapshot
  return {
    id: si.workflowStepId,
    order: si.stepOrder,
    ten: si.ten,
    role: si.role,
    mode: si.mode,
    slaHours: si.slaHours,
    nhacTruocGio: si.nhacTruocGio,
    leoThangSauGio: si.leoThangSauGio,
    escalateTo: si.escalateTo,
    allowReject: si.allowReject,
    allowSupplement: si.allowSupplement,
    moTa: null,
  }
}

/* ==================================================================== *
 * 2. Khoá dòng + đọc lại trạng thái mới nhất
 * ==================================================================== */

/** `SELECT … FOR UPDATE` trên hàng hồ sơ — tuần tự hoá mọi chuyển trạng thái. */
export async function lockApplication(tx: Prisma.TransactionClient, id: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM applications WHERE id = ${id}::uuid FOR UPDATE
  `
  if (rows.length === 0) throw AppError.notFound('Không tìm thấy hồ sơ.')
}

/* ==================================================================== *
 * 3. Ma trận chuyển trạng thái
 * ==================================================================== */

export const TRANSITION_ACTIONS = [
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'REQUEST_SUPPLEMENT',
  'SUPPLEMENT',
  'CANCEL',
] as const
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number]

export interface TransitionRule {
  action: TransitionAction
  tu: ApplicationStatus[]
  ketQua: ApplicationStatus
  ai: 'CHU_HO_SO' | 'CAP_DUYET'
  nhan: string
}

export const TRANSITION_RULES: TransitionRule[] = [
  { action: 'SUBMIT', tu: ['DRAFT'], ketQua: 'SUBMITTED', ai: 'CHU_HO_SO', nhan: 'Nộp hồ sơ' },
  {
    action: 'APPROVE',
    tu: ['SUBMITTED', 'PENDING_APPROVAL'],
    ketQua: 'PENDING_APPROVAL',
    ai: 'CAP_DUYET',
    nhan: 'Phê duyệt bước',
  },
  {
    action: 'REJECT',
    tu: ['SUBMITTED', 'PENDING_APPROVAL'],
    ketQua: 'REJECTED',
    ai: 'CAP_DUYET',
    nhan: 'Từ chối hồ sơ',
  },
  {
    action: 'REQUEST_SUPPLEMENT',
    tu: ['SUBMITTED', 'PENDING_APPROVAL'],
    ketQua: 'NEED_SUPPLEMENT',
    ai: 'CAP_DUYET',
    nhan: 'Yêu cầu bổ sung',
  },
  {
    action: 'SUPPLEMENT',
    tu: ['NEED_SUPPLEMENT'],
    ketQua: 'PENDING_APPROVAL',
    ai: 'CHU_HO_SO',
    nhan: 'Bổ sung hồ sơ',
  },
  {
    action: 'CANCEL',
    tu: ['SUBMITTED', 'PENDING_APPROVAL', 'NEED_SUPPLEMENT'],
    ketQua: 'CANCELLED',
    ai: 'CHU_HO_SO',
    nhan: 'Rút hồ sơ',
  },
]

export function isTransitionAllowed(
  trangThai: ApplicationStatus,
  action: TransitionAction,
): boolean {
  return TRANSITION_RULES.some((r) => r.action === action && r.tu.includes(trangThai))
}

export function ruleOf(action: TransitionAction): TransitionRule {
  const rule = TRANSITION_RULES.find((r) => r.action === action)
  if (!rule) throw new Error(`Hành động không có trong ma trận: ${action}`)
  return rule
}

/* ==================================================================== *
 * 4. Quyền phê duyệt (vai trò, người được giao, ủy quyền, leo thang)
 * ==================================================================== */

export type StepInstanceRow = ApplicationRow['stepInstances'][number]

export function findStepInstance(app: ApplicationRow, order: number): StepInstanceRow | null {
  return app.stepInstances.find((s) => s.stepOrder === order) ?? null
}

export function currentStepInstance(app: ApplicationRow): StepInstanceRow | null {
  return findStepInstance(app, app.currentStepOrder)
}

export interface AuthorityResult {
  coQuyen: boolean
  /** Có phải kiểm tra thêm phạm vi dữ liệu (khoa/lớp) không. */
  yeuCauPhamVi: boolean
  quaUyQuyen: boolean
  quaLeoThang: boolean
  lyDo?: string
}

/**
 * Xác định quyền phê duyệt một bước, theo thứ tự:
 *  (0) ADMIN                      → toàn trường;
 *  (a) chính người được giao      → còn hiệu lực nếu do ủy quyền mà có;
 *  (b) người nhận ủy quyền        → chỉ khi ủy quyền CÒN hiệu lực theo ngày;
 *  (c) vai trò cấp trên (leo thang) → chỉ sau khi job SLA đã leo thang;
 *  (d) đúng vai trò của bước      → kèm kiểm tra phạm vi dữ liệu.
 */
export async function xacDinhThamQuyen(
  app: ApplicationRow,
  si: StepInstanceRow,
  user: ScopeUser,
  at: Date = new Date(),
): Promise<AuthorityResult> {
  if (user.role === 'ADMIN') {
    return { coQuyen: true, yeuCauPhamVi: true, quaUyQuyen: false, quaLeoThang: false }
  }

  const natural = await naturalAssigneeOf(
    { role: si.role },
    { classId: app.classId, facultyId: app.facultyId },
  )

  if (si.assigneeId && user.id === si.assigneeId) {
    // Được giao đúng người tự nhiên của bước ⇒ không cần ủy quyền.
    if (!natural || natural === user.id) {
      return { coQuyen: true, yeuCauPhamVi: false, quaUyQuyen: false, quaLeoThang: false }
    }
    // Được giao nhờ ủy quyền ⇒ phải còn hiệu lực tại thời điểm này.
    const uyQuyen = await activeDelegationFor(natural, si.role, user.id, at)
    return uyQuyen
      ? { coQuyen: true, yeuCauPhamVi: false, quaUyQuyen: true, quaLeoThang: false }
      : {
          coQuyen: false,
          yeuCauPhamVi: false,
          quaUyQuyen: false,
          quaLeoThang: false,
          lyDo: 'Ủy quyền duyệt hồ sơ này đã hết hiệu lực.',
        }
  }

  if (natural && user.id !== natural) {
    const uyQuyen = await activeDelegationFor(natural, si.role, user.id, at)
    if (uyQuyen) {
      return { coQuyen: true, yeuCauPhamVi: false, quaUyQuyen: true, quaLeoThang: false }
    }
  }

  if (si.leoThangLuc && si.escalateTo && si.escalateTo === user.role) {
    return { coQuyen: true, yeuCauPhamVi: true, quaUyQuyen: false, quaLeoThang: true }
  }

  if (si.role === user.role) {
    return { coQuyen: true, yeuCauPhamVi: true, quaUyQuyen: false, quaLeoThang: false }
  }

  return { coQuyen: false, yeuCauPhamVi: true, quaUyQuyen: false, quaLeoThang: false }
}

/**
 * Bốn điều kiện bắt buộc trước khi cho phép phê duyệt (quyết định B1/B2/D7):
 * trạng thái chờ duyệt → bước chưa bị xử lý (`ALREADY_PROCESSED`) → quyền → phạm vi.
 * Thứ tự này là chủ ý: kiểm tra "đã xử lý" TRƯỚC kiểm tra quyền.
 */
export async function assertCanApprove(
  app: ApplicationRow,
  user: ScopeUser,
): Promise<StepInstanceRow> {
  if (app.trangThai !== 'PENDING_APPROVAL' && app.trangThai !== 'SUBMITTED') {
    throw AppError.invalidTransition('Hồ sơ không ở trạng thái chờ duyệt nên không thể phê duyệt.')
  }
  const si = currentStepInstance(app)
  if (!si) throw AppError.invalidTransition('Hồ sơ không có bước xử lý hiện tại.')
  if (si.trangThai === 'APPROVED' || si.trangThai === 'REJECTED') {
    throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
  }
  if (si.trangThai === 'SKIPPED') {
    throw AppError.invalidTransition('Bước xử lý này đã bị bỏ qua.')
  }

  const quyen = await xacDinhThamQuyen(app, si, user)
  if (!quyen.coQuyen) {
    throw AppError.forbidden(quyen.lyDo ?? 'Hồ sơ này không thuộc cấp xử lý của bạn.')
  }
  if (quyen.yeuCauPhamVi) assertInScope(app, user)
  return si
}

/* ==================================================================== *
 * 5. transition() — cửa duy nhất cho mọi chuyển trạng thái
 * ==================================================================== */

export interface TransitionActor {
  id: string
  role: Role
  hoTen: string
  chucVu: string | null
  facultyId: string | null
}

export interface TransitionInput {
  action: TransitionAction
  appId: string
  actor: TransitionActor
  ghiChu?: string | null
  lyDo?: string | null
  /** APPROVE bước OTP: mã đã gửi cho người duyệt (tiêu thụ trong cùng giao dịch). */
  otp?: { challengeId: string; ma: string } | null
  /** SUPPLEMENT: dữ liệu biểu mẫu bổ sung (hợp nhất với dữ liệu cũ). */
  duLieu?: Record<string, unknown> | null
  /** SUPPLEMENT: tệp đính kèm bổ sung. */
  tepDinhKem?: Prisma.ApplicationAttachmentCreateManyInput[] | null
  /**
   * Bước mà NGƯỜI GỌI ĐÃ THẤY khi kiểm tra sớm (nghiệp vụ đọc trước giao dịch).
   * Nếu bước đó đã bị người khác xử lý trong lúc chờ khoá ⇒ `ALREADY_PROCESSED`,
   * kể cả khi hồ sơ đã chuyển sang bước kế tiếp.
   */
  expectedStepOrder?: number | null
  idempotencyKey?: string | null
}

export interface TransitionOutcome {
  action: TransitionAction
  appId: string
  maHoSo: string
  trangThaiTruoc: ApplicationStatus
  trangThaiSau: ApplicationStatus
  stepInstanceId: string | null
  buocOrder: number
  buocKeTiep: SnapshotStep | null
  quayVeBuoc: SnapshotStep | null
  vanBan: { id: string; soVanBan: string } | null
  signatureId: string | null
}

export function actorOf(user: {
  id: string
  role: Role
  hoTen: string
  chucVu: string | null
  facultyId: string | null
}): TransitionActor {
  return {
    id: user.id,
    role: user.role,
    hoTen: user.hoTen,
    chucVu: user.chucVu,
    facultyId: user.facultyId,
  }
}

function assertChuHoSo(app: ApplicationRow, actor: TransitionActor): void {
  if (app.applicantId !== actor.id) throw AppError.forbidden('Bạn không sở hữu hồ sơ này.')
}

function assertTransition(app: ApplicationRow, action: TransitionAction): void {
  if (!isTransitionAllowed(app.trangThai, action)) {
    throw AppError.invalidTransition(
      `Không thể "${ruleOf(action).nhan}" khi hồ sơ đang ở trạng thái ${app.trangThai}.`,
    )
  }
}

/** Chạy một chuyển trạng thái trong giao dịch, sau khi đã khoá hàng hồ sơ. */
async function runTransition(
  tx: Prisma.TransactionClient,
  app: ApplicationRow,
  input: TransitionInput,
): Promise<TransitionOutcome> {
  const now = new Date()
  const base: Omit<TransitionOutcome, 'trangThaiSau' | 'stepInstanceId' | 'buocOrder'> = {
    action: input.action,
    appId: app.id,
    maHoSo: app.maHoSo,
    trangThaiTruoc: app.trangThai,
    buocKeTiep: null,
    quayVeBuoc: null,
    vanBan: null,
    signatureId: null,
  }

  /* ------------------------------- SUBMIT ------------------------------- */
  if (input.action === 'SUBMIT') {
    assertChuHoSo(app, input.actor)
    assertTransition(app, 'SUBMIT')
    if (!app.workflow) throw AppError.validation('Loại đơn chưa được gắn luồng duyệt.')

    const snapshot = buildSnapshot(app.workflow, now)
    const steps = snapshot.steps
    if (!steps.length) throw AppError.validation('Luồng duyệt chưa có bước xử lý nào.')
    const first = steps[0]
    const assigneeId = await pickAssignee(first, {
      classId: app.classId,
      facultyId: app.facultyId,
    })

    await tx.stepInstance.createMany({
      data: steps.map((s) => ({
        applicationId: app.id,
        workflowStepId: s.id,
        stepOrder: s.order,
        ten: s.ten,
        role: s.role,
        mode: s.mode,
        slaHours: s.slaHours,
        nhacTruocGio: s.nhacTruocGio,
        leoThangSauGio: s.leoThangSauGio,
        escalateTo: s.escalateTo,
        allowReject: s.allowReject,
        allowSupplement: s.allowSupplement,
        trangThai: s.order === first.order ? 'IN_PROGRESS' : 'PENDING',
        assigneeId: s.order === first.order ? assigneeId : null,
        startedAt: s.order === first.order ? now : null,
        slaDueAt: s.order === first.order ? addHours(now, s.slaHours) : null,
      })),
    })

    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'SUBMITTED',
        workflowSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        workflowId: app.workflow.id,
        workflowVersion: app.workflow.version,
        currentStepOrder: first.order,
        tongSoBuoc: steps.length,
        buocDaDuyet: 0,
        ngayNop: now,
        hanXuLy: addHours(now, first.slaHours),
      },
    })

    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'SUBMIT',
        actorId: input.actor.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: input.ghiChu ?? 'Sinh viên nộp hồ sơ.',
      },
    })

    return {
      ...base,
      trangThaiSau: 'SUBMITTED',
      stepInstanceId: null,
      buocOrder: first.order,
      buocKeTiep: first,
    }
  }

  /* ------------------------------- CANCEL ------------------------------- */
  if (input.action === 'CANCEL') {
    assertChuHoSo(app, input.actor)
    assertTransition(app, 'CANCEL')
    if (app.buocDaDuyet > 0) {
      throw AppError.invalidTransition('Hồ sơ đã được phê duyệt ở một cấp nên không thể rút.')
    }

    await tx.application.update({
      where: { id: app.id },
      data: { trangThai: 'CANCELLED', hanXuLy: null },
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { trangThai: 'SKIPPED', completedAt: now },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'CANCEL',
        actorId: input.actor.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: input.lyDo ?? input.ghiChu ?? 'Sinh viên chủ động rút hồ sơ.',
        lyDo: input.lyDo ?? null,
      },
    })

    return { ...base, trangThaiSau: 'CANCELLED', stepInstanceId: null, buocOrder: 0 }
  }

  /* ----------------------------- SUPPLEMENT ----------------------------- */
  if (input.action === 'SUPPLEMENT') {
    assertChuHoSo(app, input.actor)
    assertTransition(app, 'SUPPLEMENT')

    const steps = workflowStepsOf(app)
    if (!steps.length) throw AppError.validation('Hồ sơ chưa gắn luồng duyệt.')
    const yeuCau = (app.yeuCauBoSung ?? {}) as Record<string, unknown>
    const quayVeOrder = Number(yeuCau.quayVeBuocOrder ?? steps[0].order)
    // Quay về ĐÚNG cấp đã yêu cầu bổ sung (theo ảnh chụp luồng tại lúc nộp).
    const quayVe = steps.find((s) => s.order === quayVeOrder) ?? steps[0]

    const duLieuMoi = { ...((app.duLieu ?? {}) as Record<string, unknown>), ...(input.duLieu ?? {}) }
    const assigneeId = await pickAssignee(quayVe, {
      classId: app.classId,
      facultyId: app.facultyId,
    })

    if (input.tepDinhKem?.length) {
      await tx.applicationAttachment.createMany({ data: input.tepDinhKem })
    }

    await tx.application.update({
      where: { id: app.id },
      data: {
        duLieu: duLieuMoi as Prisma.InputJsonValue,
        yeuCauBoSung: { ...yeuCau, daBoSung: true } as Prisma.InputJsonValue,
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: quayVe.order,
        hanXuLy: addHours(now, quayVe.slaHours),
      },
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, stepOrder: quayVe.order },
      data: {
        trangThai: 'IN_PROGRESS',
        assigneeId,
        startedAt: now,
        slaDueAt: addHours(now, quayVe.slaHours),
        daQuaHan: false,
        nhacLuc: null,
        leoThangLuc: null,
      },
    })
    await tx.approval.create({
      data: {
        applicationId: app.id,
        buocOrder: 0,
        hanhDong: 'SUPPLEMENT',
        actorId: input.actor.id,
        vaiTro: 'SINH_VIEN',
        ghiChu: input.ghiChu ?? 'Sinh viên bổ sung hồ sơ theo yêu cầu.',
      },
    })

    return {
      ...base,
      trangThaiSau: 'PENDING_APPROVAL',
      stepInstanceId: null,
      buocOrder: quayVe.order,
      quayVeBuoc: quayVe,
      buocKeTiep: quayVe,
    }
  }

  /* ------------------- Các hành động của cấp phê duyệt ------------------- */
  /*
   * Người gọi đã kiểm tra sớm ở một bước cụ thể; nếu bước đó đã bị người khác
   * xử lý trong lúc chờ khoá (kể cả khi hồ sơ đã đi tiếp) thì đây là
   * ALREADY_PROCESSED — không phải lỗi trạng thái của hồ sơ.
   */
  if (input.expectedStepOrder && input.expectedStepOrder !== app.currentStepOrder) {
    const daXet = findStepInstance(app, input.expectedStepOrder)
    if (daXet && (daXet.trangThai === 'APPROVED' || daXet.trangThai === 'REJECTED')) {
      throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
    }
    throw AppError.invalidTransition(
      `Hồ sơ đã chuyển sang bước khác (bạn đang xử lý bước ${input.expectedStepOrder}).`,
    )
  }

  const si = await assertCanApprove(app, input.actor)
  const stepDef = stepDefOf(app, si)
  const steps = workflowStepsOf(app)

  if (input.action === 'REJECT') {
    if (!stepDef.allowReject) {
      throw AppError.invalidTransition('Bước duyệt này không cho phép từ chối hồ sơ.')
    }
    await tx.approval.create({
      data: {
        applicationId: app.id,
        stepInstanceId: si.id,
        buocOrder: si.stepOrder,
        hanhDong: 'REJECT',
        actorId: input.actor.id,
        vaiTro: input.actor.role,
        chucVu: input.actor.chucVu,
        ghiChu: input.ghiChu ?? null,
        lyDo: input.lyDo ?? null,
      },
    })
    const claimed = await tx.stepInstance.updateMany({
      where: { id: si.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { trangThai: 'REJECTED', completedAt: now },
    })
    if (claimed.count === 0) {
      throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
    }
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, trangThai: 'PENDING' },
      data: { trangThai: 'SKIPPED', completedAt: now },
    })
    await tx.application.update({
      where: { id: app.id },
      data: { trangThai: 'REJECTED', lyDoTuChoi: input.lyDo ?? null, hanXuLy: null },
    })
    return {
      ...base,
      trangThaiSau: 'REJECTED',
      stepInstanceId: si.id,
      buocOrder: si.stepOrder,
    }
  }

  if (input.action === 'REQUEST_SUPPLEMENT') {
    if (!stepDef.allowSupplement) {
      throw AppError.invalidTransition('Bước duyệt này không cho phép yêu cầu bổ sung.')
    }
    const noiDung = (input.lyDo ?? input.ghiChu ?? '').trim()
    if (!noiDung) throw AppError.validation('Vui lòng nhập nội dung cần bổ sung.')

    await tx.approval.create({
      data: {
        applicationId: app.id,
        stepInstanceId: si.id,
        buocOrder: si.stepOrder,
        hanhDong: 'REQUEST_SUPPLEMENT',
        actorId: input.actor.id,
        vaiTro: input.actor.role,
        chucVu: input.actor.chucVu,
        lyDo: noiDung,
      },
    })
    const claimed = await tx.stepInstance.updateMany({
      where: { id: si.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: {
        trangThai: 'PENDING',
        completedAt: null,
        startedAt: null,
        slaDueAt: null,
        daQuaHan: false,
        nhacLuc: null,
        leoThangLuc: null,
      },
    })
    if (claimed.count === 0) {
      throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
    }
    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'NEED_SUPPLEMENT',
        currentStepOrder: 0,
        hanXuLy: null,
        yeuCauBoSung: {
          noiDung,
          boiAiId: input.actor.id,
          boiAiTen: input.actor.hoTen,
          luc: now.toISOString(),
          daBoSung: false,
          quayVeBuocOrder: si.stepOrder,
        } as Prisma.InputJsonValue,
      },
    })
    const quayVe = steps.find((s) => s.order === si.stepOrder) ?? null
    return {
      ...base,
      trangThaiSau: 'NEED_SUPPLEMENT',
      stepInstanceId: si.id,
      buocOrder: si.stepOrder,
      quayVeBuoc: quayVe,
    }
  }

  /* ------------------------------- APPROVE ------------------------------ */
  if (stepDef.mode === 'OTP' && !input.otp) {
    throw AppError.validation('Bước này yêu cầu ký OTP. Vui lòng gửi và nhập mã OTP.', {
      truongThieu: ['challengeId', 'otp'],
    })
  }

  // (1) Chiếm bước một cách nguyên tử (quyết định D7).
  const claimed = await tx.stepInstance.updateMany({
    where: { id: si.id, trangThai: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { trangThai: 'APPROVED', completedAt: now },
  })
  if (claimed.count === 0) {
    throw new AppError('ALREADY_PROCESSED', 'Bước xử lý này đã được người khác xử lý.')
  }

  // (2) Tiêu thụ OTP trong cùng giao dịch (sai mã ⇒ rollback cả bước).
  if (stepDef.mode === 'OTP') {
    await consumeOtp(tx, {
      challengeId: input.otp!.challengeId,
      otp: input.otp!.ma,
      userId: input.actor.id,
      applicationId: app.id,
      stepOrder: si.stepOrder,
    })
  }

  // (3) Ký số nội dung tại thời điểm duyệt.
  const phuongThuc = stepDef.mode === 'OTP' ? 'OTP' : 'ELECTRONIC'
  const payload = signaturePayloadOf(app, {
    buocOrder: si.stepOrder,
    tenBuoc: si.ten,
    nguoiKyId: input.actor.id,
    vaiTro: input.actor.role,
    phuongThuc,
    thoiDiemKy: now,
  })
  const maBam = payloadHash(payload)
  const provider = getSignatureProvider()
  const sig = await tx.signature.create({
    data: {
      applicationId: app.id,
      buocOrder: si.stepOrder,
      tenBuoc: si.ten,
      nguoiKyId: input.actor.id,
      hoTen: input.actor.hoTen,
      chucVu: input.actor.chucVu,
      vaiTro: input.actor.role,
      phuongThuc,
      thoiDiemKy: now,
      maBam,
      maChuKy: provider.ky(maBam),
      hopLe: true,
      provider: provider.ten,
    },
  })

  await tx.approval.create({
    data: {
      applicationId: app.id,
      stepInstanceId: si.id,
      buocOrder: si.stepOrder,
      hanhDong: 'APPROVE',
      actorId: input.actor.id,
      vaiTro: input.actor.role,
      chucVu: input.actor.chucVu,
      ghiChu: input.ghiChu ?? null,
      phuongThuc: stepDef.mode,
      signatureId: sig.id,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  })

  const next = stepAfter(steps, si.stepOrder)
  const outBase = {
    ...base,
    stepInstanceId: si.id,
    buocOrder: si.stepOrder,
    signatureId: sig.id,
  }

  if (next) {
    const assigneeId = await pickAssignee(next, {
      classId: app.classId,
      facultyId: app.facultyId,
    })
    await tx.stepInstance.updateMany({
      where: { applicationId: app.id, stepOrder: next.order },
      data: {
        trangThai: 'IN_PROGRESS',
        assigneeId,
        startedAt: now,
        slaDueAt: addHours(now, next.slaHours),
        daQuaHan: false,
        nhacLuc: null,
        leoThangLuc: null,
      },
    })
    await tx.application.update({
      where: { id: app.id },
      data: {
        trangThai: 'PENDING_APPROVAL',
        currentStepOrder: next.order,
        buocDaDuyet: si.stepOrder,
        hanXuLy: addHours(now, next.slaHours),
      },
    })
    return { ...outBase, trangThaiSau: 'PENDING_APPROVAL', buocKeTiep: next }
  }

  const doc = await issueDocument(tx, { app, now, actorId: input.actor.id })
  await tx.application.update({
    where: { id: app.id },
    data: {
      trangThai: 'COMPLETED',
      buocDaDuyet: si.stepOrder,
      ngayHoanThanh: now,
      hanXuLy: null,
    },
  })
  await tx.approval.create({
    data: {
      applicationId: app.id,
      buocOrder: steps.length,
      hanhDong: 'ISSUE_DOCUMENT',
      actorId: input.actor.id,
      vaiTro: input.actor.role,
      chucVu: input.actor.chucVu,
      ghiChu: `Cấp văn bản số ${doc.soVanBan}, ký số và sinh mã QR xác thực.`,
    },
  })
  return {
    ...outBase,
    trangThaiSau: 'COMPLETED',
    buocKeTiep: null,
    vanBan: { id: doc.id, soVanBan: doc.soVanBan },
  }
}

/**
 * Cửa duy nhất cho mọi chuyển trạng thái: khoá hàng → đọc lại trạng thái mới
 * nhất → chạy nghiệp vụ trong cùng giao dịch.
 */
export async function transition(input: TransitionInput): Promise<TransitionOutcome> {
  return prisma.$transaction(
    async (tx) => {
      await lockApplication(tx, input.appId)
      const app = await tx.application.findFirst({
        where: { id: input.appId, deletedAt: null },
        include: applicationInclude,
      })
      if (!app) throw AppError.notFound('Không tìm thấy hồ sơ.')
      return runTransition(tx, app, input)
    },
    { timeout: 20_000 },
  )
}
