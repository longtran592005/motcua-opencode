import { generateKeyPairSync } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { env } from '../src/config/env'
import {
  canonicalJson,
  contentHash,
  getSignatureProvider,
  payloadHash,
  providerForVerification,
  signaturePayloadOf,
  signatureProviderFor,
  verifySignature,
  type SignaturePayloadInput,
} from '../src/lib/signature'
import {
  api,
  approveCurrentStep,
  cleanupProvisioned,
  cleanupTracked,
  createDraft,
  createFlow,
  login,
  prisma,
  submit,
  twoStudents,
} from './helpers'

afterAll(async () => {
  await cleanupTracked()
  await cleanupProvisioned()
})

const payload = (ghiDe: Partial<SignaturePayloadInput> = {}): SignaturePayloadInput => ({
  maHoSo: 'MC-2026-000001',
  buocOrder: 1,
  tenBuoc: 'Cố vấn học tập duyệt',
  nguoiKyId: '11111111-1111-4111-8111-111111111111',
  vaiTro: 'CO_VAN',
  phuongThuc: 'ONE_CLICK',
  thoiDiemKy: '2026-10-16T08:00:00.000Z',
  noiDungBam: contentHash({ lyDo: 'Xin giấy xác nhận', soNgay: 3 }),
  ...ghiDe,
})

describe('JSON canonical + băm nội dung', () => {
  it('không phụ thuộc thứ tự khoá', () => {
    const a = { z: 1, a: { y: [1, 2], x: 'b' }, m: null }
    const b = { m: null, a: { x: 'b', y: [1, 2] }, z: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    expect(contentHash(a)).toBe(contentHash(b))
  })

  it('giữ nguyên thứ tự MẢNG (thứ tự mảng là dữ liệu)', () => {
    expect(contentHash({ ds: ['a', 'b'] })).not.toBe(contentHash({ ds: ['b', 'a'] }))
  })

  it('bỏ qua khoá undefined', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('nội dung khác ⇒ băm khác', () => {
    expect(contentHash({ soNgay: 3 })).not.toBe(contentHash({ soNgay: 4 }))
  })
})

describe('Nhà cung cấp chữ ký', () => {
  it('INTERNAL_HMAC ký tất định và xác thực được', () => {
    const p = signatureProviderFor('INTERNAL_HMAC')
    expect(p.ten).toBe('INTERNAL_HMAC')
    const maBam = payloadHash(payload())
    const chuKy = p.ky(maBam)
    // HMAC-SHA256 → hex 64 ký tự, tất định với cùng khoá.
    expect(chuKy).toMatch(/^[0-9a-f]{64}$/)
    expect(p.ky(maBam)).toBe(chuKy)
    expect(p.xacThuc(maBam, chuKy)).toBe(true)
    expect(p.xacThuc(contentHash({ khac: true }), chuKy)).toBe(false)
    expect(p.xacThuc(maBam, chuKy.replace(/.$/, chuKy.endsWith('0') ? '1' : '0'))).toBe(false)
  })

  it('RSA_SHA256 ký bằng khoá riêng và xác thực bằng khoá công khai', () => {
    // Sinh khoá RSA ngay trong bài kiểm thử rồi nạp vào cấu hình trước lần dùng đầu.
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    })
    env.SIGNATURE_RSA_PRIVATE_KEY = privateKey
    env.SIGNATURE_RSA_PUBLIC_KEY = publicKey

    const p = signatureProviderFor('RSA_SHA256')
    const maBam = payloadHash(payload())
    const chuKy = p.ky(maBam)
    expect(chuKy).not.toBe('')
    expect(p.xacThuc(maBam, chuKy)).toBe(true)
    expect(p.xacThuc(contentHash({ khac: true }), chuKy)).toBe(false)
    // Chữ ký hỏng ⇒ false (không ném lỗi).
    expect(p.xacThuc(maBam, 'chu-ky-khong-hop-le')).toBe(false)
  })

  it('EXTERNAL_CA là lớp rỗng: không ký được và không bao giờ báo hợp lệ', () => {
    const p = signatureProviderFor('EXTERNAL_CA')
    expect(() => p.ky('ma-bam')).toThrowError(/CA ngoài/)
    expect(p.xacThuc('ma-bam', 'chu-ky')).toBe(false)
  })

  it('nhà cung cấp đang cấu hình là INTERNAL_HMAC trong môi trường kiểm thử', () => {
    expect(getSignatureProvider().ten).toBe(env.SIGNATURE_PROVIDER)
    expect(providerForVerification(null)).toBeNull()
    expect(providerForVerification('KHONG-CO')).toBeNull()
  })
})

