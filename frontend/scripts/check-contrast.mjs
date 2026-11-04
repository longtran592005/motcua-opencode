/**
 * check-contrast.mjs — tính tỷ lệ tương phản WCAG cho các cặp chữ-nền chính,
 * đọc token từ frontend/src/index.css (cả :root và .dark). Không cần trình duyệt.
 * Chuẩn: chữ thường ≥ 4.5; chữ lớn (≥24px hoặc ≥19px đậm) ≥ 3; viền/UI ≥ 3.
 * Dùng: node scripts/check-contrast.mjs customer
 */
import fs from 'node:fs'
import path from 'node:path'

const cssPath = path.resolve(import.meta.dirname, '..', 'src', 'index.css')
const css = fs.readFileSync(cssPath, 'utf8')
const LABEL = process.argv[2] ?? 'HIỆN TẠI'

function parseBlock(name) {
  const start = css.indexOf(`${name} {`)
  if (start < 0) return null
  const end = css.indexOf('}', start)
  const body = css.slice(start, end)
  const vars = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([0-9.]+ [0-9.]+% [0-9.]+%)/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

const light = parseBlock(':root')
const dark = parseBlock('.dark')

function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function tokenToRgb(value) {
  if (!value) return null
  const m = value.trim().match(/^([0-9.]+) ([0-9.]+)% ([0-9.]+)%$/)
  if (m) return hslToRgb(+m[1], +m[2], +m[3])
  return null
}

/** Nhân alpha: fg là màu有 alpha (0..1) phủ lên bg. */
function compose(fg, alpha, bg) {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))
}

