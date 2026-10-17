import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface OpenApiOp {
  method: string
  path: string
  summary: string
  tag: string
  roles: string[]
  public: boolean
}

const HTTP = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

/** Đọc mọi thao tác HTTP trong docs/openapi.yaml (không cần thư viện YAML). */
export function parseOpenApiOperations(yamlText: string): OpenApiOp[] {
  const lines = yamlText.split(/\r?\n/)
  const start = lines.findIndex((l) => l === 'paths:')
  if (start < 0) throw new Error('Không tìm thấy mục paths: trong openapi.yaml')

  const ops: OpenApiOp[] = []
  let path = ''
  let method = ''
  let summary = ''
  let tag = ''
  let roles: string[] | null = null
  let isPublic = false
  let inOp = false

  const flush = () => {
    if (!inOp || !path || !method) return
    ops.push({
      method: method.toUpperCase(),
      path,
      summary: summary || '(không có mô tả)',
      tag: tag || 'Khác',
      roles: roles && roles.length ? roles : isPublic ? ['Công khai'] : ['Đã đăng nhập'],
      public: isPublic,
    })
    method = ''
    summary = ''
    tag = ''
    roles = null
    isPublic = false
    inOp = false
  }

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!
    if (line.startsWith('components:') || line.startsWith('webhooks:')) break

    const pathMatch = line.match(/^  (\/\S+):$/)
    if (pathMatch) {
      flush()
      path = pathMatch[1]!
      continue
    }

    const methodMatch = line.match(/^    (get|post|put|patch|delete):$/)
    if (methodMatch) {
      flush()
      method = methodMatch[1]!
      inOp = true
      summary = ''
      tag = ''
      roles = null
      isPublic = false
      continue
    }

    if (!inOp) continue

    const sum = line.match(/^\s+summary:\s*"(.*)"\s*$/)
    if (sum) summary = sum[1]!

    const tags = line.match(/^\s+tags:\s*\[(.*)\]\s*$/)
    if (tags) {
      const first = tags[1]!.split(',')[0]?.replace(/["']/g, '').trim()
      if (first) tag = first
    }

    const rolesLine = line.match(/^\s+x-roles:\s*\[(.*)\]\s*$/)
    if (rolesLine) {
      roles = rolesLine[1]!
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    if (/^\s+security:\s*\[\s*\]\s*$/.test(line)) isPublic = true
  }
  flush()
  return ops
}

export function walkFiles(dir: string, pred: (f: string) => boolean): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walkFiles(p, pred))
    else if (pred(p)) out.push(p)
  }
  return out
}

const PARAM_BY_PREFIX: Array<[string, string]> = [
  ['/applications', 'maHoSo'],
  ['/approvals', 'maHoSo'],
  ['/otp', 'challengeId'],
  ['/users', 'maSo'],
  ['/request-types', 'ma'],
  ['/workflows', 'ma'],
  ['/catalog', 'ma'],
  ['/templates', 'ma'],
  ['/public/verify/token', 'token'],
  ['/public/verify/so-van-ban', 'so'],
  ['/chat/messages', 'messageId'],
  ['/files', 'fileToken'],
  ['/library', 'id'],
  ['/notifications', 'id'],
  ['/delegations', 'id'],
  ['/documents', 'id'],
  ['/audit-logs', 'id'],
]

function expressToOpenApi(prefix: string, route: string): string {
  let full = `${prefix}${route}`.replace(/\/{2,}/g, '/')
  if (full.length > 1 && full.endsWith('/')) full = full.slice(0, -1)
  return full.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name: string) => {
    const hit = PARAM_BY_PREFIX.find(([p]) => full.startsWith(p) || prefix.startsWith(p))
    if (name === 'token' || name === 'so' || name === 'fileToken' || name === 'messageId') {
      return `{${name}}`
    }
    return `{${hit?.[1] ?? (name === 'ma' ? 'ma' : name === 'id' ? 'id' : name)}}`
  })
}

interface Mount {
  prefix: string
  fileHint: string
}

/** Suy ra thao tác đã cài trong backend/src từ routes.ts và các file router. */
export function scanImplementedOps(backendSrc: string): Set<string> {
  const implemented = new Set<string>()
  const routesFile = readFileSync(join(backendSrc, 'routes.ts'), 'utf8')
  const mounts: Mount[] = []
  const mountRe = /apiRouter\.use\(\s*'([^']+)'\s*,\s*(\w+)/g
  let m: RegExpExecArray | null
  while ((m = mountRe.exec(routesFile))) {
    mounts.push({ prefix: m[1]!, fileHint: m[2]! })
  }

  const srcFiles = walkFiles(backendSrc, (f) => f.endsWith('.ts'))

  const catalog = readFileSync(join(backendSrc, 'modules/catalog/index.ts'), 'utf8')
  const catalogRes = [...catalog.matchAll(/catalogRouter\.use\(\s*'\/([^']+)'/g)].map((x) => x[1]!)
  for (const res of catalogRes) {
    implemented.add(`GET /catalog/${res}`)
    implemented.add(`POST /catalog/${res}`)
    implemented.add(`PATCH /catalog/${res}/{ma}`)
    implemented.add(`DELETE /catalog/${res}/{ma}`)
  }

  const methodRe =
    /(\w+Router)\.(get|post|put|patch|delete)\(\s*\n?\s*(?:'([^']+)'|"([^"]+)")/g

  for (const file of srcFiles) {
    if (file.includes('modules/catalog/index.ts')) continue
    const text = readFileSync(file, 'utf8')
    let mm: RegExpExecArray | null
    const local = new Map<string, string>()
    const exportRe = /export const (\w+Router)/g
    let em: RegExpExecArray | null
    while ((em = exportRe.exec(text))) {
      const name = em[1]!
      const mount = mounts.find((x) => x.fileHint === name)
      if (mount) local.set(name, mount.prefix)
    }
    // Một số router đặt tên không khớp fileHint (documentRouter vs documents)
    if (text.includes('export const documentRouter')) local.set('documentRouter', '/documents')
    if (text.includes('export const publicRouter')) local.set('publicRouter', '/public')
    if (text.includes('export const notificationRouter')) local.set('notificationRouter', '/notifications')
    if (text.includes('export const auditRouter')) local.set('auditRouter', '/audit-logs')
    if (text.includes('export const libraryRouter')) local.set('libraryRouter', '/library')
    if (text.includes('export const requestTypeRouter')) local.set('requestTypeRouter', '/request-types')
    if (text.includes('export const workflowRouter')) local.set('workflowRouter', '/workflows')
    if (text.includes('export const userRouter')) local.set('userRouter', '/users')
    if (text.includes('export const delegationRouter')) local.set('delegationRouter', '/delegations')
    if (text.includes('export const applicationsRouter')) local.set('applicationsRouter', '/applications')
    if (text.includes('export const approvalsRouter')) local.set('approvalsRouter', '/approvals')
    if (text.includes('export const otpRouter')) local.set('otpRouter', '/otp')
    if (text.includes('export const authRouter')) local.set('authRouter', '/auth')

    while ((mm = methodRe.exec(text))) {
      const varName = mm[1]!
      const method = mm[2]!.toUpperCase()
      const route = mm[3] ?? mm[4] ?? '/'
      const prefix = local.get(varName)
      if (!prefix) continue
      const openPath = expressToOpenApi(prefix, route)
      implemented.add(`${method} ${openPath}`)
    }
  }

  return implemented
}

