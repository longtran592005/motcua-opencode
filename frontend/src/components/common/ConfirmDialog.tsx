import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tieuDe: string
  moTa?: string
  nhanXacNhan?: string
  nhanHuy?: string
  /** 'destructive' cho hành động nguy hiểm (từ chối, thu hồi, rút đơn). */
  bienThe?: 'default' | 'destructive'
  dangXuLy?: boolean
  onXacNhan: () => void
  children?: ReactNode
}

/** Hộp thoại xác nhận cho các hành động quan trọng hoặc không thể hoàn tác. */
export function ConfirmDialog({
  open,
  onOpenChange,
  tieuDe,
  moTa,
  nhanXacNhan = 'Xác nhận',
  nhanHuy = 'Huỷ',
  bienThe = 'default',
  dangXuLy,
  onXacNhan,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tieuDe}</DialogTitle>
          {moTa && <DialogDescription>{moTa}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dangXuLy}>
            {nhanHuy}
          </Button>
          <Button
            variant={bienThe === 'destructive' ? 'destructive' : 'default'}
            onClick={onXacNhan}
            disabled={dangXuLy}
          >
            {dangXuLy ? 'Đang xử lý…' : nhanXacNhan}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
