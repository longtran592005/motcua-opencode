import { ChevronLeft, LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { navIcon } from './navIcons'
import { Logo } from './Logo'
import { useAuth } from '@/hooks/useAuth'
import type { NavItem } from '@/lib/constants'
import { ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

interface SidebarProps {
  nav: NavItem[]
  collapsed: boolean
  onToggleCollapse: () => void
  /** Số hồ sơ đang chờ duyệt, hiển thị dạng badge. */
  pendingCount?: number
  onNavigate?: () => void
}

/** Menu dọc của khu vực quản trị, hỗ trợ thu gọn trên màn hình lớn. */
export function Sidebar({
  nav,
  collapsed,
  onToggleCollapse,
  pendingCount = 0,
  onNavigate,
}: SidebarProps) {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-full flex-col bg-brand-heading text-white/80">
      <div className={cn('flex h-16 items-center border-b border-white/10 px-3', collapsed && 'justify-center px-2')}>
        <Logo to="/quan-ly" onDark compact={collapsed} />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Điều hướng quản trị">
        {nav.map((item) => {
          const Icon = navIcon(item.icon)
          const exact = item.to === '/quan-ly'
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={exact}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badgeKey === 'choDuyet' && pendingCount > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
              {collapsed && item.badgeKey === 'choDuyet' && pendingCount > 0 && (
                <span
                  className="absolute right-1 top-1 size-2 rounded-full bg-primary"
                  aria-label={`${pendingCount} hồ sơ chờ duyệt`}
                />
              )}
            </NavLink>
          )

          if (!collapsed) return link
          return (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <span className="relative block">{link}</span>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-3">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{user.hoTen}</p>
                <p className="truncate text-xs text-white/60">{ROLE_LABELS[user.role]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                className="text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Đăng xuất"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void logout()}
              className="mx-auto flex text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Đăng xuất"
            >
              <LogOut className="size-4" />
            </Button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden items-center justify-center gap-2 border-t border-white/10 py-2 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:flex"
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
      >
        <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
        {!collapsed && 'Thu gọn'}
      </button>
    </div>
  )
}
