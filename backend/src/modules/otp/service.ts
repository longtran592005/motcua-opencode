import type { Prisma } from '@prisma/client'
import { AppError } from '../../lib/errors'
import { randomOtp, safeEqual, sha256 } from '../../lib/crypto'
import { isProduction } from '../../config/env'
import { prisma } from '../../lib/prisma'

const OTP_TTL_MS = 5 * 60_000
const RESEND_COOLDOWN_MS = 30_000
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60_000

export interface OtpChallengeView {
  challengeId: string
  hetHanLuc: string
  conLaiGiay: number
  choGuiLaiGiay: number
  soLanConLai: number
  khoaDenLuc?: string
  /** CHỈ có ngoài môi trường production — phục vụ kiểm thử và trình diễn. */
  devOtp?: string
}

type Challenge = {
  id: string
  hetHanLuc: Date
  lastSentAt: Date
  soLanConLai: number
  khoaDenLuc: Date | null
  daDung: boolean
}

export function toView(c: Challenge, otp?: string): OtpChallengeView {
  const now = Date.now()
  const view: OtpChallengeView = {
    challengeId: c.id,
    hetHanLuc: c.hetHanLuc.toISOString(),
    conLaiGiay: Math.max(0, Math.round((c.hetHanLuc.getTime() - now) / 1000)),
    choGuiLaiGiay: Math.max(0, Math.ceil((c.lastSentAt.getTime() + RESEND_COOLDOWN_MS - now) / 1000)),
    soLanConLai: c.soLanConLai,
    ...(c.khoaDenLuc && c.khoaDenLuc.getTime() > now
      ? { khoaDenLuc: c.khoaDenLuc.toISOString() }
      : {}),
    ...(!isProduction && otp ? { devOtp: otp } : {}),
  }
  return view
}

/**
 * Tạo phiên OTP mới cho một hồ sơ/bước. CHỈ lưu băm của mã, không bao giờ lưu mã thô.
 * Trả về `devOtp` ngoài production để kiểm thử và trình diễn.
 */
export async function createChallenge(params: {
  userId: string
  applicationId: string
  stepOrder: number
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
    select: { id: true, hetHanLuc: true, lastSentAt: true, soLanConLai: true, khoaDenLuc: true, daDung: true },
  })

  return toView(created, otp)
}

export async function statusChallenge(challengeId: string, userId: string): Promise<OtpChallengeView> {
  const c = await prisma.otpChallenge.findUnique({ where: { id: challengeId } })
  if (!c) throw AppError.notFound('Không tìm thấy phiên OTP.')
  if (c.userId !== userId) throw AppError.forbidden('Phiên OTP không thuộc về bạn.')
  return toView(c)
}

export async function resendChallenge(challengeId: string, userId: string): Promise<OtpChallengeView> {
  const c = await prisma.otpChallenge.findUnique({ where: { id: challengeId } })
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
    select: { id: true, hetHanLuc: true, lastSentAt: true, soLanConLai: true, khoaDenLuc: true, daDung: true },
  })
  return toView(updated, otp)
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
  if (c.khoaDenLuc && c.khoaDenLuc.getTime() > now.getTime()) {
    throw new AppError('OTP_LOCKED', 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau.', {
      khoaDenLuc: c.khoaDenLuc.toISOString(),
    })
  }
  if (c.daDung) {
    throw new AppError('ALREADY_PROCESSED', 'Mã OTP này đã được sử dụng.')
  }
  if (c.hetHanLuc.getTime() < now.getTime()) {
    throw new AppError('OTP_EXPIRED', 'Mã OTP đã hết hiệu lực. Vui lòng gửi lại mã mới.')
  }

  if (!safeEqual(c.otpHash, sha256(params.otp))) {
    const conLai = c.soLanConLai - 1
    // Ghi nhận lượt nhập sai bằng kết nối riêng (ngoài transaction đang chạy):
    // nếu ghi trong transaction, lỗi OTP_INVALID sẽ làm rollback và bộ đếm
    // không bao giờ tăng → mất tác dụng chống dò mã.
    if (conLai <= 0) {
      await prisma.otpChallenge.update({
        where: { id: c.id },
        data: {
          soLanThu: c.soLanThu + 1,
          soLanConLai: 0,
          khoaDenLuc: new Date(now.getTime() + LOCK_MS),
        },
      })
      throw new AppError(
        'OTP_LOCKED',
        'Bạn đã nhập sai quá nhiều lần. Phiên OTP bị tạm khoá 15 phút.',
      )
    }
    await prisma.otpChallenge.update({
      where: { id: c.id },
      data: { soLanThu: c.soLanThu + 1, soLanConLai: conLai },
    })
    throw new AppError('OTP_INVALID', 'Mã OTP không đúng.', { soLanConLai: conLai })
  }

  await tx.otpChallenge.update({ where: { id: c.id }, data: { daDung: true } })
}
