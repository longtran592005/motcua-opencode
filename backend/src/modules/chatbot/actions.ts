/**
 * Hành động trả về cho giao diện (3.3): ĐỀU do server dựng từ dữ liệu thật
 * (Q8) — không lấy từ chữ của mô hình. Lưu trong chat_messages.hanh_dong
 * (jsonb) kèm id, hạn 24 giờ, cờ "đã dùng" (idempotent confirm).
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma'

const TTL_MS = 24 * 60 * 60 * 1000

export type ActionKind = 'OPEN_FORM' | 'DOWNLOAD_FORM' | 'OPEN_APPLICATION' | 'DRAFT_PROPOSAL' | 'OFFER_HANDOFF'

export interface ChatAction {
  id: string
  kieu: ActionKind
  expiresAt: string
  daDung?: boolean
  ten?: string
  maLoiDon?: string
  tenLoaiDon?: string
  duongDan?: string
  maHoSo?: string
  cacTruong?: Array<{ ten: string; nhan: string; giaTriGoiY: string; batBuoc?: boolean }>
  canhBao?: string[]
}

/** Tạo hành động mới (server dựng, luôn kèm id + hạn). */
export function makeAction(a: Omit<ChatAction, 'id' | 'expiresAt'>): ChatAction {
  return { id: randomUUID(), expiresAt: new Date(Date.now() + TTL_MS).toISOString(), ...a }
}

/** Tìm hành động của chính người dùng (chống IDOR: người khác → null). */
export async function findActionForUser(userId: string, actionId: string): Promise<ChatAction | null> {
  if (!/^[0-9a-f-]{36}$/i.test(actionId)) return null
  const rows = await prisma.$queryRaw<{ id: string; hanh_dong: unknown }[]>`
    SELECT id, hanh_dong FROM chat_messages
    WHERE nguoi_dung_id = ${userId}::uuid
      AND vai_tro = 'ASSISTANT'
      AND hanh_dong @> ${JSON.stringify([{ id: actionId }])}::jsonb
    LIMIT 1`
  const row = rows[0]
  if (!row || !Array.isArray(row.hanh_dong)) return null
  const list = row.hanh_dong as ChatAction[]
  return list.find((a) => a.id === actionId) ?? null
}

/** Đánh dấu hành động đã dùng (cập nhật lại jsonb của tin nhắn chứa nó). */
export async function markActionUsed(userId: string, actionId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE chat_messages
    SET hanh_dong = (
      SELECT COALESCE(jsonb_agg(
        CASE WHEN item->>'id' = ${actionId} THEN jsonb_set(item, '{daDung}', 'true'::jsonb) ELSE item END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(hanh_dong) AS item)
    WHERE nguoi_dung_id = ${userId}::uuid
      AND hanh_dong @> ${JSON.stringify([{ id: actionId }])}::jsonb`
}
