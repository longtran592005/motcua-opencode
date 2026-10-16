import { Router } from 'express'
import { z, type ZodTypeAny } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send } from '../../lib/envelope'
import { prisma } from '../../lib/prisma'
import { AppError } from '../../lib/errors'
import { isUuid } from '../../lib/crypto'
import { departmentDto, facultyDto } from '../shared/dto'

/** Mã nghiệp vụ không được có dạng UUID (quyết định B1, điều kiện a). */
const maField = z
  .string()
  .trim()
  .min(1, 'Thiếu mã.')
  .max(50)
  .refine((v) => !isUuid(v), 'Mã nghiệp vụ không được có dạng UUID.')

/** Tham số đường dẫn nhận CẢ mã nghiệp vụ lẫn UUID (quyết định B1). */
const idParam = z.object({ id: z.string().trim().min(1).max(200) })
const nullableUuid = z.string().uuid().nullable()

interface ResourceDef {
  createSchema: ZodTypeAny
  updateSchema: ZodTypeAny
  list(): Promise<unknown[]>
  create(body: Record<string, unknown>): Promise<unknown>
  update(id: string, body: Record<string, unknown>): Promise<unknown>
  remove(id: string): Promise<void>
  /** Quy đổi mã nghiệp vụ hoặc UUID về UUID nội bộ. */
  findId(idOrMa: string): Promise<string>
}

/** Khuôn CRUD dùng chung: đọc cho mọi người dùng đã đăng nhập, ghi cho ADMIN. */
function crudRouter(def: ResourceDef): Router {
  const r = Router()
  r.use(authenticate)

  r.get(
    '/',
    asyncHandler(async (_req, res) => {
      send(res, await def.list())
    }),
  )
  r.post(
    '/',
    requireRole('ADMIN'),
    idempotent(),
    validate(def.createSchema),
    asyncHandler(async (req, res) => {
      send(res, await def.create(req.body as Record<string, unknown>), 201)
    }),
  )
  r.patch(
    '/:id',
    requireRole('ADMIN'),
    idempotent(),
    validate(idParam, 'params'),
    validate(def.updateSchema),
    asyncHandler(async (req, res) => {
      const target = await def.findId((req.params as { id: string }).id)
      send(res, await def.update(target, req.body as Record<string, unknown>))
    }),
  )
  r.delete(
    '/:id',
    requireRole('ADMIN'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
      const target = await def.findId((req.params as { id: string }).id)
      await def.remove(target)
      res.status(204).end()
    }),
  )
  return r
}

const softDelete = (model: {
  update(args: { where: { id: string }; data: { deletedAt: Date } }): Promise<unknown>
}) => async (id: string) => {
  try {
    await model.update({ where: { id }, data: { deletedAt: new Date() } })
  } catch {
    throw AppError.notFound('Không tìm thấy bản ghi cần xoá.')
  }
}

/**
 * Quy đổi tham số đường dẫn (mã nghiệp vụ hoặc UUID) về UUID nội bộ.
 * Quyết định B1: mọi endpoint đã xác thực chấp nhận CẢ mã nghiệp vụ lẫn UUID.
 */
const makeFindId =
  (
    findFirst: (where: { id?: string; ma?: string }) => Promise<{ id: string } | null>,
    ten: string,
  ) =>
  async (idOrMa: string): Promise<string> => {
    const row = await findFirst(isUuid(idOrMa) ? { id: idOrMa } : { ma: idOrMa })
    if (!row) throw AppError.notFound(`Không tìm thấy ${ten}.`)
    return row.id
  }

/* -------------------------------- Khoa --------------------------------- */

const khoaCreate = z.object({
  ma: maField,
  ten: z.string().trim().min(2).max(200),
  vietTat: z.string().trim().min(1).max(20),
  truongKhoaId: nullableUuid.optional(),
})

const khoaRouter = crudRouter({
  createSchema: khoaCreate,
  updateSchema: khoaCreate.partial(),
  list: async () => {
    const rows = await prisma.faculty.findMany({ where: { deletedAt: null }, orderBy: { ma: 'asc' } })
    return rows.map(facultyDto)
  },
  create: async (b) => facultyDto(await prisma.faculty.create({ data: b as never })),
  update: async (id, b) => facultyDto(await prisma.faculty.update({ where: { id }, data: b as never })),
  remove: softDelete(prisma.faculty),
  findId: makeFindId((where) => prisma.faculty.findFirst({ where, select: { id: true } }), 'khoa'),
})

/* ------------------------------ Phòng ban ------------------------------ */

const phongCreate = z.object({
  ma: maField,
  ten: z.string().trim().min(2).max(200),
  vietTat: z.string().trim().min(1).max(20),
  truongPhongId: nullableUuid.optional(),
})

const phongBanRouter = crudRouter({
  createSchema: phongCreate,
  updateSchema: phongCreate.partial(),
  list: async () => {
    const rows = await prisma.department.findMany({ where: { deletedAt: null }, orderBy: { ma: 'asc' } })
    return rows.map(departmentDto)
  },
  create: async (b) => departmentDto(await prisma.department.create({ data: b as never })),
  update: async (id, b) =>
    departmentDto(await prisma.department.update({ where: { id }, data: b as never })),
  remove: softDelete(prisma.department),
  findId: makeFindId(
    (where) => prisma.department.findFirst({ where, select: { id: true } }),
    'phòng ban',
  ),
})

/* ------------------------------ Khóa học ------------------------------- */

const khoaHocCreate = z.object({
  ma: maField,
  ten: z.string().trim().min(2).max(200),
  namBatDau: z.coerce.number().int().min(1950).max(2100),
  namKetThuc: z.coerce.number().int().min(1950).max(2100),
})

