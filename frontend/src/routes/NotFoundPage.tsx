import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

/** Trang báo không tìm thấy đường dẫn. */
export function NotFoundPage() {
  const { user } = useAuth()
  const veTrang = user ? (user.role === 'SINH_VIEN' ? '/' : '/quan-ly') : '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
        <FileQuestion className="size-8" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-3xl font-extrabold text-brand-heading">404</p>
        <h1 className="text-lg font-bold">Không tìm thấy trang</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
        </p>
      </div>
      <Button asChild>
        <Link to={veTrang}>Quay lại trang chính</Link>
      </Button>
    </div>
  )
}
