import * as React from 'react'
import { FilePlus2, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUpload } from '@/components/common/FileUpload'
import { ApplicationDataView } from './ApplicationDataView'
import type { Attachment, ApplicationDetail } from '@/types'

interface SupplementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: ApplicationDetail
  dangGui?: boolean
  onSubmit: (input: { tepDinhKem: Attachment[]; ghiChu: string }) => void
}

/** Hộp thoại bổ sung hồ sơ theo yêu cầu của cán bộ xử lý. */
export function SupplementDialog({
  open,
  onOpenChange,
  application,
  dangGui,
  onSubmit,
}: SupplementDialogProps) {
  const [tepMoi, setTepMoi] = React.useState<Attachment[]>([])
  const [ghiChu, setGhiChu] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setTepMoi([])
      setGhiChu('')
    }
  }, [open])

  const yeuCau = application.yeuCauBoSung

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bổ sung hồ sơ {application.maHoSo}</DialogTitle>
          <DialogDescription>
            Bổ sung thông tin, giấy tờ theo yêu cầu của cán bộ xử lý. Sau khi gửi, hồ sơ sẽ quay lại
            đúng cấp đã yêu cầu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {yeuCau && (
            <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-warning">
                <Info className="size-4" aria-hidden="true" />
                Yêu cầu từ {yeuCau.boiAiTen}
              </p>
              <p className="mt-1 text-foreground/85">{yeuCau.noiDung}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-heading">Nội dung hồ sơ hiện tại</p>
            <div className="rounded-lg border bg-muted/40 p-3">
              <ApplicationDataView
                fields={application.requestTypeFull.formFields}
                duLieu={application.duLieu}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tep-bo-sung" className="flex items-center gap-1.5">
              <FilePlus2 className="size-4 text-primary" aria-hidden="true" />
              Tệp, giấy tờ bổ sung
            </Label>
            <FileUpload value={tepMoi} onChange={setTepMoi} requirementKey="bo_sung" />
            <p className="text-xs text-muted-foreground">
              Các tệp bổ sung sẽ được gắn vào hồ sơ cùng với giấy tờ đã nộp trước đó.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ghi-chu-bo-sung">Ghi chú phản hồi</Label>
            <Textarea
              id="ghi-chu-bo-sung"
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              rows={3}
              placeholder="Trình bày ngắn gọn nội dung đã bổ sung…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dangGui}>
            Huỷ
          </Button>
          <Button
            className="gap-2"
            disabled={dangGui || (tepMoi.length === 0 && ghiChu.trim() === '')}
            onClick={() =>
              onSubmit({
                tepDinhKem: [...application.tepDinhKem, ...tepMoi],
                ghiChu: ghiChu.trim(),
              })
            }
          >
            {dangGui && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Gửi bổ sung
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
