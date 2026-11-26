import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { warna } from '@/theme';

export default function Beranda() {
  const { user, logout } = useAuth();

  return (
    <View style={s.layar}>
      <View style={s.kartu}>
        <Text style={s.label}>Masuk sebagai</Text>
        <Text style={s.nama}>{user?.nama_maklon ?? user?.username}</Text>
        <Text style={s.role}>{user?.role.nama_role.replace(/_/g, ' ')}</Text>
      </View>

      <Link href="/foto" asChild>
        <Pressable style={s.tombol} accessibilityRole="button">
          <Text style={s.tombolTeks}>Foto & antrean unggah</Text>
        </Pressable>
      </Link>

      <Pressable style={[s.tombol, s.tombolGaris]} onPress={logout} accessibilityRole="button">
        <Text style={[s.tombolTeks, { color: warna.primary }]}>Keluar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  layar: { flex: 1, padding: 16, gap: 12 },
  kartu: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: warna.garis },
  label: { color: warna.teksRedup, fontSize: 13 },
  nama: { fontSize: 20, fontWeight: '600', color: warna.teks, marginTop: 2 },
  role: { color: warna.primary, textTransform: 'capitalize', marginTop: 4 },
  tombol: { backgroundColor: warna.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  tombolGaris: { backgroundColor: '#fff', borderWidth: 1, borderColor: warna.primary },
  tombolTeks: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
