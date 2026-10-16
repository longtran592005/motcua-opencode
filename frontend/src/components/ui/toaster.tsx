import { Toaster as SonnerToaster, toast } from 'sonner'
import { useTheme } from '@/hooks/useTheme'

/** Thông báo dùng chung — gọi `toast.success(...)`, `toast.error(...)`. */
export function Toaster() {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm',
        },
      }}
    />
  )
}

export { toast }
