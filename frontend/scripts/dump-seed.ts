/**
 * Kết xuất toàn bộ dữ liệu mock của frontend ra JSON để backend seed lại.
 * Chạy (trong thư mục frontend):
 *   npx --yes tsx --tsconfig tsconfig.app.json scripts/dump-seed.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  KHOA_HOC_LIST,
  KHOA_LIST,
  LOP_LIST,
  NGANH_LIST,
  PHONG_BAN_LIST,
} from '../src/services/mock/data/org'
import { DEMO_PASSWORD, USER_LIST } from '../src/services/mock/data/users'
import { REQUEST_TYPE_LIST } from '../src/services/mock/data/requestTypes'
import { WORKFLOW_LIST } from '../src/services/mock/data/workflows'
import { TEMPLATE_LIST } from '../src/services/mock/data/templates'
import { LIBRARY_GROUPS, LIBRARY_LIST } from '../src/services/mock/data/library'
import {
  APPLICATION_LIST,
  REQUEST_TYPE_STATS,
  SIGNATURE_LIST,
} from '../src/services/mock/data/applications'
import { DOCUMENT_LIST } from '../src/services/mock/data/documents'
import { NOTIFICATION_LIST } from '../src/services/mock/data/notifications'
import { AUDIT_LOG_LIST } from '../src/services/mock/data/auditLogs'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '..', '..', 'backend', 'prisma', 'seed-data.json')

const data = {
  khoaHoc: KHOA_HOC_LIST,
  khoa: KHOA_LIST,
  phongBan: PHONG_BAN_LIST,
  nganh: NGANH_LIST,
  lop: LOP_LIST,
  users: USER_LIST,
  demoPassword: DEMO_PASSWORD,
  requestTypes: REQUEST_TYPE_LIST,
  workflows: WORKFLOW_LIST,
  templates: TEMPLATE_LIST,
  library: LIBRARY_LIST,
  libraryGroups: LIBRARY_GROUPS,
  applications: APPLICATION_LIST,
  signatures: SIGNATURE_LIST,
  documents: DOCUMENT_LIST,
  notifications: NOTIFICATION_LIST,
  auditLogs: AUDIT_LOG_LIST,
  requestTypeStats: REQUEST_TYPE_STATS,
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(data, null, 2), 'utf8')

const summary = Object.entries(data)
  .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : typeof v}`)
  .join('  ')
process.stdout.write(`seed-data.json written\n${summary}\n`)