describe('Xác thực chữ ký đã lưu', () => {
  it('hợp lệ khi nội dung không đổi', () => {
    const p = signatureProviderFor('INTERNAL_HMAC')
    const pl = payload()
    const maBam = payloadHash(pl)
    const kq = verifySignature({
      provider: 'INTERNAL_HMAC',
      maBam,
      maChuKy: p.ky(maBam),
      payload: pl,
    })
    expect(kq.hopLe).toBe(true)
    expect(kq.lyDo).toBeNull()
  })

  it('KHÔNG hợp lệ khi nội dung bị sửa sau khi ký', () => {
    const p = signatureProviderFor('INTERNAL_HMAC')
    const pl = payload()
    const maBam = payloadHash(pl)
    const kq = verifySignature({
      provider: 'INTERNAL_HMAC',
      maBam,
      maChuKy: p.ky(maBam),
      // Cùng chữ ký nhưng nội dung hồ sơ đã đổi ⇒ băm lại khác.
      payload: payload({ noiDungBam: contentHash({ lyDo: 'Nội dung bị sửa trộm' }) }),
    })
    expect(kq.hopLe).toBe(false)
    expect(kq.lyDo).toBe('Nội dung đã thay đổi sau khi ký.')
  })

  it('bản ghi trước Giai đoạn 4 (không có nhà cung cấp) → null, không kết luận sai', () => {
    const kq = verifySignature({
      provider: null,
      maBam: 'x',
      maChuKy: 'y',
      payload: payload(),
    })
    expect(kq.hopLe).toBeNull()
  })

  it('chữ ký đúng nhưng sai khoá nhà cung cấp → không hợp lệ', () => {
    const p = signatureProviderFor('INTERNAL_HMAC')
    const pl = payload()
    const maBam = payloadHash(pl)
    const kq = verifySignature({
      provider: 'INTERNAL_HMAC',
      maBam,
      maChuKy: p.ky(maBam).replace(/^../, 'ff'),
      payload: pl,
    })
    expect(kq.hopLe).toBe(false)
    expect(kq.lyDo).toBe('Chữ ký không khớp với khoá của nhà cung cấp.')
  })
})

describe('Chữ ký trong văn bản đã cấp (kiểm chứng thật)', () => {
  it('văn bản cấp ra có chữ ký hợp lệ; sửa nội dung hồ sơ ⇒ mất hiệu lực', async () => {
    const [student] = await twoStudents()
    const session = await login(student.user.maSo)
    const { requestType } = await createFlow([{ role: 'CO_VAN', mode: 'ONE_CLICK' }])
    const draft = await createDraft(session, requestType.id)
    await submit(session, draft.maHoSo)
    expect((await approveCurrentStep(draft.maHoSo, student.userId)).status).toBe(200)

    const truoc = await api()
      .get(`/api/v1/applications/${draft.maHoSo}/document`)
      .set('Authorization', `Bearer ${session.token}`)
    expect(truoc.status).toBe(200)
    expect(truoc.body.data.chuKy.length).toBeGreaterThan(0)
    const chuKy = truoc.body.data.chuKy[0]
    expect(chuKy.provider).toBe('INTERNAL_HMAC')
    expect(chuKy.maChuKy).toMatch(/^[0-9a-f]{64}$/)
    expect(chuKy.hopLeThucTe).toBe(true)
    expect(truoc.body.data.chuKyConHieuLuc).toBe(true)

    // Sửa nội dung biểu mẫu của hồ sơ SAU khi đã ký.
    const app = await prisma.application.findUniqueOrThrow({ where: { maHoSo: draft.maHoSo } })
    const duLieuCu = app.duLieu
    await prisma.application.update({
      where: { id: app.id },
      data: { duLieu: { ...(duLieuCu as object), lyDo: 'Nội dung bị sửa sau khi ký' } },
    })

    const sau = await api()
      .get(`/api/v1/applications/${draft.maHoSo}/document`)
      .set('Authorization', `Bearer ${session.token}`)
    expect(sau.status).toBe(200)
    expect(sau.body.data.chuKy[0].hopLeThucTe).toBe(false)
    expect(sau.body.data.chuKy[0].lyDoKhongHopLe).toBe('Nội dung đã thay đổi sau khi ký.')
    expect(sau.body.data.chuKyConHieuLuc).toBe(false)

    // Trả lại nội dung gốc ⇒ chữ ký hợp lệ trở lại (bằng chứng chữ ký gắn với nội dung).
    await prisma.application.update({ where: { id: app.id }, data: { duLieu: duLieuCu as never } })
    const khoiPhuc = await api()
      .get(`/api/v1/applications/${draft.maHoSo}/document`)
      .set('Authorization', `Bearer ${session.token}`)
    expect(khoiPhuc.body.data.chuKy[0].hopLeThucTe).toBe(true)
  })
})
