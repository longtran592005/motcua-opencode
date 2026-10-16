import type { Role } from '@prisma/client'

declare global {
  namespace Express {
    /** Người dùng đã xác thực, nạp lại từ CSDL ở mỗi yêu cầu. */
    interface AuthUser {
      id: string
      maSo: string
      hoTen: string
      email: string
      role: Role
      facultyId: string | null
      departmentId: string | null
      chucVu: string | null
    }

    interface Request {
      /** Mã yêu cầu để đối chiếu log. */
      requestId: string
      user?: AuthUser
      /** Bật khi phản hồi được trả lại từ bộ đệm idempotency. */
      idempotencyReplay?: boolean
    }
  }
}

export {}
