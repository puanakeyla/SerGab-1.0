import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, pesanKegagalan } from '@/lib/api';
import { KERJAAN_LABEL, KERJAAN_URUT, STAGE_LABEL, type KerjaanId } from '@/lib/peran';
import { warna } from '@/theme';

type Item = { id_transaksi: string; skema: 'TJP' | 'MPP'; current_stage: string; kerjaan?: KerjaanId };
type Halaman = { data: Item[]; meta: { current_page: number; last_page: number; total: number } };

// Antrean kerja role yang login: server sudah menyaring ke tahap & visibilitas milik user
// (Transaksi::antreanRole + terlihatOleh), jadi layar ini cukup menampilkan apa adanya.
export default function Antrean() {
  const { kerjaan } = useLocalSearchParams<{ kerjaan?: KerjaanId }>();
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<Halaman['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Respons milik filter lama (filter diganti saat masih memuat) dibuang, jangan dicampur.
  const permintaan = useRef(0);

  async function muat(page: number) {
    const ke = ++permintaan.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '20' });
      if (kerjaan) q.set('kerjaan', kerjaan);
      const res = await api<Halaman>(`/transaksi?${q}`);
      if (ke !== permintaan.current) return;
      setItems((lama) => (page === 1 ? res.data : [...lama, ...res.data]));
      setMeta(res.meta);
      setError(null);
    } catch (e) {
      if (ke === permintaan.current) setError(pesanKegagalan(e));
    } finally {
      if (ke === permintaan.current) setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]);
    void muat(1);
  }, [kerjaan]);

  const masihAda = !!meta && meta.current_page < meta.last_page;

  return (
    <FlatList
      contentContainerStyle={s.layar}
      data={items}
      keyExtractor={(t) => t.id_transaksi}
      refreshing={loading && items.length === 0}
      onRefresh={() => muat(1)}
      onEndReached={() => masihAda && !loading && muat(meta!.current_page + 1)}
      ListHeaderComponent={
        <View style={{ gap: 8, marginBottom: 4 }}>
          <View style={s.chips}>
            <Chip aktif={!kerjaan} label="Semua" onPress={() => router.setParams({ kerjaan: undefined })} />
            {KERJAAN_URUT.map((k) => (
              <Chip key={k} aktif={kerjaan === k} label={KERJAAN_LABEL[k]} onPress={() => router.setParams({ kerjaan: k })} />
            ))}
          </View>
          {meta && <Text style={s.redup}>{meta.total} transaksi</Text>}
          {error && <Text style={s.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={!loading ? <Text style={s.redup}>Tidak ada transaksi yang menunggu tindakan Anda.</Text> : undefined}
      ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator color={warna.primary} /> : undefined}
      renderItem={({ item }) => (
        <Pressable
          style={s.baris}
          onPress={() => router.push({ pathname: '/detail', params: { id: item.id_transaksi } })}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={s.id}>{item.id_transaksi}</Text>
            <Text style={s.redup}>
              Skema {item.skema} · {STAGE_LABEL[item.current_stage] ?? item.current_stage}
            </Text>
          </View>
          {item.kerjaan && (
            <Text style={[s.badge, item.kerjaan === 'ditolak' && s.badgeBahaya]}>{KERJAAN_LABEL[item.kerjaan]}</Text>
          )}
        </Pressable>
      )}
    />
  );
}

function Chip({ label, aktif, onPress }: { label: string; aktif: boolean; onPress: () => void }) {
  return (
    <Pressable style={[s.chip, aktif && s.chipAktif]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: aktif }}>
      <Text style={[s.chipTeks, aktif && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  layar: { padding: 16, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: warna.garis, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipAktif: { backgroundColor: warna.primary, borderColor: warna.primary },
  chipTeks: { color: warna.teks, fontSize: 13 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: warna.garis },
  id: { fontWeight: '600', color: warna.teks },
  redup: { color: warna.teksRedup, fontSize: 13 },
  badge: { fontSize: 12, color: warna.primary, backgroundColor: warna.primaryTint, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden' },
  badgeBahaya: { color: warna.danger, backgroundColor: warna.dangerBg },
  error: { color: warna.danger, backgroundColor: warna.dangerBg, padding: 10, borderRadius: 8 },
});
