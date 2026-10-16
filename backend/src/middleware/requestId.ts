import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

/** Gắn mã yêu cầu vào log và phản hồi để đối chiếu khi gỡ lỗi. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id')
  req.requestId = incoming && incoming.length <= 100 ? incoming : randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
}
