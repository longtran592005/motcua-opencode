import pino from 'pino'
import { env, isProduction, isTest } from '../config/env'

/**
 * Ghi log bằng pino. Không bao giờ ghi ra bí mật: các trường nhạy cảm bị che.
 */
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'motcua-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'matKhau',
      'password',
      'otp',
      'otpHash',
      'token',
      'refreshToken',
      'passwordHash',
      'tokenXacThuc',
      'res.headers["set-cookie"]',
    ],
    censor: '[ĐÃ CHE]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
})
