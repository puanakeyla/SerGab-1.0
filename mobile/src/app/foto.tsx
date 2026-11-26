import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { pesanKegagalan } from '@/lib/api';
import { ambilFoto, daftarAntrean, hapusDariAntrean, IzinDitolak, simpanLokal, unggah, type FotoLokal } from '@/lib/foto';
import { warna } from '@/theme';

// Layar fondasi: membuktikan alur izin → kamera/galeri → simpan lokal → unggah. Nanti dipanggil
// dari form tiap tahap dengan transaksiId & jenisFoto yang sudah pasti.
export default function Foto() {
  const [transaksiId, setTransaksiId] = useState('');
  const [jenisFoto, setJenisFoto] = useState('foto_gabah');
  const [antrean, setAntrean] = useState<FotoLokal[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muatUlang = () => daftarAntrean().then(setAntrean);
  useEffect(() => void muatUlang(), []);

  async function tambah(sumber: 'kamera' | 'galeri') {
    try {
      const asset = await ambilFoto(sumber);
      if (!asset) return;
      setSibuk('simpan');
      await simpanLokal(asset, transaksiId.trim(), jenisFoto.trim());
      await muatUlang();
    } catch (e) {
      if (e instanceof IzinDitolak) {
        Alert.alert(
          'Izin dibutuhkan',
          `SerGab butuh akses ${sumber} untuk melampirkan foto transaksi.`,
          e.bisaDimintaLagi
            ? [{ text: 'OK' }]
            : [{ text: 'Batal', style: 'cancel' }, { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() }],
        );
      } else {
        Alert.alert('Gagal menyimpan foto', String(e));
      }
    } finally {
      setSibuk(null);
    }
  }

  async function kirim(foto: FotoLokal) {
    setSibuk(foto.id);
    try {
      await unggah(foto);
      await muatUlang();
    } catch (e) {
      Alert.alert('Gagal mengunggah', `${pesanKegagalan(e)}\nFoto tetap tersimpan di HP.`);
    } finally {
      setSibuk(null);
    }
  }

  const siap = transaksiId.trim() !== '' && jenisFoto.trim() !== '' && !sibuk;

  return (
    <FlatList
      contentContainerStyle={s.layar}
      data={antrean}
      keyExtractor={(f) => f.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 8 }}>
          <TextInput style={s.input} placeholder="ID transaksi, mis. 00001/01/2026/TJP" autoCapitalize="characters" value={transaksiId} onChangeText={setTransaksiId} />
          <TextInput style={s.input} placeholder="Jenis foto, mis. foto_gabah" autoCapitalize="none" value={jenisFoto} onChangeText={setJenisFoto} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={[s.tombol, !siap && s.mati]} disabled={!siap} onPress={() => tambah('kamera')}>
              <Text style={s.tombolTeks}>Kamera</Text>
            </Pressable>
            <Pressable style={[s.tombol, !siap && s.mati]} disabled={!siap} onPress={() => tambah('galeri')}>
              <Text style={s.tombolTeks}>Galeri</Text>
            </Pressable>
          </View>
          <Text style={s.judul}>Antrean unggah ({antrean.length})</Text>
        </View>
      }
      ListEmptyComponent={<Text style={s.redup}>Belum ada foto yang menunggu diunggah.</Text>}
      renderItem={({ item }) => (
        <View style={s.baris}>
          <Image source={{ uri: item.uri }} style={s.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={s.teks}>{item.jenisFoto}</Text>
            <Text style={s.redup}>{item.transaksiId}</Text>
          </View>
          <Pressable style={[s.kecil, !!sibuk && s.mati]} disabled={!!sibuk} onPress={() => kirim(item)}>
            <Text style={s.tombolTeks}>{sibuk === item.id ? '...' : 'Unggah'}</Text>
          </Pressable>
          <Pressable
            style={[s.kecil, s.hapus, !!sibuk && s.mati]}
            disabled={!!sibuk}
            onPress={() => hapusDariAntrean(item.id).then(muatUlang)}
            accessibilityLabel="Hapus foto"
          >
            <Text style={[s.tombolTeks, { color: warna.danger }]}>Hapus</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  layar: { padding: 16, gap: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: warna.garis, borderRadius: 8, padding: 12, fontSize: 16 },
  tombol: { flex: 1, backgroundColor: warna.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  tombolTeks: { color: '#fff', fontWeight: '600' },
  mati: { opacity: 0.5 },
  judul: { fontWeight: '600', color: warna.teks, marginTop: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: warna.garis },
  thumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: warna.primaryTint },
  teks: { color: warna.teks, fontWeight: '500' },
  redup: { color: warna.teksRedup, fontSize: 13 },
  kecil: { backgroundColor: warna.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  hapus: { backgroundColor: warna.dangerBg },
});
