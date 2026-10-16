import { QRCodeCanvas } from 'qrcode.react'
import { SCHOOL } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { previewValues, renderTemplate } from '@/lib/template'

interface TemplatePreviewProps {
  trichYeu: string
  noiDung: string
  soVanBan?: string
}

/** Xem trước văn bản A4 từ mẫu, dùng dữ liệu mẫu cho các biến. */
export function TemplatePreview({
  trichYeu,
  noiDung,
  soVanBan = '132/GXN-ĐHTB',
}: TemplatePreviewProps) {
  const noiDungRendered = renderTemplate(noiDung, {
    ...previewValues({ so_van_ban: soVanBan }),
    so_van_ban: soVanBan,
  })
  const trichYeuRendered = renderTemplate(trichYeu, previewValues({ so_van_ban: soVanBan }))

  return (
    <article className="a4-page" aria-label="Xem trước mẫu văn bản A4">
      <header className="flex items-start justify-between gap-6 text-center">
        <div className="w-[46%]">
          <p className="text-[12px] font-bold uppercase leading-snug">{SCHOOL.ten}</p>
          <p className="text-[12px]">Số: {soVanBan}</p>
          <div className="mx-auto mt-1 h-px w-24 bg-black/50" />
        </div>
        <div className="w-[46%]">
          <p className="text-[12px] font-bold uppercase leading-snug">
            Cộng hòa xã hội chủ nghĩa Việt Nam
          </p>
          <p className="text-[12px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
          <div className="mx-auto mt-1 h-px w-28 bg-black/50" />
          <p className="mt-2 text-[12px] italic">Thái Bình, {formatDate(new Date())}</p>
        </div>
      </header>

      <h1 className="mt-8 text-center text-[15px] font-bold uppercase leading-snug">
        {trichYeuRendered || 'Trích yếu văn bản'}
      </h1>

      <div className="mt-6 whitespace-pre-line text-justify">{noiDungRendered}</div>

      <div className="mt-10 flex items-end justify-between gap-6">
        <div className="flex flex-col items-center gap-1">
          <QRCodeCanvas value={`https://${SCHOOL.domain}/xac-thuc/MAU-XEM-TRUOC`} size={104} level="M" />
          <p className="max-w-32 text-center text-[10px] italic text-black/70">
            Quét mã để xác thực văn bản
          </p>
        </div>
        <div className="max-w-[52%] space-y-3 text-center">
          <p className="text-[12px] font-bold uppercase">Chữ ký điện tử</p>
          <div className="rounded-md border border-dashed border-black/40 px-3 py-2 text-left text-[11px]">
            <p className="font-semibold">Cố vấn học tập</p>
            <p className="text-black/70">Ký khi duyệt cấp 1</p>
          </div>
          <div className="rounded-md border border-dashed border-black/40 px-3 py-2 text-left text-[11px]">
            <p className="font-semibold">Trưởng khoa / Phòng Đào tạo</p>
            <p className="text-black/70">Ký khi duyệt cấp cuối</p>
          </div>
        </div>
      </div>
    </article>
  )
}
