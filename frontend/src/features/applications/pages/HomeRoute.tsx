import { Loader2 } from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { useAuth } from '@/hooks/useAuth'
import { StudentHomePage } from './StudentHomePage'
import { PublicHomePage } from './PublicHomePage'

/** Trang chủ hiển thị theo vai trò: sinh viên thấy bảng điều khiển, khách thấy giới thiệu cổng. */
export function HomeRoute() {
  const { user, dangTai } = useAuth()

  if (dangTai) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (user?.role === 'SINH_VIEN') {
    return (
      <StudentLayout>
        <StudentHomePage />
      </StudentLayout>
    )
  }

  return (
    <PublicLayout>
      <PublicHomePage />
    </PublicLayout>
  )
}
