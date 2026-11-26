import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/lib/auth';
import { warna } from '@/theme';

function Navigasi() {
  const { user, loading } = useAuth();

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
        <Stack.Screen name="foto" options={{ title: 'Foto Transaksi' }} />
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
