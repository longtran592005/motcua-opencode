import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Hash, ListChecks, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { QrScanner } from '../components/QrScanner'
import { useRecentDocuments } from '../hooks/useVerify'
import { formatDate } from '@/lib/formatters'
import { maskName } from '@/lib/utils'
import { DOCUMENT_STATUS_LABELS } from '@/types'

/** Trang tra cứu văn bản: nhập mã/số văn bản hoặc quét mã QR. */
export function VerifyLookupPage() {
  const navigate = useNavigate()
  const [ma, setMa] = React.useState('')
  const { data: recent, isLoading } = useRecentDocuments(5)

  function tra(event: React.FormEvent) {
    event.preventDefault()
    const value = ma.trim()
    if (!value) return
    navigate(`/xac-thuc/${encodeURIComponent(value)}`)
  }

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="space-y-1 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </span>
        <h1 className="section-title justify-center text-xl font-extrabold text-brand-heading">
          Xác thực văn bản điện tử
        </h1>
        <p className="text-sm text-muted-foreground">
          Nhập mã xác thực in trên văn bản hoặc quét mã QR để kiểm tra tính hợp lệ.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="size-4 text-primary" aria-hidden="true" />
              Nhập mã xác thực / số văn bản
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={tra} className="space-y-3">
              <Input
                value={ma}
                onChange={(e) => setMa(e.target.value)}
                placeholder="Ví dụ: 120/GXN-ĐHTB hoặc mã trong QR"
                aria-label="Nhập mã xác thực hoặc số văn bản"
              />
              <Button type="submit" className="w-full gap-2" disabled={!ma.trim()}>
                <Search className="size-4" />
                Tra cứu văn bản
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quét mã QR</CardTitle>
          </CardHeader>
          <CardContent>
            <QrScanner
              onResult={(token) => {
                if (token) navigate(`/xac-thuc/${encodeURIComponent(token)}`)
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
            Văn bản mới cấp gần đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !recent || recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Chưa có văn bản nào được cấp.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link
                    to={`/xac-thuc/${doc.tokenXacThuc}`}
                    className="flex flex-wrap items-center gap-2 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{doc.soVanBan}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.trichYeu} · {maskName(doc.sinhVien.hoTen)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(doc.ngayCap)}</span>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {DOCUMENT_STATUS_LABELS[doc.trangThai]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
