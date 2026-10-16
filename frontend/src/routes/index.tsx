import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { HomeRoute } from '@/features/applications/pages/HomeRoute'
import { StudentHomePage } from '@/features/applications/pages/StudentHomePage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { NewApplicationPage } from '@/features/applications/pages/NewApplicationPage'
import { MyApplicationsPage } from '@/features/applications/pages/MyApplicationsPage'
import { ApplicationDetailPage } from '@/features/applications/pages/ApplicationDetailPage'
import { DocumentPage } from '@/features/documents/pages/DocumentPage'
import { LibraryPage } from '@/features/library/pages/LibraryPage'
import { VerifyLookupPage } from '@/features/verify/pages/VerifyLookupPage'
import { VerifyResultPage } from '@/features/verify/pages/VerifyResultPage'
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage'
import { PendingPage } from '@/features/approvals/pages/PendingPage'
import { ProcessingDetailPage } from '@/features/approvals/pages/ProcessingDetailPage'
import { ProcessedPage } from '@/features/approvals/pages/ProcessedPage'
import { DelegationPage } from '@/features/approvals/pages/DelegationPage'
import { RoleGuard } from './RoleGuard'
import { NotFoundPage } from './NotFoundPage'

/* Các trang nặng (biểu đồ, trình thiết kế) được tách gói để tải theo nhu cầu. */
const OverviewPage = lazy(() =>
  import('@/features/approvals/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
)
const RequestTypeAdminPage = lazy(() =>
  import('@/features/admin/pages/RequestTypeAdminPage').then((m) => ({
    default: m.RequestTypeAdminPage,
  })),
)
const WorkflowAdminPage = lazy(() =>
  import('@/features/admin/pages/WorkflowAdminPage').then((m) => ({ default: m.WorkflowAdminPage })),
)
const TemplateAdminPage = lazy(() =>
  import('@/features/admin/pages/TemplateAdminPage').then((m) => ({ default: m.TemplateAdminPage })),
)
const IssuedDocumentsPage = lazy(() =>
  import('@/features/admin/pages/IssuedDocumentsPage').then((m) => ({
    default: m.IssuedDocumentsPage,
  })),
)
const ReportsPage = lazy(() =>
  import('@/features/admin/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const UsersPage = lazy(() =>
  import('@/features/admin/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const CatalogPage = lazy(() =>
  import('@/features/admin/pages/CatalogPage').then((m) => ({ default: m.CatalogPage })),
)
const AuditLogPage = lazy(() =>
  import('@/features/admin/pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
)

/** Khung chờ khi một trang đang được tải theo nhu cầu. */
function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <Skeleton className="h-9 w-64" />
      <SkeletonTable rows={5} cols={4} />
    </div>
  )
}

/** Bảng định tuyến toàn ứng dụng. */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dang-nhap" element={<LoginPage />} />

        {/* Khu vực sinh viên */}
        <Route element={<RoleGuard allow={['SINH_VIEN']} />}>
          <Route element={<StudentLayout />}>
            <Route path="/trang-chu" element={<StudentHomePage />} />
            <Route path="/don/moi/:loaiDon" element={<NewApplicationPage />} />
            <Route path="/don-cua-toi" element={<MyApplicationsPage />} />
            <Route path="/don/:ma" element={<ApplicationDetailPage />} />
            <Route path="/don/:ma/van-ban" element={<DocumentPage />} />
            <Route path="/thong-bao" element={<NotificationsPage />} />
            <Route path="/ho-so-ca-nhan" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Trang công khai */}
        <Route element={<PublicLayout />}>
          <Route path="/thu-vien-bieu-mau" element={<LibraryPage />} />
          <Route path="/xac-thuc" element={<VerifyLookupPage />} />
          <Route path="/xac-thuc/:token" element={<VerifyResultPage />} />
        </Route>

        {/* Khu vực quản trị */}
        <Route element={<RoleGuard allow={['CO_VAN', 'TRUONG_KHOA', 'PHONG_DAO_TAO', 'ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/quan-ly" element={<OverviewPage />} />
            <Route path="/quan-ly/cho-duyet" element={<PendingPage />} />
            <Route path="/quan-ly/don/:ma" element={<ProcessingDetailPage />} />
            <Route path="/quan-ly/da-xu-ly" element={<ProcessedPage />} />
            <Route path="/quan-ly/uy-quyen" element={<DelegationPage />} />
          </Route>
        </Route>

        {/* Khu vực quản trị hệ thống (chỉ ADMIN) */}
        <Route element={<RoleGuard allow={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/quan-ly/loai-don" element={<RequestTypeAdminPage />} />
            <Route path="/quan-ly/luong-duyet" element={<WorkflowAdminPage />} />
            <Route path="/quan-ly/mau-van-ban" element={<TemplateAdminPage />} />
            <Route path="/quan-ly/van-ban-da-cap" element={<IssuedDocumentsPage />} />
            <Route path="/quan-ly/bao-cao" element={<ReportsPage />} />
            <Route path="/quan-ly/nguoi-dung" element={<UsersPage />} />
            <Route path="/quan-ly/danh-muc" element={<CatalogPage />} />
            <Route path="/quan-ly/nhat-ky" element={<AuditLogPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