function luminance(rgb) {
  const lin = rgb.map((v) => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function ratio(fg, bg) {
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
}

const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()

/**
 * Cặp màu. fg/bg: "token:ten" | "hex:#RRGGBB" | "alpha:ten:0.xx" (fg alpha phủ bg).
 * Vampire: "PHỤ" cặp phụ; ui: chỉ cần ≥3.
 */
const PAIRS = [
  { label: 'Chữ chính trên nền trang', fg: 'token:foreground', bg: 'token:background' },
  { label: 'Chữ chính trên thẻ', fg: 'token:card-foreground', bg: 'token:card' },
  { label: 'Chữ phụ (muted) trên trang', fg: 'token:muted-foreground', bg: 'token:background' },
  { label: 'Chữ phụ (muted) trên thẻ', fg: 'token:muted-foreground', bg: 'token:card' },
  { label: 'Viền trên thẻ (UI)', fg: 'token:border', bg: 'token:card', ui: true },
  { label: 'Chữ trên nút chính', fg: 'token:primary-foreground', bg: 'token:primary' },
  { label: 'Nút nút chính trên thẻ (link/icon)', fg: 'token:primary', bg: 'token:card' },
  { label: 'Chữ trên nút phụ', fg: 'token:secondary-foreground', bg: 'token:secondary' },
  { label: 'Tiêu đề trên trang', fg: 'token:brand-heading', bg: 'token:background' },
  { label: 'Tiêu đề trên thẻ', fg: 'token:brand-heading', bg: 'token:card' },
  { label: 'Topbar: chữ trên nền thanh trên', fg: 'token:topbar-foreground', bg: 'token:topbar' },
  { label: 'Hero: tiêu đề trên nền hero', fg: 'token:hero-foreground', bg: 'token:hero' },
  { label: 'Hero: nổi bật mềm trên hero', fg: 'token:hero-muted', bg: 'token:hero' },
  { label: 'Hero: chữ trong thẻ tính năng', fg: 'token:hero-card-foreground', bg: 'token:hero-card' },
  { label: 'Trạng thái: hoàn thành', fg: 'token:status-completed', bg: 'token:status-completed-soft' },
  { label: 'Trạng thái: chờ duyệt / cảnh báo', fg: 'token:status-pending', bg: 'token:status-pending-soft' },
  { label: 'Trạng thái: bị trả về', fg: 'token:status-rejected', bg: 'token:status-rejected-soft' },
  { label: 'Trạng thái: đang xử lý (info)', fg: 'token:status-submitted', bg: 'token:status-submitted-soft' },
]

function resolve(t, vars) {
  const m = /^([^:]+)(?::(.+))?$/.exec(t)
  const [kind, arg] = [t.split(':')[0], t.split(':').slice(1).join(':')]
  void m
  if (kind === 'token') {
    const rgb = tokenToRgb(vars[arg])
    if (!rgb) throw new Error(`token thiếu/không đọc được: --${arg}`)
    return rgb
  }
  if (kind === 'hex') {
    const h = arg.replace('#', '')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  if (kind === 'alpha') return null
  throw new Error('định dạng ' + t)
}

function run(vars, mode) {
  const rows = []
  for (const p of PAIRS) {
    let fg, bg, note = ''
    try {
      if (p.fg.startsWith('alpha:')) {
        const [, tok, a] = p.fg.split(':')
        fg = compose(resolve('token:' + tok, vars), +a, resolve(p.bg, vars))
        note = ' (fg alpha ' + Math.round(+a * 100) + '% đã cộng lên nền)'
      } else {
        fg = resolve(p.fg, vars)
        bg = resolve(p.bg, vars)
      }
    } catch (e) {
      rows.push({ label: p.label, ratio: null, pass: false, note: 'THIẾU TOKEN: ' + e.message.replace('token thiếu/không đọc được: --', 'token --') })
      continue
    }
    const r = ratio(fg, bg)
    const need = p.ui ? 3 : 4.5
    rows.push({ label: p.label, ratio: +r.toFixed(2), pass: r >= need, need, fg: rgbToHex(fg), bg: rgbToHex(bg), note })
  }
  return { mode, rows }
}

const fHex = (t, vars) => resolve(t, vars)

// Cặp hiện trạng TRƯỚC sửa (hard-code trong component, Không qua token):
const HARDCODED = [
  { label: 'Hero TRƯỚC: h1 màu heading trên nền heading (chỉ sáng)', getPair: () => { const bg = fHex('token:brand-heading', light); return [bg, bg] }, lightOnly: true },
  { label: 'Hero TRƯỚC: chữ trắng trên bg brand-heading (như Component đang làm)', getPair: (v) => [fHex('hex:#FFFFFF', v), fHex('token:brand-heading', v)] },
  { label: 'Hero TRƯỚC: chữ trắng 75-80% alpha trên bg brand-heading', getPair: (v) => [compose(fHex('hex:#FFFFFF', v), 0.78, fHex('token:brand-heading', v)), fHex('token:brand-heading', v)] },
  { label: 'Footer TRƯỚC: chữ trắng 60-85% alpha trên bg brand-heading', getPair: (v) => [compose(fHex('hex:#FFFFFF', v), 0.7, fHex('token:brand-heading', v)), fHex('token:brand-heading', v)] },
]

function runHardcoded(vars, mode) {
  return HARDCODED.filter((h) => !(h.lightOnly && mode === 'dark')).map((h) => {
    const [fg, bg] = h.getPair(vars)
    const r = ratio(fg, bg)
    return { label: h.label, ratio: +r.toFixed(2), pass: r >= 4.5, need: 4.5, fg: rgbToHex(fg), bg: rgbToHex(bg), note: ' (hard-code hiện trạng)' }
  })
}

const before = { light: run(light, 'light'), dark: run(dark, 'dark') }
before.light.rows.push(...runHardcoded(light, 'light'))
before.dark.rows.push(...runHardcoded(dark, 'dark'))

function print(title, res) {
  console.log(`\n== ${title} (${res.mode}) ==`)
  for (const row of res.rows) {
    const ks = row.ratio == null ? '—' : row.ratio.toFixed(2)
    const need = row.need ? ` (cần ≥${row.need})` : ''
    const fgBg = row.fg && row.bg ? `  [#${'—'}] ${row.fg} trên ${row.bg}` : ''
    console.log(`${row.pass ? 'ĐẠT ' : 'KHÔNG'} | ${ks}${need} | ${row.label}${fgBg}${row.note || ''}`)
  }
  return res.rows.some((r) => !r.pass)
}

const beforeFail = [print(`${LABEL}`, before.light), print(`${LABEL}`, before.dark)].some(Boolean)
if (!beforeFail) process.exit(0)
process.exit(1)
