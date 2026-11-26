import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api, ApiError, pesanKegagalan } from './api';

/** Foto yang sudah dikompres & disimpan di HP, menunggu diunggah (sinyal lapangan sering putus). */
export type FotoLokal = {
  id: string;
  uri: string;
  transaksiId: string;
  jenisFoto: string;
  dibuatPada: string;
  /** User yang memotret. HP lapangan bisa dipakai bergantian; foto tidak boleh terunggah atas nama akun lain. */
  pemilik: number;
  /** Dibuat sekali saat foto disimpan dan dipakai ulang di setiap percobaan unggah. */
  idempotencyKey: string;
  /** Diisi bila server menolak permanen (mis. 422). Dilewati unggah otomatis; tombol Unggah manual tetap mencoba. */
  gagal?: string;
};

export class IzinDitolak extends Error {
  constructor(public bisaDimintaLagi: boolean) {
    super('Izin akses ditolak.');
  }
}

// Sama dengan frontend web (lib/uploadFoto.ts): sisi terpanjang 2048px supaya teks nota/surat
// jalan tetap terbaca. Render ulang juga membuang EXIF (koordinat GPS petani).
const SISI_MAKS = 2048;
const KUALITAS = 0.8;
const KUNCI_ANTREAN = 'antrean_foto';
const folder = new Directory(Paths.document, 'foto-antrean');

/** Minta izin lalu buka kamera/galeri. null = pengguna membatalkan. */
export async function ambilFoto(sumber: 'kamera' | 'galeri'): Promise<ImagePicker.ImagePickerAsset | null> {
  const izin =
    sumber === 'kamera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!izin.granted) throw new IzinDitolak(izin.canAskAgain);

  const opsi: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const hasil =
    sumber === 'kamera' ? await ImagePicker.launchCameraAsync(opsi) : await ImagePicker.launchImageLibraryAsync(opsi);
  return hasil.canceled ? null : hasil.assets[0];
}

/** Kompres foto lalu simpan permanen di HP dan catat di antrean unggah. */
export async function simpanLokal(
  asset: ImagePicker.ImagePickerAsset,
  transaksiId: string,
  jenisFoto: string,
  pemilik: number,
): Promise<FotoLokal> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > SISI_MAKS) {
    ctx.resize(asset.width >= asset.height ? { width: SISI_MAKS } : { height: SISI_MAKS });
  }
  const terkompres = await (await ctx.renderAsync()).saveAsync({ compress: KUALITAS, format: SaveFormat.JPEG });

  if (!folder.exists) folder.create();
  const id = randomUUID();
  const tujuan = new File(folder, `${id}.jpg`);
  new File(terkompres.uri).move(tujuan);

  const foto: FotoLokal = {
    id,
    uri: tujuan.uri,
    transaksiId,
    jenisFoto,
    pemilik,
    idempotencyKey: randomUUID(),
    dibuatPada: new Date().toISOString(),
  };
  await ubahAntrean((list) => [...list, foto]);
  return foto;
}

// ---- Penyimpanan antrean ------------------------------------------------------------------

const pendengar = new Set<() => void>();
let rantai: Promise<unknown> = Promise.resolve();

export async function daftarAntrean(pemilik?: number): Promise<FotoLokal[]> {
  const list: FotoLokal[] = JSON.parse((await Storage.getItem(KUNCI_ANTREAN)) ?? '[]');
  return pemilik === undefined ? list : list.filter((f) => f.pemilik === pemilik);
}

/**
 * Semua penulisan antrean lewat sini dan dijalankan berurutan: unggah otomatis dan simpan foto
 * baru bisa terjadi bersamaan, dan baca-ubah-tulis paralel akan menghilangkan salah satunya.
 */
function ubahAntrean(ubah: (list: FotoLokal[]) => FotoLokal[]): Promise<void> {
  const tugas = rantai.then(async () => {
    await Storage.setItem(KUNCI_ANTREAN, JSON.stringify(ubah(await daftarAntrean())));
    pendengar.forEach((fn) => fn());
  });
  rantai = tugas.catch(() => {});
  return tugas;
}

/** Dipanggil setiap antrean berubah (termasuk oleh unggah otomatis). Mengembalikan fungsi berhenti. */
export function pantauAntrean(fn: () => void) {
  pendengar.add(fn);
  return () => void pendengar.delete(fn);
}

export async function hapusDariAntrean(id: string) {
  await ubahAntrean((list) => {
    const foto = list.find((f) => f.id === id);
    if (foto) {
      const file = new File(foto.uri);
      if (file.exists) file.delete();
    }
    return list.filter((f) => f.id !== id);
  });
}

// ---- Unggah ---------------------------------------------------------------------------------

/** 4xx selain sesi habis/timeout/rate-limit tidak akan berhasil dengan mengulang. */
function ditolakPermanen(e: unknown) {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
}

/** Unggah satu foto antrean; berkas lokal baru dihapus setelah server menerimanya. */
export async function unggah(foto: FotoLokal) {
  const form = new FormData();
  form.append('jenis_foto', foto.jenisFoto);
  // Bentuk {uri, name, type} adalah cara React Native melampirkan berkas ke multipart.
  form.append('foto', { uri: foto.uri, name: `${foto.jenisFoto}.jpg`, type: 'image/jpeg' } as unknown as Blob);

  try {
    await api(`/transaksi/${encodeURIComponent(foto.transaksiId)}/foto`, {
      method: 'POST',
      body: form,
      idempotencyKey: foto.idempotencyKey,
    });
  } catch (e) {
    if (ditolakPermanen(e)) {
      const gagal = pesanKegagalan(e);
      await ubahAntrean((list) => list.map((f) => (f.id === foto.id ? { ...f, gagal } : f)));
    }
    throw e;
  }
  await hapusDariAntrean(foto.id);
}

let sedangJalan: Promise<void> | null = null;

/**
 * Unggah semua foto milik `pemilik` secara berurutan. Panggilan saat proses masih berjalan
 * menunggu proses yang sama (tidak ada unggah ganda). Berhenti di gangguan jaringan/server;
 * sisanya dicoba lagi saat koneksi pulih.
 */
export function unggahSemua(pemilik: number): Promise<void> {
  sedangJalan ??= (async () => {
    for (const foto of await daftarAntrean(pemilik)) {
      if (foto.gagal) continue;
      try {
        await unggah(foto);
      } catch (e) {
        if (!ditolakPermanen(e)) return;
      }
    }
  })().finally(() => {
    sedangJalan = null;
  });
  return sedangJalan;
}

/** Pasang sekali di root: unggah antrean saat login, saat koneksi pulih, dan saat aplikasi kembali dibuka. */
export function useUnggahOtomatis(pemilik: number | null) {
  useEffect(() => {
    if (pemilik === null) return;
    const coba = () => void unggahSemua(pemilik).catch(() => {});

    coba();
    // Mulai dari false: event pertama yang "terhubung" ikut memicu coba() (aman, unggahSemua tidak berjalan ganda).
    let online = false;
    const net = Network.addNetworkStateListener((s) => {
      const sekarang = !!s.isConnected && s.isInternetReachable !== false;
      if (sekarang && !online) coba();
      online = sekarang;
    });
    const app = AppState.addEventListener('change', (st) => st === 'active' && coba());

    return () => {
      net.remove();
      app.remove();
    };
  }, [pemilik]);
}
