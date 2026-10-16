import type { Role } from './Role'

/** Chế độ duyệt của một bước. */
export const APPROVAL_MODES = ['ONE_CLICK', 'OTP'] as const
export type ApprovalMode = (typeof APPROVAL_MODES)[number]

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  ONE_CLICK: 'Một chạm',
  OTP: 'Ký OTP',
}

export interface WorkflowStep {
  id: string
  order: number
  ten: string
  role: Role
  mode: ApprovalMode
  /** Thời hạn xử lý theo giờ. */
  slaHours: number
  allowReject: boolean
  allowSupplement: boolean
  moTa?: string
}

export interface Workflow {
  id: string
  ma: string
  ten: string
  /** Danh sách id loại đơn áp dụng luồng này. */
  requestTypeIds: string[]
  steps: WorkflowStep[]
  hoatDong: boolean
  capDo: 1 | 2 | 3
}

/** Bước kế tiếp sau khi một cấp duyệt xong. */
export function nextStep(
  workflow: Workflow,
  currentOrder: number,
): WorkflowStep | null {
  return (
    workflow.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((s) => s.order > currentOrder) ?? null
  )
}

export function firstStep(workflow: Workflow): WorkflowStep | null {
  return (
    workflow.steps.slice().sort((a, b) => a.order - b.order)[0] ?? null
  )
}
