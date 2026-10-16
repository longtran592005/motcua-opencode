import type { Prisma } from '@prisma/client'
import { randomToken, sha256 } from '../../lib/crypto'
import type { ApplicationRow } from '../shared/dto'

const DEFAULT_BODY = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
---------------

Số: {{so_van_ban}}

{{trich_yeu}}

Trường Đại học Thái Bình xác nhận sinh viên {{ho_ten}}, mã số {{mssv}},
lớp {{lop}}, ngành {{nganh}}, khoa {{khoa}}, khóa {{khoa_hoc}}.

Văn bản được phát hành ngày {{ngay_cap}} và ký số điện tử.
`

/** Thay thế các biến dạng {{ten_bien}} bằng giá trị tương ứng. */
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => values[key] ?? '')
}

export function buildValues(
  app: ApplicationRow,
  soVanBan: string,
  ngayCap: Date,
): Record<string, string> {
  const duLieu = (app.duLieu ?? {}) as Record<string, unknown>
  const values: Record<string, string> = {
    so_van_ban: soVanBan,
    ngay_cap: ngayCap.toLocaleDateString('vi-VN'),
    ho_ten: app.applicant.hoTen,
    mssv: app.applicant.maSo,
    lop: app.class?.ten ?? '',
    khoa: app.class?.faculty.ten ?? '',
    nganh: app.class?.major.ten ?? '',
    khoa_hoc: app.class?.academicYear.ten ?? '',
    trich_yeu: app.requestType.ten,
  }
  for (const f of app.requestType.formFields) {
    const v = duLieu[f.key]
    if (v === undefined || v === null) continue
    values[f.key] = Array.isArray(v) ? v.join(', ') : String(v)
  }
  return values
}

/**
 * Phát hành văn bản cho một hồ sơ đã hoàn tất.
 * Giai đoạn 5 sẽ thay `noiDung`/`maBamSha256` bằng tệp PDF thật do PdfProvider sinh.
 */
export async function issueDocument(
  tx: Prisma.TransactionClient,
  params: { app: ApplicationRow; now: Date; actorId: string },
): Promise<{ id: string; soVanBan: string; tokenXacThuc: string; noiDung: string }> {
  const { app, now } = params
  const rt = app.requestType

  const soVanBan = `${app.maHoSo.split('-').pop()}/${rt.ma}-ĐHTB`
  const template = rt.templateId
    ? await tx.documentTemplate.findUnique({ where: { id: rt.templateId } })
    : null

  const values = buildValues(app, soVanBan, now)
  const noiDung = renderTemplate(template?.noiDung ?? DEFAULT_BODY, values)
  const tokenXacThuc = randomToken(32)

  const doc = await tx.signedDocument.create({
    data: {
      soVanBan,
      trichYeu: `${rt.ten} của sinh viên ${app.applicant.hoTen}`,
      loaiVanBan: template?.loaiVanBan ?? rt.nhom,
      templateId: rt.templateId ?? null,
      applicationId: app.id,
      sinhVienSnapshot: {
        hoTen: app.applicant.hoTen,
        mssv: app.applicant.maSo,
        lop: app.class?.ten ?? '',
        khoa: app.class?.faculty.ten ?? '',
        nganh: app.class?.major.ten ?? '',
        khoaHoc: app.class?.academicYear.ten ?? '',
      } as Prisma.InputJsonValue,
      noiDung,
      tokenXacThuc,
      maBamSha256: sha256(noiDung),
      trangThai: 'VALID',
      chuKyConHieuLuc: true,
    },
  })

  // Gắn văn bản vào các chữ ký đã tạo trong quá trình phê duyệt.
  await tx.signature.updateMany({
    where: { applicationId: app.id, vanBanId: null },
    data: { vanBanId: doc.id },
  })

  return { id: doc.id, soVanBan: doc.soVanBan, tokenXacThuc: doc.tokenXacThuc, noiDung }
}
