import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, pesanKegagalan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { bolehAkses, KERJAAN_LABEL, KERJAAN_URUT, labelRole, menuUntuk, type KerjaanId } from '@/lib/peran';
import { useApi } from '@/lib/useApi';
import { warna } from '@/theme';

type Ringkasan = {
  data: {
    antrean: Record<KerjaanId, number>;
    rekap?: { total: number; selesai: number; perlu_diproses: number; ditolak: number };
  };
};

const SKEMA_BARU: Record<string, 'TJP' | 'MPP'> = { jemput_pangan: 'TJP', makloon: 'MPP' };

export default function Dasbor() {
  const { user, logout } = useAuth();
  const role = user!.role.nama_role;
  const { data, error, loading, muatUlang } = useApi<Ringkasan>('/dashboard/ringkasan');
  const antrean = data?.data.antrean;
  const rekap = data?.data.rekap;
  const punyaAntrean = bolehAkses(role, '/transaksi');
  const [membuat, setMembuat] = useState(false);

  // Skema ditentukan server dari role pembuat (panduan 3.1), tanpa pilihan di UI.
  function buatTransaksi() {
    Alert.alert(`Buat transaksi ${SKEMA_BARU[role]} baru?`, 'Nomor transaksi langsung diterbitkan dan tidak bisa dihapus selain oleh admin.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Buat',
        onPress: async () => {
          setMembuat(true);
          try {
            const res = await api<{ data: { id_transaksi: string } }>('/transaksi', { method: 'POST' });
            void muatUlang();
            router.push({ pathname: '/detail', params: { id: res.data.id_transaksi } });
          } catch (e) {
            Alert.alert('Gagal membuat transaksi', pesanKegagalan(e));
          } finally {
            setMembuat(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={s.layar} refreshControl={<RefreshControl refreshing={loading} onRefresh={muatUlang} />}>
      <View style={s.kartu}>
        <Text style={s.label}>Masuk sebagai</Text>
        <Text style={s.nama}>{user?.nama_maklon ?? user?.username}</Text>
        <Text style={s.role}>{labelRole(role)}</Text>
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      {/* Admin & Keuangan melihat rekap seluruh transaksi (DashboardController::ringkasanRekap). */}
      {rekap && (
        <>
          <Text style={s.judul}>Rekap transaksi</Text>
          <View style={s.grid}>
            <Stat angka={rekap.total} label="Total" />
            <Stat angka={rekap.perlu_diproses} label="Sedang diproses" />
            <Stat angka={rekap.selesai} label="Selesai" />
            <Stat angka={rekap.ditolak} label="Pernah ditolak" bahaya />
          </View>
        </>
      )}

      {punyaAntrean && (
        <>
          <Text style={s.judul}>Menunggu tindakan Anda</Text>
          <View style={s.grid}>
            {KERJAAN_URUT.map((k) => (
              <Stat
                key={k}
                angka={antrean?.[k] ?? 0}
                label={KERJAAN_LABEL[k]}
                bahaya={k === 'ditolak'}
                onPress={() => router.push({ pathname: '/transaksi', params: { kerjaan: k } })}
              />
            ))}
          </View>
        </>
      )}

      {SKEMA_BARU[role] && (
        <Pressable style={[s.menu, s.buat, membuat && { opacity: 0.6 }]} disabled={membuat} onPress={buatTransaksi} accessibilityRole="button">
          <Text style={[s.menuLabel, { color: '#fff' }]}>{membuat ? 'Membuat...' : `+ Buat Transaksi ${SKEMA_BARU[role]}`}</Text>
          <Text style={{ color: '#ffffffcc', fontSize: 13 }}>Nomor transaksi dibuat otomatis oleh sistem</Text>
        </Pressable>
      )}

      <Text style={s.judul}>Menu</Text>
      {menuUntuk(role).map((m) => (
        <Link key={m.href} href={m.href} asChild>
          <Pressable style={s.menu} accessibilityRole="button">
            <Text style={s.menuLabel}>{m.label}</Text>
            <Text style={s.redup}>{m.keterangan}</Text>
          </Pressable>
        </Link>
      ))}
      <Text style={s.redup}>Kelola user, rekap, dan audit log tersedia di versi web.</Text>

      <Pressable style={s.keluar} onPress={logout} accessibilityRole="button">
        <Text style={{ color: warna.primary, fontWeight: '600' }}>Keluar</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ angka, label, bahaya, onPress }: { angka: number; label: string; bahaya?: boolean; onPress?: () => void }) {
  return (
    <Pressable style={s.stat} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={[s.angka, bahaya && angka > 0 && { color: warna.danger }]}>{angka}</Text>
      <Text style={s.redup}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  layar: { padding: 16, gap: 10 },
  kartu: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: warna.garis },
  label: { color: warna.teksRedup, fontSize: 13 },
  nama: { fontSize: 20, fontWeight: '600', color: warna.teks, marginTop: 2 },
  role: { color: warna.primary, marginTop: 4 },
  judul: { fontWeight: '600', color: warna.teks, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: warna.garis },
  angka: { fontSize: 24, fontWeight: '600', color: warna.primary },
  menu: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: warna.garis, borderLeftWidth: 4, borderLeftColor: warna.primary },
  buat: { backgroundColor: warna.primary, borderLeftColor: warna.primaryDark, marginTop: 8 },
  menuLabel: { fontWeight: '600', color: warna.teks, fontSize: 16 },
  redup: { color: warna.teksRedup, fontSize: 13 },
  error: { color: warna.danger, backgroundColor: warna.dangerBg, padding: 10, borderRadius: 8 },
  keluar: { marginTop: 12, borderWidth: 1, borderColor: warna.primary, borderRadius: 8, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
});
