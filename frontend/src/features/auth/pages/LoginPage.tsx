import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Loader2,
  Lock,
  ShieldCheck,
  UserRound,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { QUICK_LOGIN_ACCOUNTS, SCHOOL } from '@/lib/constants'
import { ROLE_LABELS, type Role } from '@/types'

const loginSchema = z.object({
  dinhDanh: z.string().min(1, 'Vui lòng nhập mã số sinh viên/cán bộ hoặc email.'),
  matKhau: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
})

type LoginValues = z.infer<typeof loginSchema>

function homeForRole(role: Role): string {
  return role === 'SINH_VIEN' ? '/' : '/quan-ly'
}

/** Trang đăng nhập: mã số/email + mật khẩu, kèm nút đăng nhập nhanh theo vai trò. */
export function LoginPage() {
  const { login, quickLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const [hienMatKhau, setHienMatKhau] = React.useState(false)
  const [dangGui, setDangGui] = React.useState(false)
  const [dangNhanh, setDangNhanh] = React.useState<Role | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { dinhDanh: '', matKhau: '' },
  })

  async function onSubmit(values: LoginValues) {
    setDangGui(true)
    try {
      const user = await login(values)
      toast.success(`Xin chào ${user.hoTen}!`)
      navigate(from ?? homeForRole(user.role), { replace: true })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Đăng nhập không thành công. Vui lòng thử lại.'
      form.setError('matKhau', { message })
      toast.error('Đăng nhập thất bại', { description: message })
    } finally {
      setDangGui(false)
    }
  }

  async function handleQuickLogin(role: Role) {
    setDangNhanh(role)
    try {
      const user = await quickLogin(role)
      toast.success(`Đăng nhập nhanh với vai trò ${ROLE_LABELS[role]}`, {
        description: user.hoTen,
      })
      navigate(from ?? homeForRole(user.role), { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đăng nhập nhanh.'
      toast.error('Đăng nhập nhanh thất bại', { description: message })
    } finally {
      setDangNhanh(null)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Khối giới thiệu thương hiệu */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-heading p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
              <GraduationCap className="size-6" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold uppercase tracking-wide text-white/70">
                {SCHOOL.tenVietTat}
              </span>
              <span className="block text-lg font-extrabold">Cổng {SCHOOL.portal}</span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-3xl font-extrabold leading-snug">
            Nộp hồ sơ và theo dõi tiến độ xử lý trực tuyến
          </h1>
          <p className="text-white/75">
            Hệ thống một cửa điện tử của {SCHOOL.ten} giúp sinh viên gửi yêu cầu, theo dõi phê
            duyệt nhiều cấp và nhận văn bản có mã xác thực.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              'Nộp hồ sơ mọi lúc, mọi nơi',
              'Theo dõi tiến trình duyệt theo từng cấp',
              'Nhận văn bản điện tử có mã QR xác thực',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 shrink-0 text-white/70" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Hotline {SCHOOL.hotline} · {SCHOOL.email}
        </p>
      </div>

      {/* Khối đăng nhập */}
      <div className="flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1 text-center lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold text-brand-heading">Cổng {SCHOOL.portal}</span>
            </Link>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-brand-heading">Đăng nhập hệ thống</h2>
            <p className="text-sm text-muted-foreground">
              Dùng mã số sinh viên/cán bộ hoặc email nội bộ để đăng nhập.
            </p>
          </div>

          <Card>
            <CardContent className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <FormField
                    control={form.control}
                    name="dinhDanh"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mã số sinh viên / cán bộ hoặc email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IdCard
                              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <Input
                              {...field}
                              autoComplete="username"
                              placeholder="Ví dụ: 20211234 hoặc email@tbu.edu.vn"
                              className="pl-8"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="matKhau"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mật khẩu</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock
                              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <Input
                              {...field}
                              type={hienMatKhau ? 'text' : 'password'}
                              autoComplete="current-password"
                              placeholder="Nhập mật khẩu"
                              className="px-8"
                            />
                            <button
                              type="button"
                              onClick={() => setHienMatKhau((v) => !v)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                              aria-label={hienMatKhau ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                              {hienMatKhau ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full gap-2" disabled={dangGui}>
                    {dangGui ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="size-4" aria-hidden="true" />
                    )}
                    Đăng nhập
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Đăng nhập nhanh theo vai trò
              </span>
              <Separator className="flex-1" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_LOGIN_ACCOUNTS.map((account) => (
                <Button
                  key={account.role}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-2 py-2 text-left"
                  onClick={() => void handleQuickLogin(account.role)}
                  disabled={dangNhanh !== null}
                >
                  {dangNhanh === account.role ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : account.role === 'SINH_VIEN' ? (
                    <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Zap className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{account.nhan}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {account.moTa}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Tài khoản demo dùng mật khẩu chung <span className="font-semibold">demo1234</span>.
            </p>
          </div>

          <p className="text-center text-sm">
            <Link to="/" className="font-semibold text-primary hover:underline">
              ← Về trang chủ cổng thông tin
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
