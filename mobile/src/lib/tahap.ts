// Urutan tahap, field form, dan foto wajib per tahap. Cermin dari backend:
// TransaksiStages::sequence(), aturan validasi di TransaksiController (jemputPangan, makloon,
// makloonTerima, ubJastasma), dan koleksi media di model Data*. Server tetap penentu akhir.
// File ini sengaja tanpa import React Native supaya bisa dites dengan `node --test`.

export type TipeField = 'teks' | 'angka' | 'desimal' | 'tanggal' | 'kabupaten' | 'makloon';
export type Field = { key: string; label: string; tipe: TipeField };

export type Blok = 'data_jemput_pangan' | 'data_makloon_tjp' | 'data_makloon_mpp' | 'data_makloon_terima' | 'data_ub_jastasma';

export type Tahap = {
  role: string;
  label: string;
  /** Role user yang mengerjakan tahap ini (makloon_kirim/terima dikerjakan role makloon). */
  aktor: string;
  /** PATCH /transaksi/{id}/{endpoint}. null = tahap level PO (Pengadaan/Keuangan), dikerjakan di web. */
  endpoint: string | null;
  blok: Blok | null;
  fields: Field[];
  foto: string[];
};

export type StatusBlok = 'draft' | 'menunggu_review' | 'diterima' | 'ditolak';
export type DataBlok = { status: StatusBlok; catatan_penolakan?: string | null; [key: string]: unknown } | null;

export type Transaksi = {
  id_transaksi: string;
  skema: 'TJP' | 'MPP';
  current_stage: string;
  status_keseluruhan: 'berjalan' | 'selesai' | 'dibatalkan';
  riwayat_penolakan?: { tahap: string; catatan: string }[];
} & Partial<Record<Blok, DataBlok>>;

const f = (key: string, label: string, tipe: TipeField = 'teks'): Field => ({ key, label, tipe });

const ASAL = [f('id_pemasok', 'ID pemasok'), f('supir', 'Supir'), f('plat_mobil', 'Plat mobil')];
const WILAYAH = [f('desa', 'Desa'), f('kecamatan', 'Kecamatan'), f('kabupaten', 'Kabupaten', 'kabupaten')];

const UB: Tahap = {
  role: 'ub_jastasma',
  label: 'UB Jastasma',
  aktor: 'ub_jastasma',
  endpoint: 'ub-jastasma',
  blok: 'data_ub_jastasma',
  fields: [
    f('ka1', 'KA1 (%)', 'desimal'),
    f('ka2', 'KA2 (%)', 'desimal'),
    f('ka3', 'KA3 (%)', 'desimal'),
    f('hampa', 'Hampa (%)', 'desimal'),
    f('butir_hijau', 'Butir hijau (%)', 'desimal'),
  ],
  foto: ['foto_lhpk_hpk'],
};

const PO_LEVEL: Tahap[] = [
  { role: 'pengadaan', label: 'Pengadaan', aktor: 'pengadaan', endpoint: null, blok: null, fields: [], foto: [] },
  { role: 'keuangan', label: 'Keuangan', aktor: 'keuangan', endpoint: null, blok: null, fields: [], foto: [] },
];

export const URUTAN: Record<'TJP' | 'MPP', Tahap[]> = {
  TJP: [
    {
      role: 'jemput_pangan',
      label: 'Jemput Pangan',
      aktor: 'jemput_pangan',
      endpoint: 'jemput-pangan',
      blok: 'data_jemput_pangan',
      fields: [
        ...ASAL,
        f('nama_poktan_gapoktan', 'Poktan/Gapoktan'),
        ...WILAYAH,
        f('makloon_user_id', 'Makloon tujuan', 'makloon'),
        f('tanggal_kirim', 'Tanggal kirim', 'tanggal'),
        f('kuantum', 'Kuantum (kg)', 'angka'),
        f('jarak_ke_makloon_km', 'Jarak ke makloon (km)', 'desimal'),
      ],
      foto: ['foto_petani', 'foto_gabah', 'foto_serah_terima', 'foto_kwitansi', 'foto_surat_pernyataan', 'foto_surat_jalan'],
    },
    {
      role: 'makloon',
      label: 'Makloon',
      aktor: 'makloon',
      endpoint: 'makloon',
      blok: 'data_makloon_tjp',
      fields: [f('tanggal_bongkar', 'Tanggal bongkar', 'tanggal'), f('kuantum_bongkar', 'Kuantum bongkar (kg)', 'angka')],
      foto: ['foto_surat_jalan_paraf', 'foto_nota_timbang'],
    },
    UB,
    ...PO_LEVEL,
  ],
  MPP: [
    {
      role: 'makloon_kirim',
      label: 'Makloon Kirim',
      aktor: 'makloon',
      endpoint: 'makloon',
      blok: 'data_makloon_mpp',
      fields: [
        ...ASAL,
        ...WILAYAH,
        f('tanggal_bongkar', 'Tanggal bongkar', 'tanggal'),
        f('kuantum', 'Kuantum (kg)', 'angka'),
        f('jarak_ke_makloon_km', 'Jarak ke makloon (km)', 'desimal'),
      ],
      foto: ['foto_petani', 'foto_gabah', 'foto_serah_terima', 'foto_pembayaran', 'foto_surat_pernyataan'],
    },
    {
      role: 'makloon_terima',
      label: 'Makloon Terima',
      aktor: 'makloon',
      endpoint: 'makloon-terima',
      blok: 'data_makloon_terima',
      fields: [f('kuantum_bongkar', 'Kuantum bongkar (kg)', 'angka')],
      foto: ['foto_surat_jalan', 'foto_nota_timbang'],
    },
    UB,
    ...PO_LEVEL,
  ],
};

