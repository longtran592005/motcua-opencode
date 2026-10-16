import { PrismaClient } from '@prisma/client'
import { isProduction } from '../config/env'

/**
 * Một thực thể PrismaClient dùng chung cho toàn tiến trình.
 * Trong kiểm thử, client được tái sử dụng giữa các tệp (xem tests/helpers.ts).
 */
declare global {
  // eslint-disable-next-line no-var
  var __motcuaPrisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalThis.__motcuaPrisma ??
  new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
  })

if (!isProduction) globalThis.__motcuaPrisma = prisma

export type { PrismaClient }
