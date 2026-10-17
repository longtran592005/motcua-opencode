import type { Prisma } from '@prisma/client'
import { AppError } from '../../lib/errors'
import { randomOtp, safeEqual, sha256 } from '../../lib/crypto'
import { prisma } from '../../lib/prisma'
import { sendOtp } from './channel'

const OTP_TTL_MS = 5 * 60_000
const RESEND_COOLDOWN_MS = 30_000
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60_000

/**
 * Dữ liệu trả về cho client. KHÔNG bao giờ chứa mã OTP (kể cả khi phát triển):
 * mã chỉ đi qua `NotificationChannel` (xem `channel.ts`).
 */
export interface OtpChallengeView {
  challengeId: string
  hetHanLuc: string
  conLaiGiay: number
  choGuiLaiGiay: number
  soLanConLai: number
  khoaDenLuc?: string
}

type Challenge = {
  id: string
  hetHanLuc: Date
  lastSentAt: Date
  soLanConLai: number
  khoaDenLuc: Date | null
}

export function toView(c: Challenge): OtpChallengeView {
  const now = Date.now()
  return {
    challengeId: c.id,
    hetHanLuc: c.hetHanLuc.toISOString(),
    conLaiGiay: Math.max(0, Math.round((c.hetHanLuc.getTime() - now) / 1000)),
    choGuiLaiGiay: Math.max(0, Math.ceil((c.lastSentAt.getTime() + RESEND_COOLDOWN_MS - now) / 1000)),
    soLanConLai: c.soLanConLai,
    ...(c.khoaDenLuc && c.khoaDenLuc.getTime() > now
      ? { khoaDenLuc: c.khoaDenLuc.toISOString() }
      : {}),
  }
}

const CHALLENGE_SELECT = {
  id: true,
  hetHanLuc: true,
  lastSentAt: true,
  soLanConLai: true,
  khoaDenLuc: true,
} as const

async function contactOf(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { hoTen: true, email: true, soDienThoai: true },
  })
  return {
    hoTen: u?.hoTen ?? 'Người dùng',
    email: u?.email ?? null,
    soDienThoai: u?.soDienThoai ?? null,
  }
}

/**
 * Tạo phiên OTP mới cho một hồ sơ/bước rồi gửi qua kênh đang cấu hình.
 * CHỈ lưu băm của mã; mã thô chỉ tồn tại trong bộ nhớ của tiến trình gửi.
 */
export async function createChallenge(params: {
  userId: string
  applicationId: string
  stepOrder: number
  maHoSo: string
}): Promise<OtpChallengeView> {
  const otp = randomOtp()
  const now = new Date()

  // Vô hiệu hoá các phiên OTP còn hiệu lực trước đó của cùng người dùng/hồ sơ/bước.
  await prisma.otpChallenge.updateMany({
    where: {
      userId: params.userId,
      applicationId: params.applicationId,
      stepOrder: params.stepOrder,
      daDung: false,
    },
    data: { daDung: true },
  })

  const created = await prisma.otpChallenge.create({
    data: {
      userId: params.userId,
      applicationId: params.applicationId,
      stepOrder: params.stepOrder,
      otpHash: sha256(otp),
      hetHanLuc: new Date(now.getTime() + OTP_TTL_MS),
      soLanThu: 0,
      soLanConLai: MAX_ATTEMPTS,
      lastSentAt: now,
    },
    select: CHALLENGE_SELECT,
  })

  try {
    await sendOtp({
      challengeId: created.id,
      otp,
      maHoSo: params.maHoSo,
      stepOrder: params.stepOrder,
      hetHanLuc: created.hetHanLuc,
      to: { id: params.userId, ...(await contactOf(params.userId)) },
    })
  } catch (e) {
    // Không gửi được (chưa cấu hình kênh thật) → vô hiệu hoá phiên vừa tạo để
    // không tồn tại một mã hợp lệ mà người dùng chưa từng nhận được.
    await prisma.otpChallenge.update({ where: { id: created.id }, data: { daDung: true } })
    throw e
  }

  return toView(created)
}

export async function statusChallenge(challengeId: string, userId: string): Promise<OtpChallengeView> {
  const c = await prisma.otpChallenge.findUnique({ where: { id: challengeId } })
  if (!c) throw AppError.notFound('Không tìm thấy phiên OTP.')
  if (c.userId !== userId) throw AppError.forbidden('Phiên OTP không thuộc về bạn.')
  return toView(c)
}

export async function resendChallenge(challengeId: string, userId: string): Promise<OtpChallengeView> {
  const c = await prisma.otpChallenge.findUnique({
    where: { id: challengeId },
    include: { application: { select: { maHoSo: true } } },
  })
  if (!c) throw AppError.notFound('Không tìm thấy phiên OTP.')
  if (c.userId !== userId) throw AppError.forbidden('Phiên OTP không thuộc về bạn.')

  const now = Date.now()
  if (c.lastSentAt.getTime() + RESEND_COOLDOWN_MS > now) {
    throw AppError.validation('Vui lòng chờ 30 giây trước khi gửi lại mã OTP.')
  }

  const otp = randomOtp()
  const updated = await prisma.otpChallenge.update({
    where: { id: c.id },
    data: {
      otpHash: sha256(otp),
      hetHanLuc: new Date(now + OTP_TTL_MS),
      lastSentAt: new Date(now),
      soLanThu: 0,
      soLanConLai: MAX_ATTEMPTS,
      khoaDenLuc: null,
      daDung: false,
    },
    select: CHALLENGE_SELECT,
  })

  await sendOtp({
    challengeId: updated.id,
    otp,
    maHoSo: c.application.maHoSo,
    stepOrder: c.stepOrder,
    hetHanLuc: updated.hetHanLuc,
    to: { id: userId, ...(await contactOf(userId)) },
  })

  return toView(updated)
}

