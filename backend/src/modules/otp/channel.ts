/**
 * Kênh gửi OTP (Giai đoạn 4) — tạm thời, chưa có nhà cung cấp thật.
 *
 * Bất biến quan trọng: **mã OTP chỉ đi qua kênh này**. Nó KHÔNG bao giờ được
 * trả về trong response API, KHÔNG bao giờ vào log có cấu trúc (pino) và
 * KHÔNG bao giờ vào nhật ký kiểm toán.
 *
 *  - `NODE_ENV=development` → kênh CONSOLE: in mã ra console máy chủ (stdout thô,
 *    không qua pino) để lập trình viên thử tay.
 *  - `NODE_ENV=test`        → kênh CAPTURE: giữ mã trong bộ nhớ để bài kiểm thử đọc.
 *  - các môi trường khác    → nếu chưa cấu hình kênh thật (EMAIL/SMS) thì TỪ CHỐI
 *    gửi và báo lỗi cấu hình (503), thay vì âm thầm bỏ qua.
 */
import { otpChannelName } from '../../config/env'
import { AppError } from '../../lib/errors'

export interface OtpMessage {
  challengeId: string
  otp: string
  maHoSo: string
  stepOrder: number
  hetHanLuc: Date
  to: {
    id: string
    hoTen: string
    email: string | null
    soDienThoai: string | null
  }
}

export interface NotificationChannel {
  readonly ten: string
  guiOtp(msg: OtpMessage): Promise<void>
}

/* ------------------------------- CAPTURE -------------------------------- */

const capturedOtps = new Map<string, string>()

class CaptureChannel implements NotificationChannel {
  readonly ten = 'CAPTURE'

  async guiOtp(msg: OtpMessage): Promise<void> {
    capturedOtps.set(msg.challengeId, msg.otp)
  }
}

/** Đọc mã OTP đã bắt được theo mã phiên (chỉ dùng trong kiểm thử). */
export function takeCapturedOtp(challengeId: string): string | undefined {
  return capturedOtps.get(challengeId)
}

export function clearCapturedOtps(): void {
  capturedOtps.clear()
}

/* ------------------------------- CONSOLE -------------------------------- */

class ConsoleChannel implements NotificationChannel {
  readonly ten = 'CONSOLE'

  async guiOtp(msg: OtpMessage): Promise<void> {
    // Ghi thẳng stdout để KHÔNG lọt vào log có cấu trúc (pino) hay file log tập trung.
    process.stdout.write(
      `\n[OTP/dev] ${msg.maHoSo} bước ${msg.stepOrder} — mã cho ${msg.to.hoTen}: ` +
        `${msg.otp} (hết hạn ${msg.hetHanLuc.toISOString()})\n\n`,
    )
  }
}

/* --------------------------- EMAIL / SMS / NONE -------------------------- */

class UnconfiguredChannel implements NotificationChannel {
  constructor(readonly ten: string) {}

  async guiOtp(): Promise<never> {
    throw AppError.configuration(
      `Chưa cấu hình kênh gửi OTP thật (đang đặt OTP_CHANNEL=${this.ten}). ` +
        'Hãy cấu hình nhà cung cấp email/SMS trước khi gửi mã.',
      { otpChannel: this.ten },
    )
  }
}

/* -------------------------------- Chọn kênh ----------------------------- */

let override: NotificationChannel | null = null

/** Ép kênh gửi trong kiểm thử (dùng để mô phỏng kênh hỏng/chưa cấu hình). */
export function setOtpChannelForTest(channel: NotificationChannel | null): void {
  override = channel
}

export function getOtpChannel(): NotificationChannel {
  if (override) return override
  switch (otpChannelName()) {
    case 'CONSOLE':
      return new ConsoleChannel()
    case 'CAPTURE':
      return new CaptureChannel()
    default:
      return new UnconfiguredChannel(otpChannelName())
  }
}

/** Gửi mã qua kênh đang cấu hình. */
export async function sendOtp(msg: OtpMessage): Promise<void> {
  await getOtpChannel().guiOtp(msg)
}
