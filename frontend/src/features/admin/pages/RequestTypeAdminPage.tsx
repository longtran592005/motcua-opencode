import * as React from 'react'
import { FileCog, Info, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { FormFieldDesigner } from '../components/FormFieldDesigner'
import {
  useAdminRequestTypes,
  useAdminTemplates,
  useAdminWorkflows,
  useRemoveRequestType,
  useRequestTypeStats,
  useSaveRequestType,
} from '../hooks/useAdmin'
import { formatCurrency } from '@/lib/formatters'
import { REQUEST_TYPE_GROUPS, type RequestType } from '@/types'
import { cn } from '@/lib/utils'

const MAU_OPTIONS = [
  { value: 'brand', label: 'Xanh dương' },
  { value: 'emerald', label: 'Xanh lá' },
  { value: 'amber', label: 'Vàng cam' },
  { value: 'violet', label: 'Tím' },
  { value: 'rose', label: 'Đỏ' },
]

const ICON_OPTIONS = [
  'FileCheck2',
  'ClipboardList',
  'CalendarX2',
  'PauseCircle',
  'ArrowLeftRight',
  'FileText',
]

function rong(): RequestType {
  return {
    id: '',
    ma: '',
    ten: '',
    nhom: REQUEST_TYPE_GROUPS[0],
    moTa: '',
    icon: 'FileText',
    mau: 'brand',
    formFields: [],
    giayTo: [],
    workflowId: '',
    templateId: '',
    soNgayXuLy: 5,
    lePhi: 0,
    hoatDong: true,
  }
}

/** Trang quản trị loại đơn và thiết kế biểu mẫu động (chỉ ADMIN). */
export function RequestTypeAdminPage() {
  const { data, isLoading, isError, refetch } = useAdminRequestTypes()
  const { data: stats } = useRequestTypeStats()
  const { data: workflows } = useAdminWorkflows()
  const { data: templates } = useAdminTemplates()
  const saveRequestType = useSaveRequestType()
  const removeRequestType = useRemoveRequestType()

  const [moEditor, setMoEditor] = React.useState(false)
  const [draft, setDraft] = React.useState<RequestType>(rong())
  const [xoaId, setXoaId] = React.useState<string | null>(null)

  function moTaoMoi() {
    setDraft(rong())
    setMoEditor(true)
  }

  function moSua(rt: RequestType) {
    setDraft({ ...rt, formFields: [...rt.formFields], giayTo: [...rt.giayTo] })
    setMoEditor(true)
  }

  function luu() {
    const payload = {
      ...draft,
      ma: draft.ma.trim().toUpperCase(),
      ten: draft.ten.trim(),
    }
    saveRequestType.mutate(
      { id: draft.id || undefined, input: payload },
      { onSuccess: () => setMoEditor(false) },
    )
  }

  const hopLe = draft.ma.trim() !== '' && draft.ten.trim() !== '' && draft.workflowId !== ''

  function soLuot(rtId: string): number {
    return stats?.find((s) => s.requestTypeId === rtId)?.soLuong ?? 0
  }

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Loại đơn & biểu mẫu"
        moTa="Cấu hình loại đơn, biểu mẫu động, giấy tờ bắt buộc và luồng duyệt áp dụng."
        actions={
          <Button className="gap-2" onClick={moTaoMoi}>
            <Plus className="size-4" />
            Thêm loại đơn
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
          icon={FileCog}
          tieuDe="Chưa có loại đơn nào"
          moTa="Bấm “Thêm loại đơn” để tạo loại đơn đầu tiên."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((rt) => (
            <Card key={rt.id} className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-brand-heading">
                      {rt.ten}
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {rt.ma}
                      </Badge>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{rt.moTa}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      rt.hoatDong
                        ? 'border-success/40 bg-success-soft text-success'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {rt.hoatDong ? 'Đang hoạt động' : 'Tạm dừng'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{rt.nhom}</span>
                  <span>{rt.formFields.length} trường</span>
                  <span>{rt.giayTo.length} giấy tờ</span>
                  <span>{rt.soNgayXuLy} ngày</span>
                  <span>{rt.lePhi > 0 ? formatCurrency(rt.lePhi) : 'Miễn phí'}</span>
                  <span>{soLuot(rt.id)} lượt nộp</span>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => moSua(rt)}>
                    <Pencil className="size-4" />
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setXoaId(rt.id)}
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

      <Dialog open={moEditor} onOpenChange={setMoEditor}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Sửa loại đơn' : 'Thêm loại đơn mới'}</DialogTitle>
            <DialogDescription>
              Cấu hình thông tin, biểu mẫu động và giấy tờ kèm theo của loại đơn.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="thong-tin">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="thong-tin">
                <Layers className="mr-1.5 size-4" />
                Thông tin chung
              </TabsTrigger>
              <TabsTrigger value="bieu-mau">Biểu mẫu ({draft.formFields.length})</TabsTrigger>
              <TabsTrigger value="giay-to">Giấy tờ ({draft.giayTo.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="thong-tin" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rt-ma">
                    Mã loại đơn <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rt-ma"
                    value={draft.ma}
                    onChange={(e) => setDraft({ ...draft, ma: e.target.value })}
                    placeholder="GXN"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-ten">
                    Tên loại đơn <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rt-ten"
                    value={draft.ten}
                    onChange={(e) => setDraft({ ...draft, ten: e.target.value })}
                    placeholder="Giấy xác nhận sinh viên"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-nhom">Nhóm</Label>
                  <Select
                    value={draft.nhom}
                    onValueChange={(v) => setDraft({ ...draft, nhom: v })}
                  >
                    <SelectTrigger id="rt-nhom">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUEST_TYPE_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-icon">Biểu tượng</Label>
                  <Select
                    value={draft.icon}
                    onValueChange={(v) => setDraft({ ...draft, icon: v })}
                  >
                    <SelectTrigger id="rt-icon">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-mau">Màu nhận diện</Label>
                  <Select value={draft.mau} onValueChange={(v) => setDraft({ ...draft, mau: v })}>
                    <SelectTrigger id="rt-mau">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAU_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-workflow">
                    Luồng duyệt <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={draft.workflowId || undefined}
                    onValueChange={(v) => setDraft({ ...draft, workflowId: v })}
                  >
                    <SelectTrigger id="rt-workflow">
                      <SelectValue placeholder="Chọn luồng duyệt" />
                    </SelectTrigger>
                    <SelectContent>
                      {(workflows ?? []).map((wf) => (
                        <SelectItem key={wf.id} value={wf.id}>
                          {wf.ten} ({wf.steps.length} cấp)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-template">Mẫu văn bản</Label>
                  <Select
                    value={draft.templateId || undefined}
                    onValueChange={(v) => setDraft({ ...draft, templateId: v })}
                  >
                    <SelectTrigger id="rt-template">
                      <SelectValue placeholder="Chọn mẫu văn bản" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templates ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.ten}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-ngay">Thời gian xử lý (ngày)</Label>
                  <Input
                    id="rt-ngay"
                    type="number"
                    min={1}
                    value={draft.soNgayXuLy}
                    onChange={(e) => setDraft({ ...draft, soNgayXuLy: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rt-le-phi">Lệ phí (VNĐ)</Label>
                  <Input
                    id="rt-le-phi"
                    type="number"
                    min={0}
                    step={1000}
                    value={draft.lePhi}
                    onChange={(e) => setDraft({ ...draft, lePhi: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rt-mo-ta">Mô tả ngắn</Label>
                  <Textarea
                    id="rt-mo-ta"
                    value={draft.moTa}
                    onChange={(e) => setDraft({ ...draft, moTa: e.target.value })}
                    rows={2}
                    placeholder="Mô tả mục đích sử dụng của loại đơn này."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="rt-hoat-dong" className="cursor-pointer">
                    Cho phép sinh viên nộp
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Tắt để tạm dừng nhận hồ sơ loại này.
                  </p>
                </div>
                <Switch
                  id="rt-hoat-dong"
                  checked={draft.hoatDong}
                  onCheckedChange={(v) => setDraft({ ...draft, hoatDong: v })}
                />
              </div>
            </TabsContent>

            <TabsContent value="bieu-mau" className="pt-4">
              <FormFieldDesigner
                fields={draft.formFields}
                onChange={(formFields) => setDraft({ ...draft, formFields })}
              />
            </TabsContent>

            <TabsContent value="giay-to" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-brand-heading">Giấy tờ kèm theo</p>
                  <p className="text-xs text-muted-foreground">
                    Danh sách giấy tờ sinh viên cần tải lên khi nộp hồ sơ.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      giayTo: [
                        ...draft.giayTo,
                        { key: `giay_to_${draft.giayTo.length + 1}`, label: '', batBuoc: true },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Thêm giấy tờ
                </Button>
              </div>

              {draft.giayTo.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Chưa có giấy tờ nào được yêu cầu.
                </p>
              ) : (
                <ul className="space-y-2">
                  {draft.giayTo.map((gt, index) => (
                    <li key={index} className="space-y-2 rounded-lg border p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={gt.label}
                          placeholder="Tên giấy tờ, ví dụ: Ảnh CCCD mặt trước"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              giayTo: draft.giayTo.map((item, i) =>
                                i === index ? { ...item, label: e.target.value } : item,
                              ),
                            })
                          }
                        />
                        <Input
                          value={gt.key}
                          placeholder="khoá_định_danh"
                          className="font-mono text-sm"
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              giayTo: draft.giayTo.map((item, i) =>
                                i === index ? { ...item, key: e.target.value } : item,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <Switch
                            checked={gt.batBuoc}
                            onCheckedChange={(v) =>
                              setDraft({
                                ...draft,
                                giayTo: draft.giayTo.map((item, i) =>
                                  i === index ? { ...item, batBuoc: v } : item,
                                ),
                              })
                            }
                            aria-label="Bắt buộc nộp"
                          />
                          Bắt buộc nộp
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              giayTo: draft.giayTo.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                          Xoá
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              <Info className="mr-1 inline size-3" aria-hidden="true" />
              Biến thể hiện: {draft.formFields.length} trường · {draft.giayTo.length} giấy tờ
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMoEditor(false)}>
                Huỷ
              </Button>
              <Button onClick={luu} disabled={!hopLe || saveRequestType.isPending}>
                {draft.id ? 'Lưu thay đổi' : 'Tạo loại đơn'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaId !== null}
        onOpenChange={(open) => !open && setXoaId(null)}
        tieuDe="Xoá loại đơn"
        moTa="Loại đơn sẽ không còn hiển thị cho sinh viên. Các hồ sơ đã nộp vẫn được giữ lại."
        nhanXacNhan="Xoá loại đơn"
        bienThe="destructive"
        dangXuLy={removeRequestType.isPending}
        onXacNhan={() => {
          if (!xoaId) return
          removeRequestType.mutate(xoaId, { onSuccess: () => setXoaId(null) })
        }}
      />
    </div>
  )
}
