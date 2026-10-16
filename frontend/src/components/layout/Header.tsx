import * as React from 'react'
import { Globe, Mail, MapPin, Menu, Phone, Search } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'
import { navIcon } from './navIcons'
import { useAuth } from '@/hooks/useAuth'
import { SCHOOL } from '@/lib/constants'
import { visibleNavItems } from '@/lib/nav'
import type { NavItem } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface HeaderProps {
  nav: NavItem[]
  /** Trang chủ đích khi bấm logo. */
  homeTo?: string
}

/**
 * Header dùng chung cho trang công khai và trang sinh viên.
 * Gồm thanh tiện ích (hotline, email, chọn ngôn ngữ) và thanh điều hướng chính.
 */
export function Header({ nav, homeTo = '/' }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [keyword, setKeyword] = React.useState('')
  const items = visibleNavItems(nav, user?.role)

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const q = keyword.trim()
    navigate(q ? `/thu-vien-bieu-mau?q=${encodeURIComponent(q)}` : '/thu-vien-bieu-mau')
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40">
      {/* Thanh tiện ích */}
      <div className="hidden bg-brand-heading text-white lg:block">
        <div className="container flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" aria-hidden="true" />
              Hotline: {SCHOOL.hotline}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {SCHOOL.email}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden="true" />
              {SCHOOL.diaChi}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={SCHOOL.website}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Cổng thông tin {SCHOOL.websiteLabel}
            </a>
            <span className="flex items-center gap-1.5">
              <Globe className="size-3.5" aria-hidden="true" />
              <Select defaultValue="vi">
                <SelectTrigger
                  className="h-6 w-24 border-white/30 bg-transparent text-xs text-white"
                  aria-label="Chọn ngôn ngữ"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vi">Tiếng Việt</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </span>
            <ThemeToggle onDark />
          </div>
        </div>
      </div>

      {/* Thanh điều hướng chính */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center gap-4">
          <Logo to={homeTo} />

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-secondary text-primary'
                      : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={submitSearch} className="ml-auto hidden w-56 xl:block">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm biểu mẫu, thủ tục…"
                aria-label="Tìm kiếm biểu mẫu, thủ tục"
                className="h-9 pl-8"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 xl:ml-0">
            {user && <NotificationBell />}
            <UserMenu />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-4">
                <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                <Logo to={homeTo} className="mb-4" />
                <form onSubmit={submitSearch} className="mb-3">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="Tìm biểu mẫu, thủ tục…"
                      aria-label="Tìm kiếm"
                      className="pl-8"
                    />
                  </div>
                </form>
                <nav className="flex flex-col gap-1" aria-label="Điều hướng di động">
                  {items.map((item) => {
                    const Icon = navIcon(item.icon)
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold',
                            isActive
                              ? 'bg-secondary text-primary'
                              : 'hover:bg-accent hover:text-foreground',
                          )
                        }
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    )
                  })}
                </nav>
                <div className="mt-4 space-y-2 border-t pt-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Phone className="size-4" aria-hidden="true" /> {SCHOOL.hotline}
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-4" aria-hidden="true" /> {SCHOOL.email}
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
