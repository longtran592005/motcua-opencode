import type { NotificationType, Prisma, Role } from '@prisma/client'
import { prisma } from './prisma'

type Client = Prisma.TransactionClient | typeof prisma

export interface NotificationInput {
  nguoiNhanId: string
  tieuDe: string
  noiDung: string
  loai: NotificationType
  applicationId?: string | null
  maHoSo?: string | null
  lienKet?: string | null
}

export async function pushNotification(
  input: NotificationInput,
  client: Client = prisma,
): Promise<void> {
  await client.notification.create({
    data: {
      nguoiNhanId: input.nguoiNhanId,
      tieuDe: input.tieuDe,
      noiDung: input.noiDung,
      loai: input.loai,
      applicationId: input.applicationId ?? null,
      maHoSo: input.maHoSo ?? null,
      lienKet: input.lienKet ?? null,
    },
  })
}

/** Gửi thông báo tới mọi người dùng đang hoạt động của một vai trò. */
export async function notifyRole(
  role: Role,
  payload: Omit<NotificationInput, 'nguoiNhanId'>,
  client: Client = prisma,
  exceptUserId?: string,
): Promise<void> {
  const users = await client.user.findMany({
    where: { role, deletedAt: null, trangThai: 'ACTIVE', ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  })
  if (!users.length) return
  await client.notification.createMany({
    data: users.map((u) => ({
      nguoiNhanId: u.id,
      tieuDe: payload.tieuDe,
      noiDung: payload.noiDung,
      loai: payload.loai,
      applicationId: payload.applicationId ?? null,
      maHoSo: payload.maHoSo ?? null,
      lienKet: payload.lienKet ?? null,
    })),
  })
}
