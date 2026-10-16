import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { PUBLIC_NAV } from '@/lib/constants'

interface PublicLayoutProps {
  /** Cho phép truyền nội dung trực tiếp (dùng cho trang chủ hiển thị theo vai trò). */
  children?: React.ReactNode
}

/** Bố cục cho các trang công khai (chưa đăng nhập) và tra cứu văn bản. */
export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header nav={PUBLIC_NAV} />
      <main id="noi-dung-chinh" className="flex-1">
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  )
}
