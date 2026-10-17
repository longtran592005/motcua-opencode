/**
 * Cổng chặn CI: ma trận bao phủ OpenAPI × backend × test.
 *
 * - Sinh docs/MA_TRAN_KIEM_THU.md
 * - In danh sách thao tác chưa có test
 * - FAIL (mã thoát 1) nếu thao tác ĐÃ LÀM trên backend mà chưa có test nào
 *
 * Chạy: npx tsx scripts/coverage-matrix.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  opKey,
  opsMatch,
  parseOpenApiOperations,
  readUtf,
  scanImplementedOps,
  scanTestHits,
  type OpenApiOp,
  type TestHit,
} from './lib/openapi-ops'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

interface Row {
  op: OpenApiOp
  key: string
  installed: boolean
  files: string[]
  counts: { thanhCong: number; loiNghiepVu: number; loiQuyen: number; loiDuLieu: number; todo: number }
}

function hitsFor(op: OpenApiOp, hits: TestHit[]): TestHit[] {
  return hits.filter((h) => opsMatch(h.method, h.path, op.method, op.path))
}

function buildRows(): { rows: Row[]; implemented: Set<string>; ops: OpenApiOp[] } {
  const yaml = readUtf(join(root, 'docs/openapi.yaml'))
  const ops = parseOpenApiOperations(yaml)
  const implemented = scanImplementedOps(join(root, 'backend/src'))
  const hits = scanTestHits(join(root, 'backend/tests'))

  const rows: Row[] = ops.map((op) => {
    const key = opKey(op.method, op.path)
    const related = hitsFor(op, hits)
    const files = [...new Set(related.map((h) => `backend/tests/${h.file}`))]
    const counts = { thanhCong: 0, loiNghiepVu: 0, loiQuyen: 0, loiDuLieu: 0, todo: 0 }
    for (const h of related) counts[h.kind] += 1
    const installed =
      implemented.has(key) ||
      [...implemented].some((k) => {
        const [m, ...rest] = k.split(' ')
        return opsMatch(m ?? '', rest.join(' '), op.method, op.path)
      })
    return { op, key, installed, files, counts }
  })
  return { rows, implemented, ops }
}

function mdEscape(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function renderMarkdown(rows: Row[]): string {
  const total = rows.length
  const daLam = rows.filter((r) => r.installed).length
  const chuaLam = total - daLam
  const coTest = rows.filter((r) => r.files.length > 0).length
  const daLamChuaTest = rows.filter((r) => r.installed && r.files.length === 0)
  const chuaLamRows = rows.filter((r) => !r.installed)

  const lines: string[] = []
  lines.push('# Ma trận kiểm thử API')
  lines.push('')
  lines.push('Tài liệu này được **sinh tự động** bởi `scripts/coverage-matrix.ts` từ `docs/openapi.yaml`, mã nguồn `backend/src` và các file trong `backend/tests`.')
  lines.push('')
  lines.push('Không sửa tay — chạy lại `npm run check:matrix` khi thêm endpoint hoặc thêm test.')
  lines.push('')
  lines.push('## Tóm tắt (đọc nhanh)')
  lines.push('')
  lines.push('| Chỉ số | Số lượng |')
  lines.push('| --- | ---: |')
  lines.push(`| Tổng thao tác trong hợp đồng OpenAPI | ${total} |`)
  lines.push(`| Đã làm trên backend | ${daLam} |`)
  lines.push(`| Chưa làm trên backend | ${chuaLam} |`)
  lines.push(`| Đã có ít nhất một ca kiểm thử | ${coTest} |`)
  lines.push(`| Đã làm nhưng chưa có test (cổng chặn CI) | ${daLamChuaTest.length} |`)
  lines.push('')
  lines.push('Cột **Trạng thái cài đặt**: Đã làm = backend đã có route tương ứng; Chưa làm = có trong OpenAPI nhưng chưa thấy route.')
  lines.push('')
  lines.push('Cột **Số ca**: thành công / lỗi nghiệp vụ / lỗi quyền / lỗi dữ liệu (ước lượng từ tên ca kiểm thử). TODO = ca đánh dấu chưa viết.')
  lines.push('')

  if (daLamChuaTest.length) {
    lines.push('## Thao tác đã làm nhưng chưa có test')
    lines.push('')
    lines.push('Những dòng này làm cổng `check:matrix` **FAIL**. Cần bổ sung test (giai đoạn kiểm thử API).')
    lines.push('')
    for (const r of daLamChuaTest) {
      lines.push(`- \`${r.key}\` — ${r.op.summary}`)
    }
    lines.push('')
  }

  if (chuaLamRows.length) {
    lines.push('## Thao tác chưa làm (giữ trong ma trận, test dạng TODO)')
    lines.push('')
    lines.push('| Thao tác | Việc sẽ làm | Giai đoạn dự kiến |')
    lines.push('| --- | --- | --- |')
    for (const r of chuaLamRows) {
      const giai = giaiDoanDuKien(r.op)
      lines.push(`| \`${r.key}\` | ${mdEscape(r.op.summary)} | ${giai} |`)
    }
    lines.push('')
  }

  const tags = [...new Set(rows.map((r) => r.op.tag))]
  for (const tag of tags) {
    lines.push(`## ${tag}`)
    lines.push('')
    lines.push('| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const r of rows.filter((x) => x.op.tag === tag)) {
      const cai = r.installed ? 'Đã làm' : 'Chưa làm'
      const files = r.files.length ? r.files.map((f) => `\`${f}\``).join('<br>') : '—'
      const c = r.counts
      const so = `${c.thanhCong} / ${c.loiNghiepVu} / ${c.loiQuyen} / ${c.loiDuLieu} / ${c.todo}`
      lines.push(
        `| \`${r.methodPath()}\` ${mdEscape(r.op.summary)} | ${r.op.roles.join(', ')} | ${cai} | ${files} | ${so} |`,
      )
    }
    lines.push('')
  }

  lines.push('## Cách đọc đối với người không lập trình')
  lines.push('')
  lines.push('- **Đã làm + có số ca > 0**: chức năng đã được viết và đã có bài kiểm tự động.')
  lines.push('- **Đã làm + số ca = 0**: chức năng có trên máy chủ nhưng chưa được kiểm tự động — đây là lỗ hổng kiểm thử, CI sẽ chặn.')
  lines.push('- **Chưa làm**: chức năng mới chỉ có trên giấy (tài liệu API), chưa có trên máy chủ. Vẫn giữ trong bảng để không bị quên.')
  lines.push('')
  return lines.join('\n').replace(/r\.methodPath\(\)/g, '')
}

// Gắn methodPath vào row bằng prototype-style helper
declare module './coverage-matrix' {
  // no-op to keep file self-contained
}

function giaiDoanDuKien(op: OpenApiOp): string {
  const p = op.path
  if (p.startsWith('/chat')) return 'Giai đoạn trợ lý ảo (sau)'
  if (p.startsWith('/templates')) return 'Giai đoạn mẫu văn bản (sau)'
  if (p.startsWith('/files')) return 'Giai đoạn lưu trữ tệp (sau)'
  if (p.includes('/export') || p.includes('/report')) return 'Giai đoạn báo cáo / xuất tệp (sau)'
  if (p.includes('/stream')) return 'Giai đoạn thông báo realtime (sau)'
  if (p.includes('/catalog/') && op.method === 'GET' && p.includes('{ma}')) return 'Giai đoạn hoàn thiện danh mục (sau)'
  return 'Giai đoạn chức năng tương ứng (sau)'
}

function renderTodoTest(rows: Row[]): string {
  const chua = rows.filter((r) => !r.installed)
  const lines = [
    '/**',
    ' * Các thao tác OpenAPI chưa được cài trên backend.',
    ' * Giữ trong bộ test dưới dạng it.todo — KHÔNG xóa khỏi ma trận.',
    ' * File này được sinh bởi scripts/coverage-matrix.ts',
    ' */',
    "import { describe, it } from 'vitest'",
    '',
    "describe('Thao tác OpenAPI chưa làm — giữ TODO', () => {",
  ]
  for (const r of chua) {
    const reason = giaiDoanDuKien(r.op)
    lines.push(
      `  it.todo('${r.op.method} ${r.op.path} — ${r.op.summary.replace(/'/g, "\\'")} (chưa làm; ${reason})')`,
    )
  }
  lines.push('})')
  lines.push('')
  return lines.join('\n')
}

