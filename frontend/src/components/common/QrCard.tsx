import { Download } from 'lucide-react'
import * as React from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QrCardProps {
  /** Nội dung mã hoá (thường là URL xác thực). */
  value: string
  kichThuoc?: number
  chuThich?: string
  tenTepTai?: string
  className?: string
}

/** Thẻ hiển thị mã QR xác thực văn bản, có thể tải về dạng ảnh PNG. */
export function QrCard({
  value,
  kichThuoc = 132,
  chuThich,
  tenTepTai = 'ma-qr-xac-thuc',
  className,
}: QrCardProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const taiVe = () => {
    const canvas = wrapperRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${tenTepTai}.png`
    a.click()
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        ref={wrapperRef}
        className="rounded-lg border-2 border-primary/30 bg-white p-2.5"
        aria-label="Mã QR xác thực văn bản"
      >
        <QRCodeCanvas
          value={value}
          size={kichThuoc}
          level="M"
          marginSize={1}
          bgColor="#FFFFFF"
          fgColor="#0B3C6F"
        />
      </div>
      {chuThich && (
        <p className="max-w-[200px] text-center text-[11px] leading-snug text-muted-foreground">
          {chuThich}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="no-print"
        onClick={taiVe}
      >
        <Download className="size-3.5" />
        Tải mã QR
      </Button>
    </div>
  )
}
