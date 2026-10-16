import * as React from 'react'
import { Eye, FileSignature, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { TemplatePreview } from '../components/TemplatePreview'
import {
  useAdminTemplates,
  useRemoveTemplate,
  useSaveTemplate,
} from '../hooks/useAdmin'
import { TEMPLATE_VARIABLES } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { extractVariables } from '@/lib/template'
import type { DocumentTemplate } from '@/types'

function rong(): DocumentTemplate {
  return {
    id: '',
    ma: '',
    ten: '',
    loaiVanBan: 'Giấy xác nhận',
    noiDung: 'Căn cứ hồ sơ đề nghị của sinh viên {{ho_ten}} (MSSV {{mssv}}), lớp {{lop}}.\n\nTrường Đại học Thái Bình xác nhận:\n\n…',
    hoatDong: true,
    capNhatLuc: new Date().toISOString(),
  }
}

/** Trang quản lý mẫu văn bản kèm xem trước A4 (chỉ ADMIN). */
export function TemplateAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminTemplates()
  const saveTemplate = useSaveTemplate()
  const removeTemplate = useRemoveTemplate()

  const [moEditor, setMoEditor] = React.useState(false)
  const [moXemTruoc, setMoXemTruoc] = React.useState(false)
  const [draft, setDraft] = React.useState<DocumentTemplate>(rong())
  const [xoaId, setXoaId] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const bienSuDung = extractVariables(draft.noiDung)

  function chenBien(bien: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      setDraft({ ...draft, noiDung: `${draft.noiDung}${bien}` })
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${draft.noiDung.slice(0, start)}${bien}${draft.noiDung.slice(end)}`
    setDraft({ ...draft, noiDung: next })
    requestAnimationFrame(() => {
      textarea.focus()
      const pos = start + bien.length
      textarea.setSelectionRange(pos, pos)
    })
  }

  function luu() {
    saveTemplate.mutate(
      {
        id: draft.id || undefined,
        input: { ...draft, ma: draft.ma.trim().toUpperCase(), ten: draft.ten.trim() },
      },
      { onSuccess: () => setMoEditor(false) },
    )
  }

  const hopLe = draft.ma.trim() !== '' && draft.ten.trim() !== '' && draft.noiDung.trim() !== ''

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Mẫu văn bản"
        moTa="Quản lý mẫu văn bản hành chính với các biến động và xem trước khổ A4."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setDraft(rong())
              setMoEditor(true)
            }}
          >
            <Plus className="size-4" />
            Thêm mẫu văn bản
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onThuLai={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          tieuDe="Chưa có mẫu văn bản nào"
          moTa="Bấm “Thêm mẫu văn bản” để tạo mẫu đầu tiên."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((tpl) => (
            <Card key={tpl.id} className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-brand-heading">
                      {tpl.ten}
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {tpl.ma}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tpl.loaiVanBan} · cập nhật {formatDate(tpl.capNhatLuc)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      tpl.hoatDong
                        ? 'border-success/40 bg-success-soft text-success'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {tpl.hoatDong ? 'Đang dùng' : 'Tạm dừng'}
                  </Badge>
                </div>
                <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                  {tpl.noiDung}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {extractVariables(tpl.noiDung).length} biến động
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDraft(tpl)
                      setMoXemTruoc(true)
                    }}
                  >
                    <Eye className="size-4" />
                    Xem trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDraft({ ...tpl })
                      setMoEditor(true)
                    }}
                  >
                    <Pencil className="size-4" />
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setXoaId(tpl.id)}
                  >
                    <Trash2 className="size-4" />
                    Xoá
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trình soạn mẫu văn bản */}
      <Dialog open={moEditor} onOpenChange={setMoEditor}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Sửa mẫu văn bản' : 'Thêm mẫu văn bản'}</DialogTitle>
            <DialogDescription>
              Dùng các biến dạng {'{{ten_bien}}'} để hệ thống tự điền khi cấp văn bản.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-ma">
                    Mã mẫu <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tpl-ma"
                    value={draft.ma}
                    onChange={(e) => setDraft({ ...draft, ma: e.target.value })}
                    placeholder="GXN_SV"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tpl-loai">Loại văn bản</Label>
                  <Input
                    id="tpl-loai"
                    value={draft.loaiVanBan}
                    onChange={(e) => setDraft({ ...draft, loaiVanBan: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-ten">
                  Tên mẫu <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tpl-ten"
                  value={draft.ten}
                  onChange={(e) => setDraft({ ...draft, ten: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-noi-dung">
                  Nội dung <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="tpl-noi-dung"
                  ref={textareaRef}
                  value={draft.noiDung}
                  onChange={(e) => setDraft({ ...draft, noiDung: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Chèn biến động
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => chenBien(v.key)}
                      className="rounded-md border bg-background px-2 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Đang dùng: {bienSuDung.length > 0 ? bienSuDung.join(', ') : 'chưa có biến nào'}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="tpl-hoat-dong" className="cursor-pointer">
                    Kích hoạt mẫu
                  </Label>
                  <p className="text-xs text-muted-foreground">Mẫu tạm dừng không dùng để cấp văn bản.</p>
                </div>
                <Switch
                  id="tpl-hoat-dong"
                  checked={draft.hoatDong}
                  onCheckedChange={(v) => setDraft({ ...draft, hoatDong: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-brand-heading">Xem trước A4</p>
              <div className="overflow-x-auto rounded-lg bg-muted/60 p-3">
                <TemplatePreview trichYeu={draft.ten} noiDung={draft.noiDung} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoEditor(false)}>
              Huỷ
            </Button>
            <Button onClick={luu} disabled={!hopLe || saveTemplate.isPending}>
              {draft.id ? 'Lưu thay đổi' : 'Tạo mẫu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hộp thoại xem trước riêng */}
      <Dialog open={moXemTruoc} onOpenChange={setMoXemTruoc}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước: {draft.ten}</DialogTitle>
            <DialogDescription>Dữ liệu biến được điền bằng giá trị mẫu.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg bg-muted/60 p-3">
            <TemplatePreview trichYeu={draft.ten} noiDung={draft.noiDung} />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaId !== null}
        onOpenChange={(open) => !open && setXoaId(null)}
        tieuDe="Xoá mẫu văn bản"
        moTa="Các loại đơn đang dùng mẫu này cần được gán mẫu khác."
        nhanXacNhan="Xoá mẫu"
        bienThe="destructive"
        dangXuLy={removeTemplate.isPending}
        onXacNhan={() => {
          if (!xoaId) return
          removeTemplate.mutate(xoaId, { onSuccess: () => setXoaId(null) })
        }}
      />
    </div>
  )
}
