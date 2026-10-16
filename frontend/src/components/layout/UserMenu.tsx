import { Bell, LogOut, ShieldCheck, UserCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

function initials(hoTen: string): string {
  const parts = hoTen.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface UserMenuProps {
  onDark?: boolean
}

/** Menu tài khoản trên header: thông tin cá nhân, lối vào khu quản trị và đăng xuất. */
export function UserMenu({ onDark = false }: UserMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <Button asChild size="sm" className="gap-1.5">
        <Link to="/dang-nhap">Đăng nhập</Link>
      </Button>
    )
  }

  async function handleLogout() {
    await logout()
    toast.success('Đã đăng xuất khỏi hệ thống.')
    navigate('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-2 pl-1.5', onDark && 'text-white hover:bg-white/15 hover:text-white')}
        >
          <Avatar className="size-7">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.hoTen} />}
            <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
              {initials(user.hoTen)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">
            {user.hoTen}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-bold">{user.hoTen}</p>
          <p className="text-xs text-muted-foreground">{user.maSo}</p>
          <p className="mt-0.5 text-xs font-medium text-primary">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === 'SINH_VIEN' ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/ho-so-ca-nhan">
                <UserCircle className="size-4" />
                Hồ sơ cá nhân
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/thong-bao">
                <Bell className="size-4" />
                Thông báo
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/quan-ly">
              <ShieldCheck className="size-4" />
              Khu vực quản trị
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void handleLogout()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
