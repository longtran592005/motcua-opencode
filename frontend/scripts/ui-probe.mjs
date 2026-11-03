/**
 * Thu thập số liệu thật từ trình duyệt qua Chrome DevTools Protocol (không cài thêm thư viện).
 * Dùng: node scripts/ui-probe.mjs <url> <light|dark> <1280|390> [duongdan_anh]
 * In JSON: overflow, padding các Card mẫu, khoảng cách icon/tiêu đề tới mép thẻ.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const [, , urlArg, themeArg = 'light', widthArg = '1280', shotArg = ''] = process.argv
const URL = urlArg ?? 'http://localhost:5179/'
const THEME = themeArg
const WIDTH = Number(widthArg)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'))
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] })

let ws = null
let msgId = 0
const pending = new Map()

function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
}

const raw = await new Promise((resolve, reject) => {
  let buf = ''
  chrome.stderr.on('data', (d) => {
    buf += d.toString()
    const m = buf.match(/ws:\/\/[^\s]+/)
    if (m) resolve(m[0])
  })
  setTimeout(() => reject(new Error('không thấy ws endpoint: ' + buf)), 15000)
})

ws = new WebSocket(raw)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id)
    pending.delete(data.id)
    if (data.error) reject(new Error(JSON.stringify(data.error)))
    else resolve(data.result)
  }
}
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
const { targetInfos } = await send('Target.getTargets')
const page = targetInfos.find((t) => t.type === 'page' && !t.attached)
const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })

await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: Math.round(WIDTH * 1.6),
  deviceScaleFactor: 1,
  mobile: WIDTH < 500,
}, sessionId)
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-color-scheme', value: THEME }],
}, sessionId)
await send('Page.enable', {}, sessionId)
await send('Page.navigate', { url: URL }, sessionId)
await new Promise((r) => setTimeout(r, 700))
await send('Runtime.evaluate', {
  expression: `localStorage.setItem('motcua.theme', ${JSON.stringify(THEME)}); location.reload()`,
}, sessionId)
await new Promise((r) => setTimeout(r, 2800))

const { result } = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
  const res = {}
  res.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
  // Chỉ cân "thẻ" thật: phần tử có shadow-card.
  const cards = [...document.querySelectorAll('[class*="shadow-card"]')]
  res.cardCount = cards.length
  res.cards = cards.slice(0, 10).map((card) => {
    const content = card.querySelector(':scope > div')
    const pad = content ? getComputedStyle(content).padding : null
    const rect = card.getBoundingClientRect()
    // Phần tử nhìn thấy đầu tiên bên trong thẻ (icon svg hoặc chữ).
    const first = card.querySelector('svg, p, h1, h2, h3, button, input, li')
    const frect = first ? first.getBoundingClientRect() : null
    const heading = card.querySelector('h1, h2, h3')
    const hrect = heading ? heading.getBoundingClientRect() : null
    return {
      padContent: pad,
      iconRow: frect ? { top: +(frect.top - rect.top).toFixed(1), left: +(frect.left - rect.left).toFixed(1) } : null,
      headingRow: hrect ? { top: +(hrect.top - rect.top).toFixed(1), left: +(hrect.left - rect.left).toFixed(1) } : null,
    }
  })
  return JSON.stringify(res)
})()`,
}, sessionId)

let shotPath = ''
if (shotArg) {
  const { data: b64 } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
  fs.writeFileSync(shotArg, Buffer.from(b64, 'base64'))
  shotPath = shotArg
}
chrome.kill()
console.log(JSON.stringify({ theme: THEME, width: WIDTH, page: URL, probe: JSON.parse(result.value), screenshot: shotPath || '(không có)' }, null, 1))
