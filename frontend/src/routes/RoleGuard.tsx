import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'
import { Link } from 'react-router-dom'

interface RoleGuardProps {
  /** Các vai trò được phép truy cập. Bỏ trống nghĩa là chỉ cần đăng nhập. */
  allow?: Role[]
}

/** Chặn truy cập theo vai trò: chuyển tới trang đăng nhập hoặc báo không có quyền. */
export function RoleGuard({ allow }: RoleGuardProps) {
  const { user, dangTai } = useAuth()
  const location = useLocation()

  if (dangTai) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <p className="text-sm">Đang kiểm tra quyền truy cập…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />
  }

  if (allow && !allow.includes(user.role)) {
    const veTrang = user.role === 'SINH_VIEN' ? '/' : '/quan-ly'
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <ShieldX className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-bold">Không có quyền truy cập</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tài khoản của bạn không được phép mở trang này.
          </p>
        </div>
        <Button asChild>
          <Link to={veTrang}>Quay lại trang chính</Link>
        </Button>
      </div>
    )
  }

  return <Outlet />
}