function main(): void {
  const { rows } = buildRows()
  // gắn chuỗi hiển thị
  for (const r of rows) {
    ;(r as Row & { methodPath: () => string }).methodPath = () => `${r.op.method} ${r.op.path}`
  }

  let md = renderMarkdown(rows)
  // renderMarkdown accidentally used r.methodPath in template as text if I messed up —
  // viết lại bảng bằng chuỗi có sẵn
  md = buildMarkdown(rows)

  writeFileSync(join(root, 'docs/MA_TRAN_KIEM_THU.md'), md, 'utf8')
  mkdirSync(join(root, 'backend/tests/api'), { recursive: true })
  writeFileSync(join(root, 'backend/tests/api/todo-openapi.test.ts'), renderTodoTest(rows), 'utf8')

  const chuaTest = rows.filter((r) => r.files.length === 0)
  const daLamChuaTest = rows.filter((r) => r.installed && r.files.length === 0)

  process.stdout.write(`OpenAPI: ${rows.length} thao tác\n`)
  process.stdout.write(`Đã làm: ${rows.filter((r) => r.installed).length}\n`)
  process.stdout.write(`Chưa làm: ${rows.filter((r) => !r.installed).length}\n`)
  process.stdout.write(`Chưa có test nào: ${chuaTest.length}\n`)
  if (chuaTest.length) {
    process.stdout.write('\nDanh sách thao tác chưa có test:\n')
    for (const r of chuaTest) {
      const st = r.installed ? 'ĐÃ LÀM' : 'chưa làm'
      process.stdout.write(`  [${st}] ${r.op.method} ${r.op.path} — ${r.op.summary}\n`)
    }
  }

  if (daLamChuaTest.length) {
    process.stderr.write(
      `\nCỔNG CHẶN: ${daLamChuaTest.length} thao tác đã làm nhưng chưa có test. Mã thoát 1.\n`,
    )
    process.exit(1)
  }
  process.stdout.write('\nMa trận OK: mọi thao tác đã làm đều có ít nhất một ca kiểm thử.\n')
}

