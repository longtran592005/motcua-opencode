import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** Màu nút theo nền đang đứng. */
  onDark?: boolean
  className?: string
}

/** Nút chuyển đổi chế độ sáng / tối. */
export function ThemeToggle({ onDark = false, className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
          className={cn(onDark && 'text-white hover:bg-white/15 hover:text-white', className)}
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</TooltipContent>
    </Tooltip>
  )
}
