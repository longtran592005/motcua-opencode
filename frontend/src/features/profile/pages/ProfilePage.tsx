import * as React from 'react'
import { Loader2, Save, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { initials } from '@/lib/utils'
import { GENDERS, GENDER_LABELS, ROLE_LABELS, type Gender } from '@/types'

/** Trang hồ sơ cá nhân của sinh viên. */
export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [hoTen, setHoTen] = React.useState(user?.hoTen ?? '')
  const [soDienThoai, setSoDienThoai] = React.useState(user?.soDienThoai ?? '')
  const [ngaySinh, setNgaySinh] = React.useState(user?.ngaySinh ?? '')
  const [gioiTinh, setGioiTinh] = React.useState<Gender | ''>(user?.gioiTinh ?? '')
  const [dangLuu, setDangLuu] = React.useState(false)

  if (!user) return null

  async function luu() {
    setDangLuu(true)
    try {
      await updateProfile({
        hoTen: hoTen.trim(),
        soDienThoai: soDienThoai.trim() || undefined,
        ngaySinh: ngaySinh || undefined,
        gioiTinh: gioiTinh || undefined,
      })
      toast.success('Đã cập nhật hồ sơ cá nhân.')
    } catch (error) {
      toast.error('Không cập nhật được hồ sơ', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDangLuu(false)
    }
  }

  return (
    <div className="container max-w-3xl space-y-6 py-6">
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Hồ sơ cá nhân' }]}
        tieuDe="Hồ sơ cá nhân"
        moTa="Thông tin tài khoản và thông tin học tập của bạn."
      />

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
              {initials(user.hoTen)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-brand-heading">{user.hoTen}</p>
            <p className="text-sm text-muted-foreground">
              {user.maSo} · {ROLE_LABELS[user.role]}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" aria-hidden="true" />
            Thông tin cá nhân
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ho-ten">Họ và tên</Label>
            <Input id="ho-ten" value={hoTen} onChange={(e) => setHoTen(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdt">Số điện thoại</Label>
            <Input
              id="sdt"
              value={soDienThoai}
              onChange={(e) => setSoDienThoai(e.target.value)}
              placeholder="Ví dụ: 0912 345 678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ngay-sinh">Ngày sinh</Label>
            <Input
              id="ngay-sinh"
              type="date"
              value={ngaySinh}
              onChange={(e) => setNgaySinh(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gioi-tinh">Giới tính</Label>
            <Select
              value={gioiTinh || undefined}
              onValueChange={(v) => setGioiTinh(v as Gender)}
            >
              <SelectTrigger id="gioi-tinh">
                <SelectValue placeholder="Chọn giới tính" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin học tập</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ['Mã số sinh viên', user.maSo],
            ['Lớp', user.lopTen ?? '—'],
            ['Khoa', user.donViTen ?? '—'],
            ['Ngành', user.nganhTen ?? '—'],
            ['Khóa học', user.khoaHoc ?? '—'],
          ].map(([nhan, giaTri]) => (
            <div key={nhan}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</p>
              <p className="text-sm font-medium">{giaTri}</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Thông tin học tập do Phòng Đào tạo quản lý. Liên hệ phòng ban nếu cần điều chỉnh.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void luu()} disabled={dangLuu} className="gap-2">
          {dangLuu ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Lưu thay đổi
        </Button>
      </div>
    </div>
  )
}
