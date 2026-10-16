import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'
import { ChatbotWidget } from '@/features/chatbot/components/ChatbotWidget'
import { useAuth } from '@/hooks/useAuth'
import { services } from '@/services'
import { ADMIN_NAV, SCHOOL } from '@/lib/constants'
import { visibleNavItems } from '@/lib/nav'
import { cn } from '@/lib/utils'

const COLLAPSE_KEY = 'motcua.sidebar.collapsed'

/** Bố cục khu vực quản trị với menu dọc có thể thu gọn. */
export function AdminLayout() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* bỏ qua */
    }
  }, [collapsed])

  const { data: pending = 0 } = useQuery({
    queryKey: ['pending-count'],
    queryFn: () => services.approvals.pendingCount(),
  })

  const nav = visibleNavItems(ADMIN_NAV, user?.role)

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Menu cố định trên màn hình lớn */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden transition-all duration-200 lg:block',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <Sidebar
          nav={nav}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          pendingCount={pending}
        />
      </aside>

      <div className={cn('flex min-w-0 flex-1 flex-col transition-all duration-200', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menu quản trị</SheetTitle>
              <Sidebar
                nav={nav}
                collapsed={false}
                onToggleCollapse={() => setMobileOpen(false)}
                pendingCount={pending}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-brand-heading">Khu vực quản trị</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {SCHOOL.ten} · Cổng {SCHOOL.portal}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" asChild>
              <Link to="/">Về trang chủ</Link>
            </Button>
            <NotificationBell />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="noi-dung-chinh" className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <ChatbotWidget />
    </div>
  )
}
