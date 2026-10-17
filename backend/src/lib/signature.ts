/**
 * Chữ ký số (Giai đoạn 4).
 *
 * Nguyên tắc:
 *  1. Nội dung được băm bằng SHA-256 trên **JSON canonical** (khoá sắp xếp tăng
 *     dần, đệ quy) nên cùng một nội dung luôn cho ra cùng một `maBam`, bất kể
 *     thứ tự khoá khi dựng đối tượng.
 *  2. Chữ ký nằm trên chính giá trị băm đó (`maChuKy`). Sửa nội dung sau khi ký
 *     ⇒ `maBam` tính lại khác `maBam` đã lưu ⇒ xác thực thất bại.
 *  3. Nhà cung cấp chọn qua `SIGNATURE_PROVIDER`; mỗi bản ghi lưu lại tên nhà
 *     cung cấp để xác thực đúng về sau (kể cả khi đổi cấu hình).
 *  4. Có sẵn lớp rỗng `EXTERNAL_CA` cho nhà cung cấp CA ngoài (Giai đoạn sau):
 *     ký thì từ chối, xác thực luôn trả về `false` — không bao giờ báo hợp lệ sai.
 */
import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  type KeyObject,
} from 'node:crypto'
import { env } from '../config/env'
import { AppError } from './errors'
import { safeEqual, sha256 } from './crypto'

export const SIGNATURE_PROVIDER_NAMES = ['INTERNAL_HMAC', 'RSA_SHA256', 'EXTERNAL_CA'] as const
export type SignatureProviderName = (typeof SIGNATURE_PROVIDER_NAMES)[number]

/* ------------------------------------------------------------------ *
 * 1. JSON canonical + băm nội dung
 * ------------------------------------------------------------------ */

/**
 * Chuỗi hoá JSON theo khoá sắp xếp tăng dần (đệ quy). Mảng giữ nguyên thứ tự
 * (thứ tự mảng là dữ liệu), `undefined` bị bỏ qua như `JSON.stringify`.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** `content_hash`: SHA-256 của JSON canonical. */
export function contentHash(value: unknown): string {
  return sha256(canonicalJson(value))
}

/* ------------------------------------------------------------------ *
 * 2. Nội dung đưa vào chữ ký
 * ------------------------------------------------------------------ */

/** Nội dung được ký cho một bước duyệt (hoặc cho văn bản đã cấp). */
export interface SignaturePayloadInput {
  maHoSo: string
  buocOrder: number
  tenBuoc: string
  nguoiKyId: string
  vaiTro: string
  phuongThuc: string
  /** ISO-8601 — lưu mili-giây nên khứ hồi qua CSDL không đổi giá trị. */
  thoiDiemKy: string
  /** Băm nội dung hồ sơ tại thời điểm ký. */
  noiDungBam: string
}

/** Dựng payload từ trạng thái HIỆN TẠI của hồ sơ (dùng cho cả ký và xác thực). */
export function signaturePayloadOf(
  app: { maHoSo: string; duLieu: unknown },
  sig: {
    buocOrder: number
    tenBuoc: string
    nguoiKyId: string
    vaiTro: string
    phuongThuc: string
    thoiDiemKy: Date
  },
): SignaturePayloadInput {
  return {
    maHoSo: app.maHoSo,
    buocOrder: sig.buocOrder,
    tenBuoc: sig.tenBuoc,
    nguoiKyId: sig.nguoiKyId,
    vaiTro: sig.vaiTro,
    phuongThuc: sig.phuongThuc,
    thoiDiemKy: sig.thoiDiemKy.toISOString(),
    noiDungBam: contentHash(app.duLieu ?? {}),
  }
}

/** `maBam` = băm của payload canonical. */
export function payloadHash(payload: SignaturePayloadInput): string {
  return contentHash(payload)
}

/* ------------------------------------------------------------------ *
 * 3. Nhà cung cấp chữ ký
 * ------------------------------------------------------------------ */

export interface SignatureProvider {
  readonly ten: SignatureProviderName
  /** Ký một giá trị băm, trả về chuỗi chữ ký (hex với HMAC, base64 với RSA). */
  ky(maBam: string): string
  xacThuc(maBam: string, maChuKy: string): boolean
}

class InternalHmacProvider implements SignatureProvider {
  readonly ten = 'INTERNAL_HMAC' as const

  constructor(private readonly secret: string) {}

  ky(maBam: string): string {
    return createHmac('sha256', this.secret).update(maBam, 'utf8').digest('hex')
  }

  xacThuc(maBam: string, maChuKy: string): boolean {
    return safeEqual(this.ky(maBam), maChuKy)
  }
}

class RsaSha256Provider implements SignatureProvider {
  readonly ten = 'RSA_SHA256' as const

  constructor(
    private readonly privateKey: KeyObject | null,
    private readonly publicKey: KeyObject | null,
  ) {}

