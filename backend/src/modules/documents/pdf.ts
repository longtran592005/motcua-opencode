import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { env } from '../../config/env'
import { randomToken } from '../../lib/crypto'

const storageRoot = join(process.cwd(), 'storage', 'documents')

function findFont(): string | null {
  const candidates = [
    join(process.cwd(), 'assets', 'fonts', 'NotoSerif-Regular.ttf'),
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ]
  return candidates.find((candidate) => {
    return existsSync(candidate)
  }) ?? null
}

function asBuffer(pdf: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdf.once('end', () => resolve(Buffer.concat(chunks)))
    pdf.once('error', reject)
    pdf.end()
  })
}

export interface PdfSignature {
  hoTen: string
  chucVu: string | null
  thoiDiemKy: Date
  phuongThuc: string
}

export interface PdfDocumentInput {
  soVanBan: string
  trichYeu: string
  noiDung: string
  tokenXacThuc: string
  signatures: PdfSignature[]
}

export interface GeneratedPdf {
  storageKey: string
  sha256: string
}

/** Sinh PDF thật, nhúng font Unicode nếu máy có font phù hợp và chèn QR xác thực. */
export async function generatePdf(input: PdfDocumentInput): Promise<GeneratedPdf> {
  const qrUrl = `${env.PUBLIC_DOMAIN.replace(/\/$/, '')}/xac-thuc/${input.tokenXacThuc}`
  const qr = await QRCode.toBuffer(qrUrl, { errorCorrectionLevel: 'M', width: 150, margin: 1 })
  const pdf = new PDFDocument({ size: 'A4', margin: 56 })
  const font = findFont()
  if (font) pdf.font(font)

  pdf.fontSize(13).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' })
  pdf.fontSize(12).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' })
  pdf.moveDown()
  pdf.fontSize(14).text('VĂN BẢN ĐIỆN TỬ', { align: 'center' })
  pdf.fontSize(11).text(`Số: ${input.soVanBan}`, { align: 'center' })
  pdf.moveDown()
  pdf.fontSize(12).text(input.trichYeu, { align: 'center' })
  pdf.moveDown()
  pdf.fontSize(11).text(input.noiDung, { lineGap: 4 })
  pdf.moveDown()
  pdf.fontSize(11).text('Thông tin ký số', { underline: true })
  for (const signature of input.signatures) {
    pdf.text(
      `${signature.hoTen}${signature.chucVu ? ` - ${signature.chucVu}` : ''} | ` +
        `${signature.thoiDiemKy.toLocaleString('vi-VN')} | ${signature.phuongThuc}`,
    )
  }
  pdf.image(qr, { fit: [110, 110], align: 'right' })
  pdf.fontSize(9).text(`Quét mã để xác thực: ${qrUrl}`, { align: 'right' })

  const bytes = await asBuffer(pdf)
  const storageKey = `${randomToken(16)}.pdf`
  const filePath = join(storageRoot, storageKey)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes, { flag: 'wx' })
  return {
    storageKey,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

export async function readPdf(storageKey: string): Promise<Buffer> {
  if (!/^[a-f0-9]{32}\.pdf$/i.test(storageKey)) throw new Error('Khóa lưu trữ không hợp lệ.')
  return readFile(join(storageRoot, storageKey))
}
