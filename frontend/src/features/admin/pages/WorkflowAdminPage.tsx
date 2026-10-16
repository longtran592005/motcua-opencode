import * as React from 'react'
import { ArrowRight, GitBranch, Pencil, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import {
  useAdminRequestTypes,
  useAdminWorkflows,
  useRemoveWorkflow,
  useSaveWorkflow,
} from '../hooks/useAdmin'
import { APPROVAL_ROLES, APPROVAL_MODE_LABELS, ROLE_LABELS, type ApprovalMode, type Role, type Workflow, type WorkflowStep } from '@/types'
import { cn } from '@/lib/utils'

function buocMoi(order: number): WorkflowStep {
  return {
    id: `s_${Math.random().toString(36).slice(2, 9)}`,
    order,
    ten: `Cấp ${order}`,
    role: APPROVAL_ROLES[Math.min(order - 1, APPROVAL_ROLES.length - 1)],
    mode: 'ONE_CLICK',
    slaHours: 24,
    allowReject: true,
    allowSupplement: true,
  }
}

function rong(): Workflow {
  return {
    id: '',
    ma: '',
    ten: '',
    requestTypeIds: [],
    steps: [buocMoi(1)],
    hoatDong: true,
    capDo: 1,
  }
}

/** Trang thiết kế luồng duyệt nhiều cấp (chỉ ADMIN). */
export function WorkflowAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminWorkflows()
  const { data: requestTypes } = useAdminRequestTypes()
  const saveWorkflow = useSaveWorkflow()
  const removeWorkflow = useRemoveWorkflow()

  const [moEditor, setMoEditor] = React.useState(false)
  const [draft, setDraft] = React.useState<Workflow>(rong())
  const [xoaId, setXoaId] = React.useState<string | null>(null)

  function moSua(wf: Workflow) {
    setDraft({ ...wf, steps: wf.steps.map((s) => ({ ...s })), requestTypeIds: [...wf.requestTypeIds] })
    setMoEditor(true)
  }

  const sapXep = [...draft.steps].sort((a, b) => a.order - b.order)

  function capNhatBuoc(index: number, patch: Partial<WorkflowStep>) {
    setDraft({
      ...draft,
      steps: sapXep.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    })
  }

  function diChuyen(from: number, to: number) {
    if (to < 0 || to >= sapXep.length) return
    const danhSach = [...sapXep]
    const [item] = danhSach.splice(from, 1)
    danhSach.splice(to, 0, item)
    setDraft({
      ...draft,
      capDo: Math.min(3, danhSach.length) as 1 | 2 | 3,
      steps: danhSach.map((s, i) => ({ ...s, order: i + 1 })),
    })
  }

  function luu() {
    const payload: Omit<Workflow, 'id'> = {
      ...draft,
      ma: draft.ma.trim().toUpperCase(),
      ten: draft.ten.trim(),
      capDo: Math.min(3, sapXep.length) as 1 | 2 | 3,
      steps: sapXep.map((s, i) => ({ ...s, order: i + 1 })),
    }
    saveWorkflow.mutate(
      { id: draft.id || undefined, input: payload },
      { onSuccess: () => setMoEditor(false) },
    )
  }

  const hopLe = draft.ma.trim() !== '' && draft.ten.trim() !== '' && sapXep.length > 0

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Luồng duyệt"
        moTa="Thiết kế các cấp phê duyệt, chế độ duyệt (một chạm hoặc ký OTP) và thời hạn xử lý."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setDraft(rong())
              setMoEditor(true)
            }}
          >
            <Plus className="size-4" />
            Thêm luồng duyệt
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onThuLai={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          tieuDe="Chưa có luồng duyệt nào"
          moTa="Bấm “Thêm luồng duyệt” để tạo luồng đầu tiên."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((wf) => {
            const steps = [...wf.steps].sort((a, b) => a.order - b.order)
            return (
              <Card key={wf.id} className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-bold text-brand-heading">
                        {wf.ten}
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {wf.ma}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">{wf.steps.length} cấp duyệt</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        wf.hoatDong
                          ? 'border-success/40 bg-success-soft text-success'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {wf.hoatDong ? 'Đang hoạt động' : 'Tạm dừng'}
                    </Badge>
                  </div>

                  <ol className="flex flex-wrap items-center gap-1.5">
                    {steps.map((step, index) => (
                      <li key={step.id} className="flex items-center gap-1.5">
                        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                          {step.ten}
                          <span className="ml-1 font-normal text-muted-foreground">
                            · {ROLE_LABELS[step.role]}
                          </span>
                          {step.mode === 'OTP' && (
                            <Badge className="ml-1.5 bg-warning-soft px-1 py-0 text-[10px] text-warning hover:bg-warning-soft">
                              OTP
                            </Badge>
                          )}
                        </span>
                        {index < steps.length - 1 && (
                          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </li>
                    ))}
                  </ol>

                  <p className="text-xs text-muted-foreground">
                    Áp dụng cho:{' '}
                    {wf.requestTypeIds.length === 0
                      ? '—'
                      : wf.requestTypeIds
                          .map((id) => requestTypes?.find((r) => r.id === id)?.ten ?? id)
                          .join(', ')}
                  </p>

                  <div className="mt-auto flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => moSua(wf)}>
                      <Pencil className="size-4" />
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setXoaId(wf.id)}
                    >
                      <Trash2 className="size-4" />
                      Xoá
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={moEditor} onOpenChange={setMoEditor}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Sửa luồng duyệt' : 'Thêm luồng duyệt'}</DialogTitle>
            <DialogDescription>
              Mỗi bước tương ứng một cấp duyệt và một vai trò xử lý.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wf-ma">
                Mã luồng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wf-ma"
                value={draft.ma}
                onChange={(e) => setDraft({ ...draft, ma: e.target.value })}
                placeholder="WF_GXN_2CAP"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wf-ten">
                Tên luồng <span className="text-destructive">*</span>
              </Label>
              <Input
                id="wf-ten"
                value={draft.ten}
                onChange={(e) => setDraft({ ...draft, ten: e.target.value })}
                placeholder="Luồng 2 cấp: Cố vấn → Phòng Đào tạo"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="wf-hoat-dong" className="cursor-pointer">
                Kích hoạt luồng
              </Label>
              <p className="text-xs text-muted-foreground">
                Luồng tạm dừng sẽ không được chọn cho loại đơn mới.
              </p>
            </div>
            <Switch
              id="wf-hoat-dong"
              checked={draft.hoatDong}
              onCheckedChange={(v) => setDraft({ ...draft, hoatDong: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Loại đơn áp dụng</Label>
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
              {(requestTypes ?? []).map((rt) => {
                const checked = draft.requestTypeIds.includes(rt.id)
                return (
                  <label key={rt.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setDraft({
                          ...draft,
                          requestTypeIds:
                            v === true
                              ? [...draft.requestTypeIds, rt.id]
                              : draft.requestTypeIds.filter((id) => id !== rt.id),
                        })
                      }
                    />
                    {rt.ten}
                  </label>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-brand-heading">Các bước duyệt</p>
                <p className="text-xs text-muted-foreground">
                  Hồ sơ luân chuyển tuần tự theo thứ tự các bước.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setDraft({ ...draft, steps: [...sapXep, buocMoi(sapXep.length + 1)] })}
              >
                <Plus className="size-4" />
                Thêm bước
              </Button>
            </div>

            <ul className="space-y-3">
              {sapXep.map((step, index) => (
                <li key={step.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <Input
                      value={step.ten}
                      placeholder="Tên bước duyệt"
                      onChange={(e) => capNhatBuoc(index, { ten: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => diChuyen(index, index - 1)}
                      disabled={index === 0}
                      aria-label="Di chuyển bước lên"
                    >
                      <span aria-hidden="true">↑</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => diChuyen(index, index + 1)}
                      disabled={index === sapXep.length - 1}
                      aria-label="Di chuyển bước xuống"
                    >
                      <span aria-hidden="true">↓</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          steps: sapXep
                            .filter((_, i) => i !== index)
                            .map((s, i) => ({ ...s, order: i + 1 })),
                        })
                      }
                      disabled={sapXep.length <= 1}
                      aria-label="Xoá bước"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Vai trò xử lý</Label>
                      <Select
                        value={step.role}
                        onValueChange={(v) => capNhatBuoc(index, { role: v as Role })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPROVAL_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Chế độ duyệt</Label>
                      <Select
                        value={step.mode}
                        onValueChange={(v) => capNhatBuoc(index, { mode: v as ApprovalMode })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ONE_CLICK">{APPROVAL_MODE_LABELS.ONE_CLICK}</SelectItem>
                          <SelectItem value="OTP">{APPROVAL_MODE_LABELS.OTP}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>SLA (giờ)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={step.slaHours}
                        onChange={(e) => capNhatBuoc(index, { slaHours: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Switch
                        checked={step.allowReject}
                        onCheckedChange={(v) => capNhatBuoc(index, { allowReject: v })}
                      />
                      Cho phép từ chối
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Switch
                        checked={step.allowSupplement}
                        onCheckedChange={(v) => capNhatBuoc(index, { allowSupplement: v })}
                      />
                      Cho phép yêu cầu bổ sung
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-brand-heading">
              <WorkflowIcon className="size-4 text-primary" aria-hidden="true" />
              Xem trước luồng duyệt
            </p>
            <ol className="flex flex-wrap items-center gap-2">
              <li className="rounded-md bg-background px-2 py-1 text-xs font-semibold">Nộp đơn</li>
              {sapXep.map((step) => (
                <li key={step.id} className="flex items-center gap-2">
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold">
                    {step.ten} · {ROLE_LABELS[step.role]}
                    {step.mode === 'OTP' ? ' · OTP' : ' · Một chạm'}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold">
                  Cấp văn bản
                </span>
              </li>
            </ol>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoEditor(false)}>
              Huỷ
            </Button>
            <Button onClick={luu} disabled={!hopLe || saveWorkflow.isPending}>
              {draft.id ? 'Lưu thay đổi' : 'Tạo luồng duyệt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaId !== null}
        onOpenChange={(open) => !open && setXoaId(null)}
        tieuDe="Xoá luồng duyệt"
        moTa="Các loại đơn đang dùng luồng này cần được gán luồng khác."
        nhanXacNhan="Xoá luồng"
        bienThe="destructive"
        dangXuLy={removeWorkflow.isPending}
        onXacNhan={() => {
          if (!xoaId) return
          removeWorkflow.mutate(xoaId, { onSuccess: () => setXoaId(null) })
        }}
      />
    </div>
  )
}
