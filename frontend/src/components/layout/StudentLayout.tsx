import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { ChatbotWidget } from '@/features/chatbot/components/ChatbotWidget'
import { STUDENT_NAV } from '@/lib/constants'

interface StudentLayoutProps {
  /** Cho phép truyền nội dung trực tiếp (dùng cho trang chủ sinh viên). */
  children?: React.ReactNode
}

/** Bố cục khu vực sinh viên: header xanh, footer và trợ lý ảo. */
export function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header nav={STUDENT_NAV} />
      <main id="noi-dung-chinh" className="flex-1">
        {children ?? <Outlet />}
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  )
}