export function normalizeApiPath(p: string): string {
  let s = p.trim()
  if (s.startsWith('/api/v1')) s = s.slice('/api/v1'.length) || '/'
  s = s.replace(/\$\{[^}]+\}/g, '{p}')
  s = s.replace(/\{[^}]+\}/g, '{p}')
  s = s.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{p}')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s
}

export function opKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

export function opsMatch(methodA: string, pathA: string, methodB: string, pathB: string): boolean {
  if (methodA.toUpperCase() !== methodB.toUpperCase()) return false
  return normalizeApiPath(pathA) === normalizeApiPath(pathB)
}

export interface TestHit {
  file: string
  method: string
  path: string
  kind: 'thanhCong' | 'loiNghiepVu' | 'loiQuyen' | 'loiDuLieu' | 'todo'
}

function classifyTitle(title: string): TestHit['kind'] {
  const t = title.toLowerCase()
  if (/\b(todo|skip|chưa làm|chua lam)\b/.test(t)) return 'todo'
  if (/(401|403|forbidden|không đăng nhập|khong dang nhap|sai vai trò|sai vai tro|idor|phạm vi|pham vi)/i.test(t)) {
    return 'loiQuyen'
  }
  if (/(400|422|validation|thiếu trường|thieu truong|sai kiểu|sai kieu|quá dài|qua dai)/i.test(t)) {
    return 'loiDuLieu'
  }
  if (
    /(409|invalid_transition|already_processed|duplicate|nghiệp vụ|nghiep vu|từ chối khi|tu choi khi|otp sai|hết hạn|het han)/i.test(
      t,
    )
  ) {
    return 'loiNghiepVu'
  }
  return 'thanhCong'
}

/** Quét backend/tests để gắn thao tác OpenAPI với file và loại ca. */
export function scanTestHits(testsDir: string): TestHit[] {
  const files = walkFiles(testsDir, (f) => f.endsWith('.test.ts'))
  const hits: TestHit[] = []
  const callRe =
    /\.(get|post|put|patch|delete)\(\s*(?:`([^`]+)`|'([^']+)'|"([^"]+)")/gi
  const itRe = /\bit(?:\.(?:todo|skip))?\(\s*(['"`])([\s\S]*?)\1/g

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(testsDir, file).replace(/\\/g, '/')
    const titles: string[] = []
    let im: RegExpExecArray | null
    const itLocal = new RegExp(itRe.source, 'g')
    while ((im = itLocal.exec(text))) titles.push(im[2] ?? '')

    let cm: RegExpExecArray | null
    const callLocal = new RegExp(callRe.source, 'gi')
    while ((cm = callLocal.exec(text))) {
      const method = cm[1]!.toUpperCase()
      const raw = (cm[2] ?? cm[3] ?? cm[4] ?? '').split('?')[0] ?? ''
      if (!raw.includes('/')) continue
      const around = text.slice(Math.max(0, cm.index - 400), cm.index)
      const lastIt = [...around.matchAll(/\bit(?:\.(todo|skip))?\(\s*(['"`])([\s\S]*?)\2/g)].pop()
      const title = lastIt?.[3] ?? titles[0] ?? ''
      const kind: TestHit['kind'] = lastIt?.[1] === 'todo' || lastIt?.[1] === 'skip' ? 'todo' : classifyTitle(title)
      hits.push({ file: rel, method, path: raw, kind })
    }

    // it.todo mô tả thao tác chưa làm: "GET /chat/stream — giai đoạn sau"
    const todoRe = /\bit\.(?:todo|skip)\(\s*(['"`])([\s\S]*?)\1/g
    let tm: RegExpExecArray | null
    while ((tm = todoRe.exec(text))) {
      const title = tm[2] ?? ''
      const op = title.match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i)
      if (op) {
        hits.push({
          file: rel,
          method: op[1]!.toUpperCase(),
          path: op[2]!.replace(/[,.)].*$/, ''),
          kind: 'todo',
        })
      }
    }
  }
  return hits
}

export function readUtf(path: string): string {
  return readFileSync(path, 'utf8')
}