const khoaHocDto = (k: { id: string; ma: string; ten: string; namBatDau: number; namKetThuc: number }) => ({
  id: k.id,
  ma: k.ma,
  ten: k.ten,
  namBatDau: k.namBatDau,
  namKetThuc: k.namKetThuc,
})

const khoaHocRouter = crudRouter({
  createSchema: khoaHocCreate,
  updateSchema: khoaHocCreate.partial(),
  list: async () => {
    const rows = await prisma.academicYear.findMany({
      where: { deletedAt: null },
      orderBy: { namBatDau: 'desc' },
    })
    return rows.map(khoaHocDto)
  },
  create: async (b) => khoaHocDto(await prisma.academicYear.create({ data: b as never })),
  update: async (id, b) =>
    khoaHocDto(await prisma.academicYear.update({ where: { id }, data: b as never })),
  remove: softDelete(prisma.academicYear),
  findId: makeFindId(
    (where) => prisma.academicYear.findFirst({ where, select: { id: true } }),
    'khoá học',
  ),
})

/* -------------------------------- Ngành -------------------------------- */

const nganhCreate = z.object({
  ma: maField,
  maChinhThuc: z.string().trim().max(30).nullable().optional(),
  ten: z.string().trim().min(2).max(200),
  khoaId: z.string().uuid(),
  khoaHocIds: z.array(z.string().uuid()).max(30).optional(),
})

const majorDto = (m: {
  id: string
  ma: string
  maChinhThuc: string | null
  ten: string
  facultyId: string
  academicYears: { academicYearId: string }[]
}) => ({
  id: m.id,
  ma: m.ma,
  ...(m.maChinhThuc ? { maChinhThuc: m.maChinhThuc } : {}),
  ten: m.ten,
  khoaId: m.facultyId,
  khoaHocIds: m.academicYears.map((a) => a.academicYearId),
})

const nganhInclude = { academicYears: { select: { academicYearId: true } } } as const

const nganhRouter = crudRouter({
  createSchema: nganhCreate,
  updateSchema: nganhCreate.partial(),
  list: async () => {
    const rows = await prisma.major.findMany({
      where: { deletedAt: null },
      include: nganhInclude,
      orderBy: { ma: 'asc' },
    })
    return rows.map(majorDto)
  },
  create: async (b) => {
    const { khoaHocIds, ...rest } = b as { khoaHocIds?: string[] }
    return prisma.$transaction(async (tx) => {
      const created = await tx.major.create({ data: rest as never })
      if (khoaHocIds?.length) {
        await tx.majorAcademicYear.createMany({
          data: khoaHocIds.map((id) => ({ majorId: created.id, academicYearId: id })),
          skipDuplicates: true,
        })
      }
      return majorDto(await tx.major.findUniqueOrThrow({ where: { id: created.id }, include: nganhInclude }))
    })
  },
  update: async (id, b) => {
    const { khoaHocIds, ...rest } = b as { khoaHocIds?: string[] }
    return prisma.$transaction(async (tx) => {
      await tx.major.update({ where: { id }, data: rest as never })
      if (khoaHocIds) {
        await tx.majorAcademicYear.deleteMany({ where: { majorId: id } })
        if (khoaHocIds.length) {
          await tx.majorAcademicYear.createMany({
            data: khoaHocIds.map((ayId) => ({ majorId: id, academicYearId: ayId })),
            skipDuplicates: true,
          })
        }
      }
      return majorDto(await tx.major.findUniqueOrThrow({ where: { id }, include: nganhInclude }))
    })
  },
  remove: softDelete(prisma.major),
  findId: makeFindId((where) => prisma.major.findFirst({ where, select: { id: true } }), 'ngành'),
})

/* --------------------------------- Lớp --------------------------------- */

const lopCreate = z.object({
  ma: maField,
  ten: z.string().trim().min(2).max(200),
  khoaId: z.string().uuid(),
  nganhId: z.string().uuid(),
  khoaHocId: z.string().uuid(),
  coVanId: nullableUuid.optional(),
  siSo: z.coerce.number().int().min(0).max(1000).default(0),
})

const lopDto = (c: {
  id: string
  ma: string
  ten: string
  facultyId: string
  majorId: string
  academicYearId: string
  coVanId: string | null
  siSo: number
}) => ({
  id: c.id,
  ma: c.ma,
  ten: c.ten,
  khoaId: c.facultyId,
  nganhId: c.majorId,
  khoaHocId: c.academicYearId,
  coVanId: c.coVanId ?? '',
  siSo: c.siSo,
})

const lopRouter = crudRouter({
  createSchema: lopCreate,
  updateSchema: lopCreate.partial(),
  list: async () => {
    const rows = await prisma.class.findMany({ where: { deletedAt: null }, orderBy: { ma: 'asc' } })
    return rows.map(lopDto)
  },
  create: async (b) => lopDto(await prisma.class.create({ data: b as never })),
  update: async (id, b) => lopDto(await prisma.class.update({ where: { id }, data: b as never })),
  remove: softDelete(prisma.class),
  findId: makeFindId((where) => prisma.class.findFirst({ where, select: { id: true } }), 'lớp'),
})

/* ------------------------------- Gắn kết ------------------------------- */

export const catalogRouter: Router = Router()
catalogRouter.use('/khoa', khoaRouter)
catalogRouter.use('/phong-ban', phongBanRouter)
catalogRouter.use('/nganh', nganhRouter)
catalogRouter.use('/lop', lopRouter)
catalogRouter.use('/khoa-hoc', khoaHocRouter)
