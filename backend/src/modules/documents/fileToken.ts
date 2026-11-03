import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../../config/env'
import { randomToken } from '../../lib/crypto'

function secret(): Buffer {
  return Buffer.from(env.SIGNATURE_HMAC_SECRET, 'utf8')
}

export function createFileToken(documentId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + env.SIGNED_URL_TTL_MINUTES * 60
  const payload = `${documentId}.${expiresAt}.${randomToken(8)}`
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url')
  return Buffer.from(`${payload}.${signature}`).toString('base64url')
}

export function readFileToken(token: string): { documentId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const parts = decoded.split('.')
    if (parts.length !== 4) return null
    const [documentId, expiresAt, nonce, signature] = parts
    const payload = `${documentId}.${expiresAt}.${nonce}`
    const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    if (!Number.isInteger(Number(expiresAt)) || Number(expiresAt) < Math.floor(Date.now() / 1000)) {
      return null
    }
    return { documentId }
  } catch {
    return null
  }
}
