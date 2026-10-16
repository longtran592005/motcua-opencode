import { Globe, Mail, MapPin, Phone, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { SCHOOL } from '@/lib/constants'

const QUICK_LINKS = [
  { to: '/', label: 'Trang chủ' },
  { to: '/thu-vien-bieu-mau', label: 'Biểu mẫu & tài liệu' },
  { to: '/xac-thuc', label: 'Xác thực văn bản' },
  { to: '/dang-nhap', label: 'Đăng nhập hệ thống' },
]

const SUPPORT_LINKS = [
  { to: '/thu-vien-bieu-mau', label: 'Hướng dẫn nộp hồ sơ' },
  { to: '/xac-thuc', label: 'Tra cứu văn bản đã cấp' },
  { to: '/thu-vien-bieu-mau', label: 'Câu hỏi thường gặp' },
  { to: '/thu-vien-bieu-mau', label: 'Biểu mẫu tải về' },
]

/** Footer xanh dùng chung cho mọi trang. */
export function Footer() {
  return (
    <footer className="mt-auto bg-brand-heading text-white/85">
      <div className="container grid gap-8 py-12 md:grid-cols-3">
        <div className="space-y-4">
          <Logo onDark to="" />
          <p className="text-sm leading-relaxed">{SCHOOL.tenTiengAnh}</p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-white/60" aria-hidden="true" />
              {SCHOOL.diaChi}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-white/60" aria-hidden="true" />
              <a href={`tel:${SCHOOL.hotline.replace(/\./g, '')}`} className="hover:underline">
                {SCHOOL.hotline}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-white/60" aria-hidden="true" />
              <a href={`mailto:${SCHOOL.email}`} className="hover:underline">
                {SCHOOL.email}
              </a>
            </li>
          </ul>
          <div className="flex gap-2">
            <a
              href={SCHOOL.website}
              target="_blank"
              rel="noreferrer"
              className="flex size-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Cổng thông tin Trường Đại học Thái Bình"
            >
              <Globe className="size-4" />
            </a>
            <a
              href={SCHOOL.website}
              target="_blank"
              rel="noreferrer"
              className="flex size-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Kênh video Trường Đại học Thái Bình"
            >
              <Video className="size-4" />
            </a>
            <a
              href={`mailto:${SCHOOL.email}`}
              className="flex size-9 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
              aria-label="Gửi email cho nhà trường"
            >
              <Mail className="size-4" />
            </a>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">
            Liên kết nhanh
          </h2>
          <ul className="space-y-2.5 text-sm">
            {QUICK_LINKS.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="transition-colors hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">Hỗ trợ</h2>
          <ul className="space-y-2.5 text-sm">
            {SUPPORT_LINKS.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="transition-colors hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-white/60">
            Giờ làm việc: 07:30 – 17:00, thứ Hai đến thứ Sáu.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-4 text-xs text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} {SCHOOL.ten}. Bảo lưu mọi quyền.</p>
          <p>
            Cổng {SCHOOL.portal} · {SCHOOL.domain}
          </p>
        </div>
      </div>
    </footer>
  )
}
