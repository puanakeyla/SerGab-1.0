// Padanan frontend/src/lib/navActions.ts + label dari AppNav & lib/kerjaanTransaksi.ts.
// Server tetap penentu akhir (middleware `role:` di backend/routes/api.php).

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  jemput_pangan: 'Jemput Pangan',
  makloon: 'Makloon',
  ub_jastasma: 'UB Jastasma',
  pengadaan: 'Pengadaan',
  keuangan: 'Keuangan',
};

export const labelRole = (role: string) => ROLE_LABEL[role] ?? role.replace(/_/g, ' ');

export const STAGE_LABEL: Record<string, string> = {
  jemput_pangan: 'Jemput Pangan',
  makloon: 'Makloon',
  makloon_kirim: 'Makloon Kirim',
  makloon_terima: 'Makloon Terima',
  ub_jastasma: 'UB Jastasma',
  pengadaan: 'Pengadaan',
  keuangan: 'Keuangan',
};

export type KerjaanId = 'periksa' | 'isi' | 'draft' | 'ditolak';
export const KERJAAN_URUT: KerjaanId[] = ['periksa', 'isi', 'draft', 'ditolak'];
export const KERJAAN_LABEL: Record<KerjaanId, string> = {
  periksa: 'Perlu dicek',
  isi: 'Perlu diisi',
  draft: 'Draft belum dikirim',
  ditolak: 'Perlu diperbaiki',
};

export type MenuItem = { href: '/transaksi' | '/foto'; label: string; keterangan: string; roles: string[] };

/** Menu mobile per role. Fitur back-office (Kelola User, Audit Log, Rekap) tetap di web. */
export const MENU: MenuItem[] = [
  {
    href: '/transaksi',
    label: 'Antrean Transaksi',
    keterangan: 'Transaksi yang menunggu tindakan Anda',
    // Antrean admin selalu kosong -- tidak ada tahap yang aktornya admin.
    roles: ['jemput_pangan', 'makloon', 'ub_jastasma', 'pengadaan', 'keuangan'],
  },
  {
    href: '/foto',
    label: 'Foto & Antrean Unggah',
    keterangan: 'Potret dokumen, unggah otomatis saat online',
    // Role yang mengunggah foto transaksi (POST /transaksi/{id}/foto).
    roles: ['jemput_pangan', 'makloon', 'ub_jastasma', 'admin'],
  },
];

export const menuUntuk = (role: string) => MENU.filter((m) => m.roles.includes(role));

export function bolehAkses(role: string | undefined, href: MenuItem['href']): boolean {
  return !!role && !!MENU.find((m) => m.href === href)?.roles.includes(role);
}
