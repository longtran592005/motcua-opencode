import * as React from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { Building2, Layers, Pencil, Plus, School, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable, type Column } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useAdminUsers, useAdvisors } from '../hooks/useAdmin'
import { khoaHocHooks, khoaHooks, lopHooks, nganhHooks, phongBanHooks } from '@/hooks/useCatalog'
import type { Khoa, KhoaHoc, Lop, Nganh, PhongBan } from '@/types'

type GiaTri = string | number | string[]

interface FieldConfig {
  key: string
  label: string
  type?: 'text' | 'number' | 'select' | 'multiselect'
  required?: boolean
  options?: { value: string; label: string }[]
}

interface CrudHooks<T extends { id: string }> {
  useList: (enabled?: boolean) => UseQueryResult<T[], Error>
  useCreate: () => UseMutationResult<T, Error, Omit<T, 'id'>>
  useUpdate: () => UseMutationResult<T, Error, { id: string; patch: Partial<T> }>
  useRemove: () => UseMutationResult<void, Error, string>
}

interface CrudPanelProps<T extends { id: string }> {
  hooks: CrudHooks<T>
  fields: FieldConfig[]
  emptyItem: () => Omit<T, 'id'>
  thongDiepRong: string
}

/** Bảng danh mục dùng chung: xem, thêm, sửa, xoá theo cấu hình trường. */
function CrudPanel<T extends { id: string }>({
  hooks,
  fields,
  emptyItem,
  thongDiepRong,
}: CrudPanelProps<T>) {
  const { data, isLoading, isError, refetch } = hooks.useList()
  const create = hooks.useCreate()
  const update = hooks.useUpdate()
  const remove = hooks.useRemove()

  const [moEditor, setMoEditor] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Record<string, GiaTri>>({})
  const [xoaId, setXoaId] = React.useState<string | null>(null)

  function moTaoMoi() {
    setEditId(null)
    setDraft(emptyItem() as unknown as Record<string, GiaTri>)
    setMoEditor(true)
  }

  function moSua(row: T) {
    setEditId(row.id)
    setDraft({ ...(row as unknown as Record<string, GiaTri>) })
    setMoEditor(true)
  }

  const hopLe = fields.every((f) => {
    if (!f.required) return true
    const value = draft[f.key]
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== ''
  })

  function luu() {
    const payload = { ...draft } as Record<string, GiaTri>
    for (const field of fields) {
      if (field.type === 'number' && typeof payload[field.key] === 'string') {
        payload[field.key] = Number(payload[field.key])
      }
    }
    if (editId) {
      update.mutate(
        { id: editId, patch: payload as Partial<T> },
        { onSuccess: () => setMoEditor(false) },
      )
    } else {
      create.mutate(payload as unknown as Omit<T, 'id'>, { onSuccess: () => setMoEditor(false) })
    }
  }

  function hienThi(field: FieldConfig, row: T): React.ReactNode {
    const raw = (row as unknown as Record<string, GiaTri>)[field.key]
    if (raw === undefined || raw === null || raw === '') return '—'
    if (Array.isArray(raw)) {
      if (raw.length === 0) return '—'
      return raw
        .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
        .join(', ')
    }
    if (field.type === 'select') {
      return field.options?.find((o) => o.value === String(raw))?.label ?? String(raw)
    }
    return String(raw)
  }

  const columns: Column<T>[] = [
    ...fields.map((field) => ({
      key: field.key,
      header: field.label,
      cell: (row: T) => <span className="text-sm">{hienThi(field, row)}</span>,
    })),
    {
      key: 'hanhDong',
      header: 'Thao tác',
      className: 'text-right',
      cell: (row: T) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => moSua(row)}
            aria-label="Sửa bản ghi"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() => setXoaId(row.id)}
            aria-label="Xoá bản ghi"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-2" onClick={moTaoMoi}>
          <Plus className="size-4" />
          Thêm mới
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={data ?? []}
        getRowId={(row) => row.id}
        dangTai={isLoading}
        loi={isError}
        onThuLai={() => void refetch()}
        thongDiepRong={thongDiepRong}
      />

      <Dialog open={moEditor} onOpenChange={setMoEditor}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Sửa bản ghi' : 'Thêm bản ghi mới'}</DialogTitle>
            <DialogDescription>
              Các trường đánh dấu <span className="text-destructive">*</span> là bắt buộc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const value = draft[field.key]
              const capNhat = (v: GiaTri) => setDraft((prev) => ({ ...prev, [field.key]: v }))
              return (
                <div
                  key={field.key}
                  className={field.type === 'multiselect' ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}
                >
                  <Label htmlFor={`dm-${field.key}`}>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                  </Label>

                  {field.type === 'select' ? (
                    <Select value={String(value ?? '') || undefined} onValueChange={capNhat}>
                      <SelectTrigger id={`dm-${field.key}`}>
                        <SelectValue placeholder="Chọn giá trị" />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'multiselect' ? (
                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                      {(field.options ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">Chưa có lựa chọn nào.</p>
                      )}
                      {(field.options ?? []).map((o) => {
                        const selected = Array.isArray(value) && value.includes(o.value)
                        return (
                          <label key={o.value} className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const current = Array.isArray(value) ? value : []
                                capNhat(
                                  checked === true
                                    ? [...current, o.value]
                                    : current.filter((v) => v !== o.value),
                                )
                              }}
                            />
                            {o.label}
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <Input
                      id={`dm-${field.key}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={value === undefined || Array.isArray(value) ? '' : String(value)}
                      onChange={(e) =>
                        capNhat(field.type === 'number' ? e.target.value : e.target.value)
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoEditor(false)}>
              Huỷ
            </Button>
            <Button
              onClick={luu}
              disabled={!hopLe || create.isPending || update.isPending}
            >
              {editId ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={xoaId !== null}
        onOpenChange={(open) => !open && setXoaId(null)}
        tieuDe="Xoá bản ghi"
        moTa="Bản ghi sẽ bị xoá khỏi danh mục. Các dữ liệu liên quan cần được cập nhật lại."
        nhanXacNhan="Xoá"
        bienThe="destructive"
        dangXuLy={remove.isPending}
        onXacNhan={() => {
          if (!xoaId) return
          remove.mutate(xoaId, { onSuccess: () => setXoaId(null) })
        }}
      />
    </div>
  )
}

/** Trang quản lý danh mục dùng chung (chỉ ADMIN). */
export function CatalogPage() {
  const { data: khoaList } = khoaHooks.useList()
  const { data: nganhList } = nganhHooks.useList()
  const { data: khoaHocList } = khoaHocHooks.useList()
  const { data: advisors } = useAdvisors()
  const { data: allUsers } = useAdminUsers({ page: 1, pageSize: 500 })

  const khoaOptions = (khoaList ?? []).map((k) => ({ value: k.id, label: k.ten }))
  const nganhOptions = (nganhList ?? []).map((n) => ({ value: n.id, label: n.ten }))
  const khoaHocOptions = (khoaHocList ?? []).map((k) => ({ value: k.id, label: k.ten }))
  const staffOptions = (allUsers?.items ?? [])
    .filter((u) => u.role !== 'SINH_VIEN')
    .map((u) => ({ value: u.id, label: `${u.hoTen} · ${u.maSo}` }))
  const advisorOptions = (advisors ?? []).map((u) => ({
    value: u.id,
    label: `${u.hoTen} · ${u.maSo}`,
  }))

  const khoaFields: FieldConfig[] = [
    { key: 'ma', label: 'Mã khoa', required: true },
    { key: 'ten', label: 'Tên khoa', required: true },
    { key: 'vietTat', label: 'Viết tắt' },
    { key: 'truongKhoaId', label: 'Trưởng khoa', type: 'select', options: staffOptions },
  ]
  const phongBanFields: FieldConfig[] = [
    { key: 'ma', label: 'Mã phòng', required: true },
    { key: 'ten', label: 'Tên phòng ban', required: true },
    { key: 'vietTat', label: 'Viết tắt' },
    { key: 'truongPhongId', label: 'Trưởng phòng', type: 'select', options: staffOptions },
  ]
  const nganhFields: FieldConfig[] = [
    { key: 'ma', label: 'Mã ngành', required: true },
    { key: 'ten', label: 'Tên ngành', required: true },
    { key: 'khoaId', label: 'Khoa', type: 'select', required: true, options: khoaOptions },
    { key: 'khoaHocIds', label: 'Khoá học áp dụng', type: 'multiselect', options: khoaHocOptions },
  ]
  const lopFields: FieldConfig[] = [
    { key: 'ma', label: 'Mã lớp', required: true },
    { key: 'ten', label: 'Tên lớp', required: true },
    { key: 'khoaId', label: 'Khoa', type: 'select', required: true, options: khoaOptions },
    { key: 'nganhId', label: 'Ngành', type: 'select', required: true, options: nganhOptions },
    { key: 'khoaHocId', label: 'Khoá học', type: 'select', required: true, options: khoaHocOptions },
    { key: 'coVanId', label: 'Cố vấn học tập', type: 'select', options: advisorOptions },
    { key: 'siSo', label: 'Sĩ số', type: 'number' },
  ]
  const khoaHocFields: FieldConfig[] = [
    { key: 'ma', label: 'Mã khoá', required: true },
    { key: 'ten', label: 'Tên khoá', required: true },
    { key: 'namBatDau', label: 'Năm bắt đầu', type: 'number', required: true },
    { key: 'namKetThuc', label: 'Năm kết thúc', type: 'number', required: true },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        tieuDe="Danh mục dùng chung"
        moTa="Quản lý khoa, phòng ban, ngành, lớp và khoá học dùng trong toàn hệ thống."
      />

      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="khoa">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="khoa">
                <School className="mr-1.5 size-4" />
                Khoa
              </TabsTrigger>
              <TabsTrigger value="phong-ban">
                <Building2 className="mr-1.5 size-4" />
                Phòng ban
              </TabsTrigger>
              <TabsTrigger value="nganh">
                <Layers className="mr-1.5 size-4" />
                Ngành
              </TabsTrigger>
              <TabsTrigger value="lop">
                <Users className="mr-1.5 size-4" />
                Lớp
              </TabsTrigger>
              <TabsTrigger value="khoa-hoc">Khoá học</TabsTrigger>
            </TabsList>

            <TabsContent value="khoa" className="pt-4">
              <CrudPanel<Khoa>
                hooks={khoaHooks as unknown as CrudHooks<Khoa>}
                fields={khoaFields}
                emptyItem={() => ({ ma: '', ten: '', vietTat: '', truongKhoaId: '' })}
                thongDiepRong="Chưa có khoa nào"
              />
            </TabsContent>
            <TabsContent value="phong-ban" className="pt-4">
              <CrudPanel<PhongBan>
                hooks={phongBanHooks as unknown as CrudHooks<PhongBan>}
                fields={phongBanFields}
                emptyItem={() => ({ ma: '', ten: '', vietTat: '', truongPhongId: '' })}
                thongDiepRong="Chưa có phòng ban nào"
              />
            </TabsContent>
            <TabsContent value="nganh" className="pt-4">
              <CrudPanel<Nganh>
                hooks={nganhHooks as unknown as CrudHooks<Nganh>}
                fields={nganhFields}
                emptyItem={() => ({ ma: '', ten: '', khoaId: '', khoaHocIds: [] })}
                thongDiepRong="Chưa có ngành nào"
              />
            </TabsContent>
            <TabsContent value="lop" className="pt-4">
              <CrudPanel<Lop>
                hooks={lopHooks as unknown as CrudHooks<Lop>}
                fields={lopFields}
                emptyItem={() => ({
                  ma: '',
                  ten: '',
                  khoaId: '',
                  nganhId: '',
                  khoaHocId: '',
                  coVanId: '',
                  siSo: 0,
                })}
                thongDiepRong="Chưa có lớp nào"
              />
            </TabsContent>
            <TabsContent value="khoa-hoc" className="pt-4">
              <CrudPanel<KhoaHoc>
                hooks={khoaHocHooks as unknown as CrudHooks<KhoaHoc>}
                fields={khoaHocFields}
                emptyItem={() => ({ ma: '', ten: '', namBatDau: 2021, namKetThuc: 2025 })}
                thongDiepRong="Chưa có khoá học nào"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
