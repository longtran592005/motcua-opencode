import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type Client = Prisma.TransactionClient | typeof prisma

/**
 * Sinh mã hồ sơ MC-YYYY-NNNNNN từ sequence trong CSDL (migration business_rules).
 * Định dạng cũng được ràng buộc bằng CHECK ở tầng CSDL.
 */
export async function nextMaHoSo(client: Client = prisma): Promise<string> {
  const rows = await client.$queryRaw<Array<{ ma: string }>>`SELECT next_ma_ho_so() AS ma`
  const ma = rows[0]?.ma
  if (!ma) throw new Error('Không sinh được mã hồ sơ từ sequence next_ma_ho_so()')
  return ma
}