/**
 * Ghi nhận một lượt nhập SAI bằng phép tăng nguyên tử (`increment`/`decrement`)
 * trên kết nối RIÊNG, ngoài transaction phê duyệt — nhờ vậy lỗi OTP_INVALID làm
 * rollback giao dịch vẫn không xoá mất bộ đếm, và nhiều yêu cầu song song không
 * ghi đè lẫn nhau (không "mất lượt"). Đủ 5 lượt sai thì khoá 15 phút.
 */
async function ghiNhanNhapSai(challengeId: string): Promise<{
  soLanConLai: number
  khoaDenLuc: Date | null
  daDung: boolean
}> {
  await prisma.otpChallenge.updateMany({
    where: { id: challengeId, daDung: false, khoaDenLuc: null, soLanConLai: { gt: 0 } },
    data: { soLanThu: { increment: 1 }, soLanConLai: { decrement: 1 } },
  })

  const fresh = await prisma.otpChallenge.findUnique({
    where: { id: challengeId },
    select: { soLanConLai: true, khoaDenLuc: true, daDung: true },
  })
  if (!fresh) throw new AppError('OTP_INVALID', 'Mã OTP không đúng.')

  if (fresh.soLanConLai <= 0 && !fresh.khoaDenLuc && !fresh.daDung) {
    const locked = await prisma.otpChallenge.update({
      where: { id: challengeId },
      data: { khoaDenLuc: new Date(Date.now() + LOCK_MS) },
      select: { khoaDenLuc: true },
    })
    return { soLanConLai: 0, khoaDenLuc: locked.khoaDenLuc, daDung: false }
  }

  return { soLanConLai: fresh.soLanConLai, khoaDenLuc: fresh.khoaDenLuc, daDung: fresh.daDung }
}

/**
 * Kiểm tra mã OTP rồi đánh dấu đã dùng. Dùng trong giao dịch phê duyệt.
 * Sai mã: OTP_INVALID (400); hết hạn: OTP_EXPIRED (410); quá số lần: OTP_LOCKED (423).
 */
export async function consumeOtp(
  tx: Prisma.TransactionClient,
  params: { challengeId: string; otp: string; userId: string; applicationId: string; stepOrder: number },
): Promise<void> {
  const c = await tx.otpChallenge.findUnique({ where: { id: params.challengeId } })
  if (!c) throw new AppError('OTP_INVALID', 'Mã OTP không đúng.')
  if (c.userId !== params.userId) throw AppError.forbidden('Phiên OTP không thuộc về bạn.')
  if (c.applicationId !== params.applicationId || c.stepOrder !== params.stepOrder) {
    throw new AppError('OTP_INVALID', 'Mã OTP không áp dụng cho hồ sơ hoặc bước xử lý này.')
  }

  const now = new Date()
  if (c.daDung) {
    throw new AppError('ALREADY_PROCESSED', 'Mã OTP này đã được sử dụng.')
  }
  if (c.khoaDenLuc && c.khoaDenLuc.getTime() > now.getTime()) {
    throw new AppError('OTP_LOCKED', 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau.', {
      khoaDenLuc: c.khoaDenLuc.toISOString(),
    })
  }
  if (c.khoaDenLuc) {
    // Đã hết thời gian khoá → mở lại và cho thử tiếp.
    await prisma.otpChallenge.update({
      where: { id: c.id },
      data: { khoaDenLuc: null, soLanConLai: MAX_ATTEMPTS, soLanThu: 0 },
    })
  }
  if (c.hetHanLuc.getTime() < now.getTime()) {
    throw new AppError('OTP_EXPIRED', 'Mã OTP đã hết hiệu lực. Vui lòng gửi lại mã mới.')
  }

  if (!safeEqual(c.otpHash, sha256(params.otp))) {
    const state = await ghiNhanNhapSai(c.id)
    if (state.daDung) {
      throw new AppError('ALREADY_PROCESSED', 'Mã OTP này đã được sử dụng.')
    }
    if (state.khoaDenLuc && state.khoaDenLuc.getTime() > now.getTime()) {
      throw new AppError(
        'OTP_LOCKED',
        'Bạn đã nhập sai quá nhiều lần. Phiên OTP bị tạm khoá 15 phút.',
        { khoaDenLuc: state.khoaDenLuc.toISOString() },
      )
    }
    throw new AppError('OTP_INVALID', 'Mã OTP không đúng.', { soLanConLai: state.soLanConLai })
  }

  await tx.otpChallenge.update({ where: { id: c.id }, data: { daDung: true } })
}

export const OTP_LIMITS = { MAX_ATTEMPTS, LOCK_MS, OTP_TTL_MS, RESEND_COOLDOWN_MS }
