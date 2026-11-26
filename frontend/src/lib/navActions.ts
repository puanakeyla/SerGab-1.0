export type NavAction = { to: string; label: string }

/**
 * Role yang boleh membuka tiap halaman terproteksi -- satu sumber untuk menu DAN penjaga route
 * (App.tsx), supaya menu tidak pernah menautkan halaman yang lalu ditolak. Selaras dengan
 * middleware `role:` di backend/routes/api.php; server tetap penentu akhir.
 * Halaman yang tidak terdaftar di sini terbuka untuk semua user yang login (mis. /dashboard).
 */
export const AKSES_HALAMAN: Record<string, string[]> = {
  '/transaksi/baru': ['jemput_pangan', 'admin'],
  '/transaksi/baru-mpp': ['makloon', 'admin'],
  '/pengadaan': ['pengadaan', 'admin'],
  '/keuangan': ['keuangan', 'admin'],
  '/monitoring': ['admin'],
  '/rekap': ['jemput_pangan', 'makloon', 'ub_jastasma', 'pengadaan', 'keuangan', 'admin'],
  '/admin/users': ['admin'],
  '/admin/audit-logs': ['admin'],
}

export function bolehAkses(role: string, path: string): boolean {
  const roles = AKSES_HALAMAN[path]
  return !roles || roles.includes(role)
}

// Sub-menu utama per role. Dipakai header global agar akses antar bab konsisten
// di semua halaman, bukan hanya muncul sebagai tombol besar di dashboard.
// Urutan di sini = urutan di navbar.
const MENU: NavAction[] = [
  { to: '/transaksi/baru', label: 'Buat Transaksi' },
  { to: '/transaksi/baru-mpp', label: 'Buat MPP' },
  { to: '/admin/users', label: 'Kelola User' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/rekap', label: 'Rekap Data' },
  { to: '/admin/audit-logs', label: 'Audit Log' },
]

// Admin bisa membuka form buat transaksi lewat URL, tapi menunya sengaja tidak ditampilkan:
// pembuat transaksi adalah role lapangan.
const TIDAK_DI_MENU_ADMIN = ['/transaksi/baru', '/transaksi/baru-mpp']

export function buildActions(role: string): NavAction[] {
  return MENU.filter(
    (m) => bolehAkses(role, m.to) && !(role === 'admin' && TIDAK_DI_MENU_ADMIN.includes(m.to)),
  )
}
