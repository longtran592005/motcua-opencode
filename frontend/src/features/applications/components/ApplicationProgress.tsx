import { StepProgress, type StepProgressStep } from '@/components/common/StepProgress'
import { APPROVAL_ROLES, ROLE_LABELS, type Application } from '@/types'

interface ApplicationProgressProps {
  application: Pick<Application, 'trangThai' | 'tongSoBuoc' | 'buocDaDuyet' | 'buocHienTai'>
  compact?: boolean
  className?: string
}

/** Tiến trình duyệt của một hồ sơ, dựng từ số bước và vai trò chuẩn. */
export function ApplicationProgress({
  application,
  compact,
  className,
}: ApplicationProgressProps) {
  const soBuoc = Math.max(1, application.tongSoBuoc)
  const steps: StepProgressStep[] = APPROVAL_ROLES.slice(0, soBuoc).map((role, index) => ({
    order: index + 1,
    ten: ROLE_LABELS[role],
    roleLabel: ROLE_LABELS[role],
  }))

  const dangChoOrder =
    application.trangThai === 'PENDING_APPROVAL' || application.trangThai === 'SUBMITTED'
      ? (application.buocHienTai?.order ?? application.buocDaDuyet + 1)
      : null

  return (
    <StepProgress
      steps={steps}
      buocDaDuyet={application.trangThai === 'COMPLETED' ? soBuoc : application.buocDaDuyet}
      dangChoOrder={dangChoOrder}
      compact={compact}
      className={className}
    />
  )
}