  ky(maBam: string): string {
    if (!this.privateKey) {
      throw new AppError(
        'UNKNOWN',
        'Chưa cấu hình khoá riêng RSA (SIGNATURE_RSA_PRIVATE_KEY) để ký văn bản.',
        undefined,
        503,
      )
    }
    return createSign('RSA-SHA256').update(maBam, 'utf8').sign(this.privateKey).toString('base64')
  }

  xacThuc(maBam: string, maChuKy: string): boolean {
    if (!this.publicKey) return false
    try {
      return createVerify('RSA-SHA256')
        .update(maBam, 'utf8')
        .verify(this.publicKey, Buffer.from(maChuKy, 'base64'))
    } catch {
      return false
    }
  }
}

/**
 * Lớp rỗng cho CA ngoài: chưa cấu hình nên KHÔNG ký được, và xác thực luôn
 * trả về `false` (thà báo không hợp lệ còn hơn báo hợp lệ sai).
 */
class ExternalCaProvider implements SignatureProvider {
  readonly ten = 'EXTERNAL_CA' as const

  ky(): string {
    throw new AppError(
      'UNKNOWN',
      'Chưa cấu hình nhà cung cấp CA ngoài — không thể ký bằng EXTERNAL_CA.',
      undefined,
      503,
    )
  }

  xacThuc(): boolean {
    return false
  }
}

/** Biến môi trường có thể chứa `\n` dạng ký tự (thường gặp khi nhúng PEM vào 1 dòng). */
function pem(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value
}

function buildProvider(name: SignatureProviderName): SignatureProvider {
  if (name === 'RSA_SHA256') {
    const priv = env.SIGNATURE_RSA_PRIVATE_KEY
    const pub = env.SIGNATURE_RSA_PUBLIC_KEY
    let privateKey: KeyObject | null = null
    let publicKey: KeyObject | null = null
    try {
      if (priv) privateKey = createPrivateKey(pem(priv))
      if (pub) publicKey = createPublicKey(pem(pub))
      else if (privateKey) publicKey = createPublicKey(privateKey)
    } catch (e) {
      throw new AppError(
        'UNKNOWN',
        'Khoá RSA trong cấu hình không đọc được (SIGNATURE_RSA_PRIVATE_KEY / SIGNATURE_RSA_PUBLIC_KEY).',
        { nguyenNhan: (e as Error).message },
        503,
      )
    }
    return new RsaSha256Provider(privateKey, publicKey)
  }
  if (name === 'EXTERNAL_CA') return new ExternalCaProvider()
  return new InternalHmacProvider(env.SIGNATURE_HMAC_SECRET)
}

const cache = new Map<SignatureProviderName, SignatureProvider>()

/** Nhà cung cấp theo tên (có nhớ đệm). */
export function signatureProviderFor(name: SignatureProviderName): SignatureProvider {
  const hit = cache.get(name)
  if (hit) return hit
  const built = buildProvider(name)
  cache.set(name, built)
  return built
}

/** Nhà cung cấp đang cấu hình — dùng khi KÝ. */
export function getSignatureProvider(): SignatureProvider {
  return signatureProviderFor(env.SIGNATURE_PROVIDER)
}

/** Nhà cung cấp theo tên đã lưu — dùng khi XÁC THỰC; `null` nếu bản ghi cũ. */
export function providerForVerification(name: string | null | undefined): SignatureProvider | null {
  if (!name) return null
  if (!(SIGNATURE_PROVIDER_NAMES as readonly string[]).includes(name)) return null
  return signatureProviderFor(name as SignatureProviderName)
}

/* ------------------------------------------------------------------ *
 * 4. Xác thực
 * ------------------------------------------------------------------ */

export interface SignatureRecord {
  provider: string | null
  maBam: string
  maChuKy: string
  /** Payload tính lại từ trạng thái HIỆN TẠI của hồ sơ. */
  payload: SignaturePayloadInput
}

export interface VerifyResult {
  /** `true` hợp lệ, `false` không hợp lệ, `null` không kiểm chứng được (bản ghi cũ). */
  hopLe: boolean | null
  lyDo: string | null
}

/**
 * Xác thực một chữ ký đã lưu:
 *  - băm lại nội dung hiện tại: khác `maBam` ⇒ nội dung đã đổi sau khi ký;
 *  - kiểm tra chữ ký trên giá trị băm bằng đúng nhà cung cấp đã ký.
 */
export function verifySignature(rec: SignatureRecord): VerifyResult {
  const provider = providerForVerification(rec.provider)
  if (!provider) {
    return {
      hopLe: null,
      lyDo: 'Bản ghi ký trước Giai đoạn 4 — không có thông tin nhà cung cấp để kiểm chứng.',
    }
  }
  const tinhLai = payloadHash(rec.payload)
  if (tinhLai !== rec.maBam) {
    return { hopLe: false, lyDo: 'Nội dung đã thay đổi sau khi ký.' }
  }
  if (!provider.xacThuc(rec.maBam, rec.maChuKy)) {
    return { hopLe: false, lyDo: 'Chữ ký không khớp với khoá của nhà cung cấp.' }
  }
  return { hopLe: true, lyDo: null }
}
