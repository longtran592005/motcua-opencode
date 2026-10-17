import { describe, expect, it } from 'vitest'
import { runIntegrityChecks } from '../../../scripts/check-integrity'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://motcua:motcua@localhost:5434/motcua_test?schema=public'

describe('CSDL — Toàn vẹn dữ liệu nghiệp vụ (Integrity Checks)', () => {
  it('Tích hợp check-integrity: quét 100% bản ghi trong CSDL phát hiện 0 vi phạm', async () => {
    const violations = await runIntegrityChecks(databaseUrl)

    if (violations.length > 0) {
      const details = violations
        .map((v) => `[${v.ma}] ${v.moTa}: ${v.soLuong} lỗi (Ví dụ: ${JSON.stringify(v.viDu)})`)
        .join('\n')
      expect.fail(`Phát hiện các vi phạm toàn vẹn dữ liệu:\n${details}`)
    }

    expect(violations.length).toBe(0)
  })
})
