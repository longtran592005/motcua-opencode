import * as React from 'react'
import { KeyRound, Pencil, Plus, Search, Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import {
  useAdminUsers,
  useRemoveUser,
  useResetPassword,
  useSaveUser,
} from '../hooks/useAdmin'
import { useDebounce } from '@/hooks/useDebounce'
import { khoaHooks, phongBanHooks } from '@/hooks/useCatalog'
import { PAGE_SIZE } from '@/lib/constants'
import { ROLE_LABELS, ROLES, type Role, type User, type UserStatus } from '@/types'
import { initials } from '@/lib/utils'

function rong(): User {
  return {
    id: '',
    maSo: '',
    hoTen: '',
    email: '',
    role: 'SINH_VIEN',
    trangThai: 'ACTIVE',
  }
}

/** Trang quản lý người dùng và vai trò (chỉ ADMIN). */
export function UsersPage() {
  const [tuKhoa, setTuKhoa] = React.useState('')
  const [vaiTro, setVaiTro] = React.useState<Role | 'ALL'>('ALL')
  const [trangThai, setTrangThai] = React.useState<UserStatus | 'ALL'>('ALL')
  const [page, setPage] = React.useState(1)
  const tuKhoaTre = useDebounce(tuKhoa, 350)

  const { data, isLoading, isError, refetch } = useAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    tuKhoa: tuKhoaTre || undefined,
    vaiTro,
    trangThai,
  })

  const { data: khoaList } = khoaHooks.useList()
  const { data: phongBanList } = phongBanHooks.useList()
  const donViOptions = React.useMemo(
    () => [
      ...(khoaList ?? []).map((k) => ({ id: k.id, ten: k.ten })),
      ...(phongBanList ?? []).map((p) => ({ id: p.id, ten: p.ten })),
    ],
    [khoaList, phongBanList],
  )

  const saveUser = useSaveUser()
  const removeUser = useRemoveUser()
  const resetPassword = useResetPassword()

  const [moEditor, setMoEditor] = React.useState(false)
  const [draft, setDraft] = React.useState<User>(rong())
  const [xoaId, setXoaId] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPage(1)
  }, [tuKhoaTre, vaiTro, trangThai])

  const columns: Column<User>[] = [
    {
      key: 'nguoiDung',
      header: 'Người dùng',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
            {initials(row.hoTen)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{row.hoTen}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{row.maSo}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      hideOnMobile: true,
      cell: (row) => <span className="text-sm text-muted-foreground">{row.email}</span>,
    },
    {
      key: 'vaiTro',
      header: 'Vai trò',
      cell: (row) => <Badge variant="secondary">{ROLE_LABELS[row.role]}</Badge>,
    },
    {
      key: 'donVi',
      header: 'Đơn vị',
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.donViTen ?? row.chucVu ?? '—'}</span>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái',
      cell: (row) => (
        <Badge
          variant="outline"
          className={
            row.trangThai === 'ACTIVE'
              ? 'border-success/40 bg-success-soft text-success'
              : 'border-destructive/40 bg-destructive-soft text-destructive'
          }
        >
          {row.trangThai === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khoá'}
        </Badge>
      ),
    },
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => resetPassword.mutate(row.id)}
            aria-label={`Đặt lại mật khẩu cho ${row.hoTen}`}
          >
            <KeyRound className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setDraft({ ...row })
              setMoEditor(true)
            }}
            aria-label={`Sửa ${row.hoTen}`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() => setXoaId(row.id)}
            aria-label={`Xoá ${row.hoTen}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  const hopLe = draft.maSo.trim() !== '' && draft.hoTen.trim() !== '' && draft.email.trim() !== ''

  function luu() {
    const donVi = donViOptions.find((d) => d.id === draft.donViId)
    const payload: User = {
      ...draft,
      maSo: draft.maSo.trim(),
      hoTen: draft.hoTen.trim(),
      email: draft.email.trim(),
      donViTen: donVi?.ten ?? draft.donViTen,
    }
    saveUser.mutate({ id: draft.id || undefined, input: payload }, { onSuccess: () => setMoEditor(false) })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Người dùng & phân quyền"
        moTa="Quản lý tài khoản cán bộ, giảng viên và sinh viên cùng vai trò tương ứng."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setDraft(rong())
              setMoEditor(true)
            }}
          >
            <Plus className="size-4" />
            Thêm người dùng
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
              placeholder="Tìm theo họ tên, mã số, email…"
              aria-label="Tìm người dùng"
              className="pl-8"
            />
          </div>
          <Select value={vaiTro} onValueChange={(v) => setVaiTro(v as Role | 'ALL')}>
            <SelectTrigger aria-label="Lọc theo vai trò">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả vai trò</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={trangThai} onValueChange={(v) => setTrangThai(v as UserStatus | 'ALL')}>
            <SelectTrigger aria-label="Lọc theo trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
              <SelectItem value="LOCKED">Đã khoá</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong="Chưa có người dùng nào"
        moTaRong="Không có người dùng nào khớp bộ lọc hiện tại."
        phanTrang={
          data
            ? {
                page: data.page,
                totalPages: data.totalPages,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <Dialog open={moEditor} onOpenChange={setMoEditor}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-primary" aria-hidden="true" />
              {draft.id ? 'Sửa người dùng' : 'Thêm người dùng'}
            </DialogTitle>
            <DialogDescription>
              Vai trò quyết định phạm vi hồ sơ và các menu người dùng được phép truy cập.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="u-ma">
                Mã số <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-ma"
                value={draft.maSo}
                onChange={(e) => setDraft({ ...draft, maSo: e.target.value })}
                placeholder="20211234 hoặc cv001"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-ten">
                Họ và tên <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-ten"
                value={draft.hoTen}
                onChange={(e) => setDraft({ ...draft, hoTen: e.target.value })}
                placeholder="Nguyễn Văn An"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="u-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="an.nv@tbu.edu.vn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-sdt">Số điện thoại</Label>
              <Input
                id="u-sdt"
                value={draft.soDienThoai ?? ''}
                onChange={(e) => setDraft({ ...draft, soDienThoai: e.target.value })}
                placeholder="0912 345 678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-vai-tro">Vai trò</Label>
              <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as Role })}>
                <SelectTrigger id="u-vai-tro">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-chuc-vu">Chức vụ</Label>
              <Input
                id="u-chuc-vu"
                value={draft.chucVu ?? ''}
                onChange={(e) => setDraft({ ...draft, chucVu: e.target.value })}
                placeholder="Cố vấn học tập / Trưởng khoa…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u-don-vi">Đơn vị (khoa / phòng)</Label>
              <Select
                value={draft.donViId || undefined}
                onValueChange={(v) => {
                  const donVi = donViOptions.find((d) => d.id === v)
                  setDraft({ ...draft, donViId: v, donViTen: donVi?.ten })
                }}
              >
                <SelectTrigger id="u-don-vi">
                  <SelectValue placeholder="Chọn đơn vị" />
                </SelectTrigger>
                <SelectContent>
                  {donViOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.ten}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.role === 'SINH_VIEN' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="u-lop">Lớp</Label>
                  <Input
                    id="u-lop"
                    value={draft.lopTen ?? ''}
                    onChange={(e) => setDraft({ ...draft, lopTen: e.target.value })}
                    placeholder="K19-CNTT1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="u-nganh">Ngành</Label>
                  <Input
                    id="u-nganh"
                    value={draft.nganhTen ?? ''}
                    onChange={(e) => setDraft({ ...draft, nganhTen: e.target.value })}
                    placeholder="Công nghệ thông tin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="u-khoa-hoc">Khoá học</Label>
                  <Input
                    id="u-khoa-hoc"
                    value={draft.khoaHoc ?? ''}
                    onChange={(e) => setDraft({ ...draft, khoaHoc: e.target.value })}
                    placeholder="K19 (2021 - 2025)"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="u-trang-thai" className="cursor-pointer">
                  Cho phép đăng nhập
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tài khoản bị khoá sẽ không thể truy cập hệ thống.
                </p>
              </div>
              <Switch
                id="u-trang-thai"
                checked={draft.trangThai === 'ACTIVE'}
                onCheckedChange={(v) => setDraft({ ...draft, trangThai: v ? 'ACTIVE' : 'LOCKED' })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoEditor(false)}>
              Huỷ
            </Button>
            <Button onClick={luu} disabled={!hopLe || saveUser.isPending}>
              {draft.id ? 'Lưu thay đổi' : 'Thêm người dùng'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaId !== null}
        onOpenChange={(open) => !open && setXoaId(null)}
        tieuDe="Xoá người dùng"
        moTa="Tài khoản sẽ bị xoá khỏi hệ thống. Hồ sơ và văn bản do người này xử lý vẫn được giữ nguyên."
        nhanXacNhan="Xoá người dùng"
        bienThe="destructive"
        dangXuLy={removeUser.isPending}
        onXacNhan={() => {
          if (!xoaId) return
          removeUser.mutate(xoaId, { onSuccess: () => setXoaId(null) })
        }}
      />
    </div>
  )
}
