import { SignatureStamp } from '@/components/common/SignatureStamp'
import { QrCard } from '@/components/common/QrCard'
import { SCHOOL } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import type { SignedDocument } from '@/types'

interface AdministrativeDocumentProps {
  document: SignedDocument
  /** URL xác thực được mã hoá vào QR. */
  verifyUrl: string
}

/**
 * Bản xem trước văn bản hành chính khổ A4: quốc hiệu, tiêu ngữ, số văn bản,
 * nội dung, khối chữ ký điện tử theo cấp duyệt và mã QR xác thực.
 */
export function AdministrativeDocument({ document, verifyUrl }: AdministrativeDocumentProps) {
  const ngayCap = new Date(document.ngayCap)
  const dauNgay = `ngày ${String(ngayCap.getDate()).padStart(2, '0')} tháng ${String(
    ngayCap.getMonth() + 1,
  ).padStart(2, '0')} năm ${ngayCap.getFullYear()}`

  const chuKyTheoCap = [...document.chuKy].sort((a, b) => a.buocOrder - b.buocOrder)

  return (
    <article className="a4-page" aria-label={`Văn bản số ${document.soVanBan}`}>
      <header className="flex items-start justify-between gap-6 text-center">
        <div className="w-[46%]">
          <p className="text-[12px] font-bold uppercase leading-snug sm:text-[13px]">
            {SCHOOL.ten}
          </p>
          <p className="text-[12px] sm:text-[13px]">Số: {document.soVanBan}</p>
          <div className="mx-auto mt-1 h-px w-24 bg-black/50" />
        </div>
        <div className="w-[46%]">
          <p className="text-[12px] font-bold uppercase leading-snug sm:text-[13px]">
            Cộng hòa xã hội chủ nghĩa Việt Nam
          </p>
          <p className="text-[12px] font-bold sm:text-[13px]">Độc lập - Tự do - Hạnh phúc</p>
          <div className="mx-auto mt-1 h-px w-28 bg-black/50" />
          <p className="mt-2 text-[12px] italic sm:text-[13px]">Thái Bình, {dauNgay}</p>
        </div>
      </header>

      <h1 className="mt-8 text-center text-[15px] font-bold uppercase leading-snug sm:text-base">
        {document.trichYeu}
      </h1>

      <div className="mt-6 space-y-3 whitespace-pre-line text-justify">{document.noiDung}</div>

      <div className="mt-10 flex items-end justify-between gap-6">
        <QrCard
          value={verifyUrl}
          kichThuoc={112}
          chuThich="Quét mã để xác thực văn bản"
          tenTepTai={`qr-${document.soVanBan.replace(/[/\\]/g, '-')}`}
        />

        <div className="max-w-[52%] space-y-3">
          <p className="text-center text-[12px] font-bold uppercase">Chữ ký điện tử</p>
          {chuKyTheoCap.map((chuKy) => (
            <SignatureStamp key={chuKy.id} chuKy={chuKy} compact />
          ))}
        </div>
      </div>

      <p className="mt-8 border-t pt-2 text-center text-[11px] italic text-black/70">
        Văn bản được ký điện tử, quét mã QR để xác thực tại {SCHOOL.domain}/xac-thuc. Ngày cấp:{' '}
        {formatDate(document.ngayCap)}.
      </p>
    </article>
  )
}
