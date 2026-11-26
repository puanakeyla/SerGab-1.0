import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, pesanKegagalan } from '@/lib/api';
import { ambilFoto, daftarAntrean, IzinDitolak, pantauAntrean, simpanLokal, unggahSemua, type FotoLokal } from '@/lib/foto';
import { LAMPUNG_KABUPATEN } from '@/lib/kabupaten';
import { fieldKosong, FOTO_LABEL, kePayload, type Tahap, type Transaksi } from '@/lib/tahap';
import { useApi } from '@/lib/useApi';
import { warna } from '@/theme';

type Props = { transaksi: Transaksi; tahap: Tahap; userId: number; onBerubah: () => void };
type Makloon = { id: number; nama_maklon: string; kecamatan: string | null; kabupaten: string | null };

const hariIni = () => new Date().toISOString().slice(0, 10);

/**
 * Form satu tahap. Urutannya mengikuti aturan server: foto hanya bisa diunggah setelah data
 * tahap ada (Simpan draft dulu), dan Kirim menuntut semua field + semua foto tahap ini.
 */
export default function FormTahap({ transaksi, tahap, userId, onBerubah }: Props) {
  const id = transaksi.id_transaksi;
  const blok = transaksi[tahap.blok!];
  const sudahAdaDiServer = !!blok;

  const [nilai, setNilai] = useState<Record<string, string>>(() => {
    const awal: Record<string, string> = {};
    for (const fl of tahap.fields) {
      const v = blok?.[fl.key];
      awal[fl.key] = v === null || v === undefined ? (fl.tipe === 'tanggal' ? hariIni() : '') : String(v).slice(0, fl.tipe === 'tanggal' ? 10 : undefined);
    }
    return awal;
  });
  const [proses, setProses] = useState<'draft' | 'kirim' | null>(null);
  // Kunci tetap untuk satu aksi Kirim: percobaan ulang (mis. sinyal putus) memakai kunci sama.
  const kunciKirim = useRef(randomUUID());

  const butuhMakloon = tahap.fields.some((fl) => fl.tipe === 'makloon');
  const makloon = useApi<{ data: Makloon[] }>(butuhMakloon ? '/makloon-options' : null);

  const fotoServer = useApi<{ data: { jenis_foto: string }[] }>(sudahAdaDiServer ? `/transaksi/${encodeURIComponent(id)}/foto` : null);
  const terunggah = new Set(fotoServer.data?.data.map((x) => x.jenis_foto));
  const [antrean, setAntrean] = useState<FotoLokal[]>([]);

  useEffect(() => {
    let jumlahLama = -1;
    const muat = () =>
      void daftarAntrean(userId).then((list) => {
        const milik = list.filter((x) => x.transaksiId === id);
        // Antrean berkurang = ada foto yang baru diterima server: segarkan status foto.
        if (milik.length < jumlahLama) void fotoServer.muatUlang();
        jumlahLama = milik.length;
        setAntrean(milik);
      });
    muat();
    return pantauAntrean(muat);
  }, [id, userId, fotoServer.muatUlang]);

  const ubah = (key: string, v: string) => setNilai((n) => ({ ...n, [key]: v }));

  async function simpan(aksi: 'draft' | 'submit') {
    setProses(aksi === 'draft' ? 'draft' : 'kirim');
    try {
      await api(`/transaksi/${encodeURIComponent(id)}/${tahap.endpoint}`, {
        method: 'PATCH',
        body: { aksi, ...kePayload(tahap, nilai) },
        idempotencyKey: aksi === 'submit' ? kunciKirim.current : undefined,
      });
      if (aksi === 'submit') {
        kunciKirim.current = randomUUID();
        Alert.alert('Terkirim', `Data ${tahap.label} dikirim ke tahap berikutnya untuk diperiksa.`);
      }
      onBerubah();
    } catch (e) {
      Alert.alert(aksi === 'draft' ? 'Gagal menyimpan draft' : 'Gagal mengirim', pesanKegagalan(e));
    } finally {
      setProses(null);
    }
  }

  function kirim() {
    const kosong = fieldKosong(tahap, nilai);
    const fotoKurang = tahap.foto.filter((j) => !terunggah.has(j));
    if (kosong.length || fotoKurang.length) {
      const bagian = [
        kosong.length ? `Field: ${kosong.map((x) => x.label).join(', ')}` : '',
        fotoKurang.length ? `Foto: ${fotoKurang.map((j) => FOTO_LABEL[j] ?? j).join(', ')}` : '',
      ].filter(Boolean);
      Alert.alert('Belum lengkap', `${bagian.join('\n')}${antrean.length ? '\n\nSebagian foto masih di antrean unggah.' : ''}`);
      return;
    }
    Alert.alert('Kirim data?', 'Setelah dikirim, data dan foto tahap ini tidak bisa diubah kecuali ditolak oleh tahap berikutnya.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Kirim', onPress: () => simpan('submit') },
    ]);
  }

  async function tambahFoto(jenis: string, sumber: 'kamera' | 'galeri') {
    try {
      const asset = await ambilFoto(sumber);
      if (!asset) return;
      await simpanLokal(asset, id, jenis, userId);
      void unggahSemua(userId);
    } catch (e) {
      if (e instanceof IzinDitolak) {
        Alert.alert(
          'Izin dibutuhkan',
          `SerGab butuh akses ${sumber} untuk melampirkan foto.`,
          e.bisaDimintaLagi ? [{ text: 'OK' }] : [{ text: 'Batal', style: 'cancel' }, { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() }],
        );
      } else {
        Alert.alert('Gagal menyimpan foto', String(e));
      }
    }
  }

  return (
    <View style={s.kotak}>
      <Text style={s.judul}>Isi data {tahap.label}</Text>
      {blok?.status === 'ditolak' && (
        <Text style={s.tolak}>Ditolak: {blok.catatan_penolakan ?? 'tanpa catatan'}. Perbaiki lalu kirim ulang.</Text>
      )}

      {tahap.fields.map((fl) => (
        <View key={fl.key} style={{ gap: 4 }}>
          <Text style={s.label}>{fl.label}</Text>
          {fl.tipe === 'kabupaten' ? (
            <Pilihan opsi={LAMPUNG_KABUPATEN.map((k) => ({ nilai: k, label: k }))} terpilih={nilai[fl.key]} onPilih={(v) => ubah(fl.key, v)} />
          ) : fl.tipe === 'makloon' ? (
            makloon.loading ? (
              <ActivityIndicator color={warna.primary} />
            ) : (
              <PilihMakloon daftar={makloon.data?.data ?? []} terpilih={nilai[fl.key]} onPilih={(v) => ubah(fl.key, v)} />
            )
          ) : (
            <TextInput
              style={s.input}
              value={nilai[fl.key]}
              onChangeText={(v) => ubah(fl.key, v)}
              placeholder={fl.tipe === 'tanggal' ? 'TTTT-BB-HH' : undefined}
              keyboardType={fl.tipe === 'angka' ? 'number-pad' : fl.tipe === 'desimal' ? 'decimal-pad' : 'default'}
              autoCapitalize={fl.key === 'plat_mobil' ? 'characters' : 'words'}
              accessibilityLabel={fl.label}
            />
          )}
        </View>
      ))}

      <Text style={[s.judul, { marginTop: 8 }]}>Dokumen foto</Text>
      {!sudahAdaDiServer && <Text style={s.info}>Simpan draft dulu, setelah itu foto bisa ditambahkan.</Text>}
      {tahap.foto.map((jenis) => {
        const diAntrean = antrean.find((x) => x.jenisFoto === jenis);
        const status = diAntrean?.gagal ? `Ditolak server: ${diAntrean.gagal}` : diAntrean ? 'Menunggu diunggah' : terunggah.has(jenis) ? 'Terunggah ✓' : 'Belum ada';
        return (
          <View key={jenis} style={s.foto}>
            <View style={{ flex: 1 }}>
              <Text style={s.fotoLabel}>{FOTO_LABEL[jenis] ?? jenis}</Text>
              <Text style={[s.redup, terunggah.has(jenis) && !diAntrean && { color: '#1E6B4F' }, diAntrean?.gagal ? { color: warna.danger } : null]}>{status}</Text>
            </View>
            <Tombol kecil label="Kamera" mati={!sudahAdaDiServer} onPress={() => tambahFoto(jenis, 'kamera')} />
            <Tombol kecil garis label="Galeri" mati={!sudahAdaDiServer} onPress={() => tambahFoto(jenis, 'galeri')} />
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Tombol garis label={proses === 'draft' ? 'Menyimpan...' : 'Simpan draft'} mati={!!proses} onPress={() => simpan('draft')} />
        <Tombol label={proses === 'kirim' ? 'Mengirim...' : 'Kirim'} mati={!!proses || !sudahAdaDiServer} onPress={kirim} />
      </View>
    </View>
  );
}

function Pilihan({ opsi, terpilih, onPilih }: { opsi: { nilai: string; label: string }[]; terpilih: string; onPilih: (v: string) => void }) {
  return (
    <View style={s.chips}>
      {opsi.map((o) => (
        <Pressable
          key={o.nilai}
          style={[s.chip, terpilih === o.nilai && s.chipAktif]}
          onPress={() => onPilih(o.nilai)}
          accessibilityRole="button"
          accessibilityState={{ selected: terpilih === o.nilai }}
        >
          <Text style={[s.chipTeks, terpilih === o.nilai && { color: '#fff' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Daftar makloon bisa puluhan, jadi dicari dulu (setara MakloonCombobox di web). */
function PilihMakloon({ daftar, terpilih, onPilih }: { daftar: Makloon[]; terpilih: string; onPilih: (v: string) => void }) {
  const [cari, setCari] = useState('');
  const dipilih = daftar.find((m) => String(m.id) === terpilih);
  const hasil = daftar.filter((m) => m.nama_maklon.toLowerCase().includes(cari.trim().toLowerCase())).slice(0, 8);

  return (
    <View style={{ gap: 6 }}>
      {dipilih && <Text style={s.info}>Terpilih: {dipilih.nama_maklon}</Text>}
      <TextInput style={s.input} value={cari} onChangeText={setCari} placeholder={`Cari dari ${daftar.length} makloon terdaftar`} accessibilityLabel="Cari makloon" />
      {cari.trim() !== '' && (
        <Pilihan
          opsi={hasil.map((m) => ({ nilai: String(m.id), label: m.kabupaten ? `${m.nama_maklon} · ${m.kabupaten}` : m.nama_maklon }))}
          terpilih={terpilih}
          onPilih={(v) => {
            onPilih(v);
            setCari('');
          }}
        />
      )}
    </View>
  );
}

export function Tombol({ label, onPress, mati, garis, kecil, bahaya }: { label: string; onPress: () => void; mati?: boolean; garis?: boolean; kecil?: boolean; bahaya?: boolean }) {
  const warnaUtama = bahaya ? warna.danger : warna.primary;
  return (
    <Pressable
      style={[
        kecil ? s.tombolKecil : s.tombol,
        { backgroundColor: garis ? '#fff' : warnaUtama, borderColor: warnaUtama },
        mati && { opacity: 0.5 },
      ]}
      disabled={mati}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={{ color: garis ? warnaUtama : '#fff', fontWeight: '600', fontSize: kecil ? 13 : 15 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  kotak: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, borderWidth: 2, borderColor: warna.primary },
  judul: { fontWeight: '600', color: warna.teks, fontSize: 16 },
  label: { color: warna.teksRedup, fontSize: 13 },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#fff' },
  tolak: { color: warna.danger, backgroundColor: warna.dangerBg, padding: 10, borderRadius: 8 },
  info: { color: warna.primary, backgroundColor: warna.primaryTint, padding: 10, borderRadius: 8 },
  redup: { color: warna.teksRedup, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: warna.garis, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  chipAktif: { backgroundColor: warna.primary, borderColor: warna.primary },
  chipTeks: { color: warna.teks, fontSize: 13 },
  foto: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: warna.garis, paddingTop: 8 },
  fotoLabel: { color: warna.teks, fontWeight: '500' },
  tombol: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  tombolKecil: { borderWidth: 1, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10 },
});
