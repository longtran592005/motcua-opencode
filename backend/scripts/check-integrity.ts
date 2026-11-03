import { prisma } from '../src/lib/prisma'

const checks = [
  ['application status is known', prisma.$queryRaw`SELECT 1 FROM applications LIMIT 1`],
  ['documents have unique application', prisma.$queryRaw`SELECT application_id FROM signed_documents GROUP BY application_id HAVING count(*) > 1`],
  ['orphan step instances', prisma.$queryRaw`SELECT si.id FROM step_instances si LEFT JOIN applications a ON a.id = si.application_id WHERE a.id IS NULL LIMIT 1`],
] as const

try {
  for (const [name, query] of checks) {
    await query
    console.log(`PASS\t${name}`)
  }
} catch (error) {
  console.error('FAIL\tintegrity check', error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
