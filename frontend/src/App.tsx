import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/DashboardPage'
import TransaksiJemputPanganPage from './pages/TransaksiJemputPanganPage'
import TransaksiDetailPage from './pages/TransaksiDetailPage'
import TransaksiMakloonBaruPage from './pages/TransaksiMakloonBaruPage'
import PengadaanPage from './pages/PengadaanPage'
import KeuanganPage from './pages/KeuanganPage'
import AdminUsersPage from './pages/AdminUsersPage'
import MonitoringPage from './pages/MonitoringPage'
import RekapTransaksiPage from './pages/RekapTransaksiPage'
import AdminAuditLogPage from './pages/AdminAuditLogPage'
import { bolehAkses } from './lib/navActions'

const queryClient = new QueryClient()

// Halaman yang aksesnya dibatasi per role; daftar role-nya di AKSES_HALAMAN (lib/navActions).
const HALAMAN_BERPERAN: Record<string, React.ReactNode> = {
  '/transaksi/baru': <TransaksiJemputPanganPage />,
  '/transaksi/baru-mpp': <TransaksiMakloonBaruPage />,
  '/pengadaan': <PengadaanPage />,
  '/keuangan': <KeuanganPage />,
  '/admin/users': <AdminUsersPage />,
  '/admin/audit-logs': <AdminAuditLogPage />,
  '/monitoring': <MonitoringPage />,
  '/rekap': <RekapTransaksiPage />,
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

/** Role tanpa akses dikembalikan ke dashboard, bukan dibiarkan melihat halaman yang lalu 403. */
function RoleRoute({ path, element }: { path: string; element: React.ReactNode }) {
  const { user } = useAuth()
  if (user && !bolehAkses(user.role.nama_role, path)) return <Navigate to="/dashboard" replace />
  return <>{element}</>
}

function RedirectToTransaksiDetail() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/transaksi/${encodeURIComponent(id ?? '')}`} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/transaksi/:id" element={<TransaksiDetailPage />} />
        <Route path="/transaksi/:id/ub-jastasma" element={<RedirectToTransaksiDetail />} />
        <Route path="/transaksi/:id/makloon" element={<RedirectToTransaksiDetail />} />
        {Object.entries(HALAMAN_BERPERAN).map(([path, element]) => (
          <Route key={path} path={path} element={<RoleRoute path={path} element={element} />} />
        ))}
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        {/* Tema toast disesuaikan token SerGab Lampung (lihat .toast-sergab-* di index.css) */}
        <Toaster
          position="top-right"
          toastOptions={{ classNames: { success: 'toast-sergab-success', error: 'toast-sergab-error' } }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