function buildMarkdown(rows: Row[]): string {
  const total = rows.length
  const daLam = rows.filter((r) => r.installed).length
  const chuaLam = total - daLam
  const coTest = rows.filter((r) => r.files.length > 0).length
  const daLamChuaTest = rows.filter((r) => r.installed && r.files.length === 0)
  const chuaLamRows = rows.filter((r) => !r.installed)

  const lines: string[] = []
  lines.push('# Ma trận kiểm thử API')
  lines.push('')
  lines.push('Tài liệu này được **sinh tự động** bởi `scripts/coverage-matrix.ts` từ `docs/openapi.yaml`, mã nguồn `backend/src` và các file trong `backend/tests`.')
  lines.push('')
  lines.push('Không sửa tay. Khi thêm API hoặc thêm test, chạy lại `npm run check:matrix`.')
  lines.push('')
  lines.push('## Tóm tắt (đọc nhanh)')
  lines.push('')
  lines.push('| Chỉ số | Số lượng |')
  lines.push('| --- | ---: |')
  lines.push(`| Tổng thao tác trong hợp đồng OpenAPI | ${total} |`)
  lines.push(`| Đã làm trên backend | ${daLam} |`)
  lines.push(`| Chưa làm trên backend | ${chuaLam} |`)
  lines.push(`| Đã có ít nhất một ca kiểm thử | ${coTest} |`)
  lines.push(`| Đã làm nhưng chưa có test (cổng chặn CI) | ${daLamChuaTest.length} |`)
  lines.push('')
  lines.push('- **Đã làm**: máy chủ đã có đường dẫn này.')
  lines.push('- **Chưa làm**: mới có trên tài liệu API, chưa có trên máy chủ — vẫn giữ dòng, không xóa.')
  lines.push('- **Số ca**: thành công / lỗi nghiệp vụ / lỗi quyền / lỗi dữ liệu / TODO (đếm từ tên ca kiểm thử).')
  lines.push('')

  if (daLamChuaTest.length) {
    lines.push('## Thao tác đã làm nhưng chưa có test')
    lines.push('')
    lines.push('Những dòng này làm lệnh `npm run check:matrix` thất bại. Cần viết test (kế hoạch: phần kiểm thử API).')
    lines.push('')
    for (const r of daLamChuaTest) {
      lines.push(`- \`${r.op.method} ${r.op.path}\` — ${r.op.summary}`)
    }
    lines.push('')
  }

  if (chuaLamRows.length) {
    lines.push('## Thao tác chưa làm')
    lines.push('')
    lines.push('| Thao tác | Việc sẽ làm | Giai đoạn dự kiến |')
    lines.push('| --- | --- | --- |')
    for (const r of chuaLamRows) {
      lines.push(
        `| \`${r.op.method} ${r.op.path}\` | ${mdEscape(r.op.summary)} | ${giaiDoanDuKien(r.op)} |`,
      )
    }
    lines.push('')
  }

  const tags = [...new Set(rows.map((r) => r.op.tag))]
  for (const tag of tags) {
    lines.push(`## ${tag}`)
    lines.push('')
    lines.push('| Thao tác | Vai trò được phép | Cài đặt | File test | Số ca (OK / NV / Quyền / Dữ liệu / TODO) |')
    lines.push('| --- | --- | --- | --- | --- |')
    for (const r of rows.filter((x) => x.op.tag === tag)) {
      const cai = r.installed ? 'Đã làm' : 'Chưa làm'
      const files = r.files.length ? r.files.map((f) => `\`${f}\``).join('<br>') : '—'
      const c = r.counts
      const so = `${c.thanhCong} / ${c.loiNghiepVu} / ${c.loiQuyen} / ${c.loiDuLieu} / ${c.todo}`
      lines.push(
        `| \`${r.op.method} ${r.op.path}\`<br>${mdEscape(r.op.summary)} | ${r.op.roles.join(', ')} | ${cai} | ${files} | ${so} |`,
      )
    }
    lines.push('')
  }

  lines.push('## Cách đọc đối với người không lập trình')
  lines.push('')
  lines.push('1. Tìm chức năng theo tên tiếng Việt (cột thao tác).')
  lines.push('2. Cột **Cài đặt** cho biết máy chủ đã có chức năng đó chưa.')
  lines.push('3. Cột **File test** cho biết đã có bài kiểm tự động chưa. Dấu gạch ngang nghĩa là chưa kiểm.')
  lines.push('4. Nếu **Đã làm** mà chưa có file test, đây là rủi ro: chức năng có thể hỏng mà không ai biết.')
  lines.push('')
  return lines.join('\n')
}

main()
