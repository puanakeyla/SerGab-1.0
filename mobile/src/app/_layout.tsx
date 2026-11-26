import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useUnggahOtomatis } from '@/lib/foto';
import { bolehAkses } from '@/lib/peran';
import { warna } from '@/theme';

function Navigasi() {
  const { user, loading } = useAuth();
  const role = user?.role.nama_role;
  // Hanya role pengunggah foto yang menjalankan antrean unggah.
  useUnggahOtomatis(user && bolehAkses(role, '/foto') ? user.id : null);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: warna.surface }}>
        <ActivityIndicator color={warna.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: warna.primary },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: warna.surface },
      }}
    >
      {/* Proteksi ini hanya UX; otorisasi sebenarnya tetap di server (auth:sanctum + role). */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" options={{ title: 'SerGab Lampung' }} />
        {/* Detail terbuka untuk semua role yang login; server menyaring transaksi yang boleh dilihat. */}
        <Stack.Screen name="detail" options={{ title: 'Transaksi' }} />
        {/* Layar per role: tabel aksesnya di lib/peran.ts (dipakai juga oleh menu dasbor). */}
        <Stack.Protected guard={bolehAkses(role, '/transaksi')}>
          <Stack.Screen name="transaksi" options={{ title: 'Antrean Transaksi' }} />
        </Stack.Protected>
        <Stack.Protected guard={bolehAkses(role, '/foto')}>
          <Stack.Screen name="foto" options={{ title: 'Foto Transaksi' }} />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Navigasi />
    </AuthProvider>
  );
}
