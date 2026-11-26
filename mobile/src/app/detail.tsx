import { randomUUID } from 'expo-crypto';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import FormTahap, { Tombol } from '@/components/FormTahap';
import { api, pesanKegagalan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { aksiUntuk, FOTO_LABEL, STATUS_LABEL, URUTAN, type DataBlok, type Tahap, type Transaksi } from '@/lib/tahap';
import { useApi } from '@/lib/useApi';
import { warna } from '@/theme';

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth().user!;
  const role = user.role.nama_role;
  const { data, error, loading, muatUlang } = useApi<{ data: Transaksi }>(`/transaksi/${encodeURIComponent(id)}`);
  const t = data?.data;
  const aksi = t ? aksiUntuk(t, role) : null;
  const kini = t ? URUTAN[t.skema].find((x) => x.role === t.current_stage) : undefined;

  return (
    <ScrollView contentContainerStyle={s.layar} refreshControl={<RefreshControl refreshing={loading} onRefresh={muatUlang} />}>
      <Stack.Screen options={{ title: id }} />
      {error && <Text style={s.error}>{error}</Text>}

      {t && (
        <>
          <View style={s.kartu}>
            <Text style={s.id}>{t.id_transaksi}</Text>
            <Text style={s.redup}>
              Skema {t.skema} · {t.status_keseluruhan === 'berjalan' ? `di tahap ${kini?.label ?? t.current_stage}` : t.status_keseluruhan}
            </Text>
          </View>

          {aksi?.mode === 'isi' && (
            <FormTahap
              key={`${aksi.tahap.role}-${t[aksi.tahap.blok!]?.status ?? 'baru'}-${String(t[aksi.tahap.blok!]?.updated_at ?? '')}`}
              transaksi={t}
              tahap={aksi.tahap}
              userId={user.id}
              onBerubah={muatUlang}
            />
          )}
          {aksi?.mode === 'periksa' && <PanelPeriksa transaksi={t} tahap={aksi.tahap} onBerubah={muatUlang} />}
          {aksi?.mode === 'web' && (
            <Text style={s.info}>Pekerjaan {aksi.tahap.label} dilakukan per PO (gabungan transaksi) di versi web.</Text>
          )}
          {aksi?.mode === 'lihat' && t.status_keseluruhan === 'berjalan' && (
            <Text style={s.info}>Bukan giliran Anda. Transaksi sedang di tahap {kini?.label ?? t.current_stage}.</Text>
          )}

          <Text style={s.judul}>Alur tahap</Text>
          {URUTAN[t.skema].map((tahap) => (
            <KartuTahap key={tahap.role} tahap={tahap} blok={tahap.blok ? t[tahap.blok] : null} aktif={tahap.role === t.current_stage} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function KartuTahap({ tahap, blok, aktif }: { tahap: Tahap; blok: DataBlok | undefined; aktif: boolean }) {
  const [buka, setBuka] = useState(false);
  const bisaDibuka = !!blok && tahap.fields.length > 0;

  return (
    <Pressable
      style={[s.tahap, aktif && { borderColor: warna.primary, borderWidth: 2 }, !blok && !aktif && { opacity: 0.6 }]}
      onPress={() => bisaDibuka && setBuka((b) => !b)}
      accessibilityRole={bisaDibuka ? 'button' : undefined}
      accessibilityState={bisaDibuka ? { expanded: buka } : undefined}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[s.tahapLabel, { flex: 1 }]}>{tahap.label}</Text>
        {aktif && <Text style={s.badge}>Tahap saat ini</Text>}
        {blok && <Text style={[s.badge, blok.status === 'ditolak' && s.badgeBahaya]}>{STATUS_LABEL[blok.status] ?? blok.status}</Text>}
      </View>
      {blok?.status === 'ditolak' && blok.catatan_penolakan && <Text style={s.tolak}>Catatan: {blok.catatan_penolakan}</Text>}
      {buka && blok && <IsiBlok tahap={tahap} blok={blok} />}
    </Pressable>
  );
}

function IsiBlok({ tahap, blok }: { tahap: Tahap; blok: NonNullable<DataBlok> }) {
  return (
    <View style={{ gap: 4, marginTop: 6 }}>
      {tahap.fields.map((fl) => {
        const mentah = fl.tipe === 'makloon' ? blok.nama_makloon_tujuan : blok[fl.key];
        const tampil = mentah === null || mentah === undefined || mentah === '' ? '-' : String(mentah).slice(0, fl.tipe === 'tanggal' ? 10 : undefined);
        return (
          <View key={fl.key} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[s.redup, { flex: 1 }]}>{fl.label}</Text>
            <Text style={[s.nilai, { flex: 1 }]}>{tampil}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Terima/Tolak data tahap sebelumnya. Keduanya tidak bisa dibatalkan, jadi selalu dikonfirmasi. */
function PanelPeriksa({ transaksi, tahap, onBerubah }: { transaksi: Transaksi; tahap: Tahap; onBerubah: () => void }) {
  const id = encodeURIComponent(transaksi.id_transaksi);
  const blok = transaksi[tahap.blok!]!;
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const kunci = useRef(randomUUID());
  const foto = useApi<{ data: { jenis_foto: string }[] }>(`/transaksi/${id}/foto`);
  const fotoTahap = (foto.data?.data ?? []).filter((x) => tahap.foto.includes(x.jenis_foto));

  async function kirim(jenis: 'terima' | 'tolak') {
    setProses(true);
    try {
      await api(`/transaksi/${id}/${jenis}`, {
        method: 'POST',
        body: jenis === 'tolak' ? { catatan: catatan.trim() } : undefined,
        idempotencyKey: kunci.current,
      });
      kunci.current = randomUUID();
      Alert.alert(
        jenis === 'terima' ? 'Diterima' : 'Ditolak',
        jenis === 'terima' ? `Data ${tahap.label} dikunci. Lanjutkan dengan mengisi data tahap Anda.` : `Transaksi dikembalikan ke ${tahap.label} untuk diperbaiki.`,
      );
      onBerubah();
    } catch (e) {
      Alert.alert('Gagal', pesanKegagalan(e));
    } finally {
      setProses(false);
    }
  }

  async function bukaFoto(jenis: string) {
    try {
      const { url } = await api<{ url: string }>(`/transaksi/${id}/foto/${jenis}`);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Foto tidak bisa dibuka', pesanKegagalan(e));
    }
  }

  return (
    <View style={s.periksa}>
      <Text style={s.judul}>Periksa data {tahap.label}</Text>
      <IsiBlok tahap={tahap} blok={blok} />

      <Text style={[s.redup, { marginTop: 6 }]}>Dokumen ({fotoTahap.length}/{tahap.foto.length})</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {fotoTahap.map((x) => (
          <Tombol key={x.jenis_foto} kecil garis label={FOTO_LABEL[x.jenis_foto] ?? x.jenis_foto} onPress={() => bukaFoto(x.jenis_foto)} />
        ))}
      </View>

      <Tombol
        label="Terima & kunci"
        mati={proses}
        onPress={() =>
          Alert.alert('Terima data?', `Data ${tahap.label} akan dikunci dan tidak bisa diubah lagi.`, [
            { text: 'Batal', style: 'cancel' },
            { text: 'Terima', onPress: () => kirim('terima') },
          ])
        }
      />

      <TextInput
        style={s.input}
        value={catatan}
        onChangeText={setCatatan}
        placeholder="Alasan penolakan (wajib untuk menolak)"
        multiline
        accessibilityLabel="Catatan penolakan"
      />
      <Tombol
        bahaya
        garis
        label="Tolak & kembalikan"
        mati={proses || !catatan.trim()}
        onPress={() =>
          Alert.alert('Tolak data?', `Transaksi dikembalikan ke ${tahap.label} untuk diperbaiki.`, [
            { text: 'Batal', style: 'cancel' },
            { text: 'Tolak', style: 'destructive', onPress: () => kirim('tolak') },
          ])
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  layar: { padding: 16, gap: 10 },
  kartu: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: warna.garis },
  id: { fontSize: 18, fontWeight: '600', color: warna.teks },
  judul: { fontWeight: '600', color: warna.teks, fontSize: 16, marginTop: 4 },
  redup: { color: warna.teksRedup, fontSize: 13 },
  nilai: { color: warna.teks, fontSize: 13, fontWeight: '500' },
  info: { color: warna.primary, backgroundColor: warna.primaryTint, padding: 12, borderRadius: 8 },
  error: { color: warna.danger, backgroundColor: warna.dangerBg, padding: 10, borderRadius: 8 },
  tolak: { color: warna.danger, fontSize: 13, marginTop: 4 },
  tahap: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: warna.garis },
  tahapLabel: { fontWeight: '600', color: warna.teks },
  badge: { fontSize: 11, color: warna.primary, backgroundColor: warna.primaryTint, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6, overflow: 'hidden' },
  badgeBahaya: { color: warna.danger, backgroundColor: warna.dangerBg },
  periksa: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, borderWidth: 2, borderColor: warna.primary },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 8, padding: 10, fontSize: 15, minHeight: 70, textAlignVertical: 'top' },
});
