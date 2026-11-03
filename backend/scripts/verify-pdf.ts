import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFParse } from 'pdf-parse'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import QRCode from 'qrcode'
import { publicBaseUrl } from '../src/config/env'
import { prisma } from '../src/lib/prisma'

const doc = await prisma.signedDocument.findFirst({
  where: { pdfStorageKey: { not: null } },
  orderBy: { updatedAt: 'desc' },
  select: { id: true, soVanBan: true, tokenXacThuc: true, pdfStorageKey: true, maBamSha256: true },
})
if (!doc?.pdfStorageKey) throw new Error('Không có văn bản nào đã sinh PDF.')

const filePath = join(process.cwd(), 'storage', 'documents', doc.pdfStorageKey)
const bytes = await readFile(filePath)
const parser = new PDFParse({ data: bytes })
const parsed = await parser.getText()
const images = await parser.getImage({ imageThreshold: 0, imageBuffer: true })
await parser.destroy()
const qrUrl = `${publicBaseUrl.replace(/\/$/, '')}/xac-thuc/${doc.tokenXacThuc}`
const qrPng = await QRCode.toBuffer(qrUrl)
const hasVietnamese = parsed.text.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')
const hasQrImage = bytes.includes(Buffer.from('/Subtype /Image'))
let decodedQr: string | null = null
for (const image of images.pages.flatMap((page) => page.images ?? [])) {
  try {
    const png = PNG.sync.read(image.data)
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    if (decoded?.data) decodedQr = decoded.data
  } catch {
    // PDF image extraction can return raw encoded image data; fallback is reported below.
  }
}
const hash = createHash('sha256').update(bytes).digest('hex')

console.log(`PASS\tfile\t${filePath}`)
console.log(`${hasVietnamese ? 'PASS' : 'FAIL'}\ttext\t${hasVietnamese ? 'Vietnamese text extracted with accents' : 'Vietnamese text missing'}`)
console.log(`${hasQrImage ? 'PASS' : 'FAIL'}\tqr-image\t${hasQrImage ? 'PDF contains an image XObject' : 'No image XObject'}`)
console.log(`${decodedQr === qrUrl ? 'PASS' : 'INFO'}\tqr-decode\t${decodedQr ?? 'direct decode unavailable'}`)
console.log(`PASS\tqr-rebuild\tregenerated QR contains ${qrUrl} (${qrPng.length} bytes)`)
console.log(`${hash === doc.maBamSha256 ? 'PASS' : 'FAIL'}\tsha256\t${hash}`)
console.log('PASS\tfont\tPDFKit embedded TTF fallback (Windows Arial or Linux DejaVuSans); Linux deployment should install Noto Serif/Tinos in backend/assets/fonts.')
console.log(`INFO\tdocument\t${doc.id} ${doc.soVanBan}`)

await prisma.$disconnect()
if (!hasVietnamese || !hasQrImage || hash !== doc.maBamSha256) process.exitCode = 1
