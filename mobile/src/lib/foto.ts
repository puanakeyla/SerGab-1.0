import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import Storage from 'expo-sqlite/kv-store';
import { api } from './api';

/** Foto yang sudah dikompres & disimpan di HP, menunggu diunggah (sinyal lapangan sering putus). */
export type FotoLokal = {
  id: string;
  uri: string;
  transaksiId: string;
  jenisFoto: string;
  dibuatPada: string;
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
): Promise<FotoLokal> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > SISI_MAKS) {
    ctx.resize(asset.width >= asset.height ? { width: SISI_MAKS } : { height: SISI_MAKS });
  }
  const terkompres = await (await ctx.renderAsync()).saveAsync({ compress: KUALITAS, format: SaveFormat.JPEG });

  if (!folder.exists) folder.create();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tujuan = new File(folder, `${id}.jpg`);
  new File(terkompres.uri).move(tujuan);

  const foto: FotoLokal = { id, uri: tujuan.uri, transaksiId, jenisFoto, dibuatPada: new Date().toISOString() };
  await tulisAntrean([...(await daftarAntrean()), foto]);
  return foto;
}

export async function daftarAntrean(): Promise<FotoLokal[]> {
  return JSON.parse((await Storage.getItem(KUNCI_ANTREAN)) ?? '[]');
}

async function tulisAntrean(list: FotoLokal[]) {
  await Storage.setItem(KUNCI_ANTREAN, JSON.stringify(list));
}

export async function hapusDariAntrean(id: string) {
  const list = await daftarAntrean();
  const foto = list.find((f) => f.id === id);
  if (foto) {
    const file = new File(foto.uri);
    if (file.exists) file.delete();
  }
  await tulisAntrean(list.filter((f) => f.id !== id));
}

/** Unggah satu foto antrean; berkas lokal baru dihapus setelah server menerimanya. */
export async function unggah(foto: FotoLokal) {
  const form = new FormData();
  form.append('jenis_foto', foto.jenisFoto);
  // Bentuk {uri, name, type} adalah cara React Native melampirkan berkas ke multipart.
  form.append('foto', { uri: foto.uri, name: `${foto.jenisFoto}.jpg`, type: 'image/jpeg' } as unknown as Blob);
  await api(`/transaksi/${encodeURIComponent(foto.transaksiId)}/foto`, { method: 'POST', body: form });
  await hapusDariAntrean(foto.id);
}