export const FOTO_LABEL: Record<string, string> = {
  foto_petani: 'Foto Petani',
  foto_gabah: 'Foto Gabah',
  foto_serah_terima: 'Foto Serah Terima',
  foto_kwitansi: 'Foto Kwitansi',
  foto_pembayaran: 'Foto Pembayaran',
  foto_surat_pernyataan: 'Foto Surat Pernyataan',
  foto_surat_jalan: 'Foto Surat Jalan',
  foto_surat_jalan_paraf: 'Foto Surat Jalan (Diparaf)',
  foto_nota_timbang: 'Foto Nota Timbang',
  foto_lhpk_hpk: 'Foto LHPK/HPK',
};

export const STATUS_LABEL: Record<StatusBlok, string> = {
  draft: 'Draft',
  menunggu_review: 'Menunggu diperiksa',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
};

export type Aksi =
  | { mode: 'periksa'; tahap: Tahap } // data tahap sebelumnya menunggu diterima/ditolak user ini
  | { mode: 'isi'; tahap: Tahap } // user ini mengisi data tahapnya (baru, draft, atau perbaikan)
  | { mode: 'web'; tahap: Tahap } // giliran user ini, tapi pekerjaannya level PO (web)
  | { mode: 'lihat' };

/**
 * Apa yang bisa dilakukan `role` pada transaksi ini sekarang. Logikanya sama dengan penjaga di
 * TransaksiStageService: hanya aktor tahap `current_stage` yang bertindak; Terima/Tolak hanya
 * bila data tahap sebelumnya `menunggu_review`; data yang sudah dikirim/diterima tak bisa diubah.
 */
export function aksiUntuk(t: Transaksi, role: string): Aksi {
  const urutan = URUTAN[t.skema] ?? [];
  const i = urutan.findIndex((s) => s.role === t.current_stage);
  if (t.status_keseluruhan !== 'berjalan' || i < 0) return { mode: 'lihat' };

  const kini = urutan[i];
  if (kini.aktor !== role) return { mode: 'lihat' };

  const sebelum = i > 0 ? urutan[i - 1] : null;
  if (sebelum?.blok && t[sebelum.blok]?.status === 'menunggu_review') return { mode: 'periksa', tahap: sebelum };

  if (!kini.endpoint || !kini.blok) return { mode: 'web', tahap: kini };

  const milikSendiri = t[kini.blok];
  if (milikSendiri && (milikSendiri.status === 'menunggu_review' || milikSendiri.status === 'diterima')) return { mode: 'lihat' };

  return { mode: 'isi', tahap: kini };
}

/** Field yang masih kosong; Kirim (aksi=submit) mewajibkan semuanya terisi. */
export function fieldKosong(tahap: Tahap, nilai: Record<string, string>): Field[] {
  return tahap.fields.filter((fl) => !(nilai[fl.key] ?? '').trim());
}

/** Ubah isian form (string) ke payload API: koma desimal jadi titik, kosong dibuang. */
export function kePayload(tahap: Tahap, nilai: Record<string, string>): Record<string, string | number> {
  const hasil: Record<string, string | number> = {};
  for (const fl of tahap.fields) {
    const v = (nilai[fl.key] ?? '').trim();
    if (!v) continue;
    const angka =
      fl.tipe === 'angka' || fl.tipe === 'makloon'
        ? Number(v.replace(/\./g, ''))
        : fl.tipe === 'desimal'
          ? Number(v.replace(',', '.'))
          : null;
    // Angka tak valid dikirim mentah supaya server membalas pesan validasi, bukan menerima null.
    hasil[fl.key] = angka === null || Number.isNaN(angka) ? v : angka;
  }
  return hasil;
}
