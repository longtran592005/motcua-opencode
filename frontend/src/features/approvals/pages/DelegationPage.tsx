import * as React from 'react'
import { CalendarClock, Loader2, Trash2, UserCog, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  useCancelDelegation,
  useCreateDelegation,
  useDelegations,
  useEligibleUsers,
} from '../hooks/useApprovals'
import { useAuth } from '@/hooks/useAuth'
import { APPROVAL_ROLES, ROLE_LABELS, type Role } from '@/types'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/** Trang ủy quyền duyệt tạm thời cho người khác. */
export function DelegationPage() {
  const { user } = useAuth()
  const vaiTroMacDinh: Role =
    user && (APPROVAL_ROLES.includes(user.role) || user.role === 'ADMIN')
      ? user.role
      : 'PHONG_DAO_TAO'

  const [vaiTro, setVaiTro] = React.useState<Role>(vaiTroMacDinh)
  const [nguoiNhanId, setNguoiNhanId] = React.useState('')
  const [tuNgay, setTuNgay] = React.useState('')
  const [denNgay, setDenNgay] = React.useState('')
  const [lyDo, setLyDo] = React.useState('')
  const [moHuy, setMoHuy] = React.useState<string | null>(null)

  const { data: eligible, isLoading: dangTaiNguoiNhan } = useEligibleUsers(vaiTro)
  const { data: delegations, isLoading, isError, refetch } = useDelegations()
  const createDelegation = useCreateDelegation()
  const cancelDelegation = useCancelDelegation()

  const hopLe =
    nguoiNhanId !== '' && tuNgay !== '' && denNgay !== '' && tuNgay <= denNgay && lyDo.trim() !== ''

  function gui() {
    if (!hopLe) return
    createDelegation.mutate(
      { nguoiNhanId, vaiTro, tuNgay, denNgay, lyDo: lyDo.trim() },
      {
        onSuccess: () => {
          setNguoiNhanId('')
          setTuNgay('')
          setDenNgay('')
          setLyDo('')
        },
      },
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Ủy quyền duyệt"
        moTa="Tạm thời chuyển quyền phê duyệt hồ sơ cho cán bộ khác trong khoảng thời gian xác định."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
              Tạo ủy quyền mới
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="uy-vai-tro">Vai trò ủy quyền</Label>
              <Select value={vaiTro} onValueChange={(v) => { setVaiTro(v as Role); setNguoiNhanId('') }}>
                <SelectTrigger id="uy-vai-tro">
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
              <Label htmlFor="nguoi-nhan">Người nhận ủy quyền</Label>
              <Select value={nguoiNhanId} onValueChange={setNguoiNhanId} disabled={dangTaiNguoiNhan}>
                <SelectTrigger id="nguoi-nhan">
                  <SelectValue placeholder="Chọn cán bộ nhận ủy quyền" />
                </SelectTrigger>
                <SelectContent>
                  {(eligible ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.hoTen} · {u.donViTen ?? u.maSo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(eligible ?? []).length === 0 && !dangTaiNguoiNhan && (
                <p className="text-xs text-muted-foreground">
                  Không có cán bộ nào phù hợp để nhận ủy quyền.
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tu-ngay">Từ ngày</Label>
                <Input
                  id="tu-ngay"
                  type="date"
                  value={tuNgay}
                  onChange={(e) => setTuNgay(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="den-ngay">Đến ngày</Label>
                <Input
                  id="den-ngay"
                  type="date"
                  value={denNgay}
                  onChange={(e) => setDenNgay(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ly-do-uy-quyen">
                Lý do ủy quyền <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ly-do-uy-quyen"
                value={lyDo}
                onChange={(e) => setLyDo(e.target.value)}
                rows={3}
                placeholder="Ví dụ: đi công tác từ ngày…"
              />
            </div>

            <Button className="w-full gap-2" onClick={gui} disabled={!hopLe || createDelegation.isPending}>
              {createDelegation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserCog className="size-4" />
              )}
              Tạo ủy quyền
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
              Danh sách ủy quyền
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isError ? (
              <ErrorState onThuLai={() => void refetch()} />
            ) : !delegations || delegations.length === 0 ? (
              <EmptyState
                icon={UserCog}
                tieuDe="Chưa có ủy quyền nào"
                moTa="Các ủy quyền đã tạo sẽ hiển thị tại đây."
              />
            ) : (
              <ul className="divide-y">
                {delegations.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {d.nguoiUyQuyenTen} → {d.nguoiNhanTen}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[d.vaiTro]} · {formatDate(d.tuNgay)} – {formatDate(d.denNgay)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{d.lyDo}</p>
                    </div>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-semibold',
                        d.hieuLuc ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {d.hieuLuc ? 'Đang hiệu lực' : 'Hết hiệu lực'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive-soft"
                      onClick={() => setMoHuy(d.id)}
                      aria-label={`Huỷ ủy quyền cho ${d.nguoiNhanTen}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={moHuy !== null}
        onOpenChange={(open) => !open && setMoHuy(null)}
        tieuDe="Huỷ ủy quyền"
        moTa="Cán bộ được ủy quyền sẽ không còn quyền duyệt hồ sơ thay bạn."
        nhanXacNhan="Huỷ ủy quyền"
        bienThe="destructive"
        dangXuLy={cancelDelegation.isPending}
        onXacNhan={() => {
          if (!moHuy) return
          cancelDelegation.mutate(moHuy, { onSuccess: () => setMoHuy(null) })
        }}
      />
    </div>
  )
}
