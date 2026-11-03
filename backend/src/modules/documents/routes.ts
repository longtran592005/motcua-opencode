import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { idempotent } from '../../middleware/idempotency'
import { asyncHandler } from '../../middleware/errorHandler'
import { send, sendPage } from '../../lib/envelope'
import { requestContext, requireUser } from '../../lib/context'
import { AppError } from '../../lib/errors'
import { prisma } from '../../lib/prisma'
import * as service from './service'
import { createFileToken, readFileToken } from './fileToken'
import { generatePdf, readPdf } from './pdf'

const idParam = z.object({ id: z.string().min(1).max(200) })
const revokeBody = z.object({
  lyDo: z.string().trim().min(1, 'Vui lòng nhập lý do thu hồi.').max(2000),
})

export const documentRouter: Router = Router()
export const fileRouter: Router = Router()

documentRouter.use(authenticate)

documentRouter.get(
  '/',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  validate(service.documentListQuery, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as never as Parameters<typeof service.listIssued>[1]
    const result = await service.listIssued(requireUser(req), query)
    sendPage(res, result.items, result)
  }),
)

documentRouter.post(
  '/:id/revoke',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  idempotent(),
  validate(idParam, 'params'),
  validate(revokeBody),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { id } = req.params as { id: string }
    const { lyDo } = req.body as { lyDo: string }
    send(res, await service.revoke(ctx, id, lyDo))
  }),
)

documentRouter.post(
  '/:id/download-log',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const ctx = { user: requireUser(req), ...requestContext(req) }
    const { id } = req.params as { id: string }
    const doc = await service.logDownload(ctx, id)
    const { loadDocument } = service
    void loadDocument
    send(res, doc)
  }),
)

documentRouter.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const doc = await service.loadDocument(id)
    if (doc.application.applicantId !== requireUser(req).id && requireUser(req).role === 'SINH_VIEN') {
      throw AppError.forbidden('Bạn không có quyền truy cập văn bản này.')
    }
    const { signedDocumentDto } = await import('./dto')
    send(res, signedDocumentDto(doc, { mask: false }))
  }),
)

documentRouter.get(
  '/:id/export',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const doc = await service.loadDocument(id)
    const user = requireUser(req)
    if (doc.application.applicantId !== user.id && user.role === 'SINH_VIEN') {
      throw AppError.forbidden('Bạn không có quyền xuất văn bản này.')
    }
    if (!doc.pdfStorageKey) throw new AppError('PDF_NOT_READY', 'Văn bản chưa có tệp PDF.')
    await service.logDownload({ user, ...requestContext(req) }, id, 'export')
    send(res, { url: `/api/v1/files/${createFileToken(doc.id)}`, expiresInMinutes: 5 })
  }),
)

documentRouter.post(
  '/:id/regenerate',
  requireRole('ADMIN', 'PHONG_DAO_TAO'),
  idempotent(),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as { id: string }
    const doc = await service.loadDocument(id)
    const generated = await generatePdf({
      soVanBan: doc.soVanBan,
      trichYeu: doc.trichYeu,
      noiDung: doc.noiDung,
      tokenXacThuc: doc.tokenXacThuc,
      signatures: doc.signatures,
    })
    await prisma.signedDocument.update({
      where: { id: doc.id },
      data: { pdfStorageKey: generated.storageKey, maBamSha256: generated.sha256 },
    })
    send(res, { id: doc.id, pdfStorageKey: generated.storageKey })
  }),
)

fileRouter.get(
  '/:fileToken',
  asyncHandler(async (req, res) => {
    const parsed = readFileToken(req.params.fileToken)
    if (!parsed) throw new AppError('INVALID_FILE_TOKEN', 'Liên kết tải tệp không hợp lệ hoặc đã hết hạn.')
    const doc = await service.loadDocument(parsed.documentId)
    if (!doc.pdfStorageKey) throw new AppError('PDF_NOT_READY', 'Văn bản chưa có tệp PDF.')
    const bytes = await readPdf(doc.pdfStorageKey)
    res.type('application/pdf').set('Content-Disposition', `attachment; filename="${doc.soVanBan}.pdf"`).send(bytes)
  }),
)
