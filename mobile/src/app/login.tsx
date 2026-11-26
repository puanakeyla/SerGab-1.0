import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { pesanKegagalan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { warna } from '@/theme';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  async function masuk() {
    setProses(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(pesanKegagalan(e));
      setProses(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.layar} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.kartu}>
        <Text style={s.judul}>SerGab Lampung</Text>
        <Text style={s.sub}>Sistem Informasi Serap Gabah</Text>

        <TextInput
          style={s.input}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          accessibilityLabel="Username"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={masuk}
          accessibilityLabel="Password"
        />

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable
          style={[s.tombol, (proses || !username || !password) && { opacity: 0.6 }]}
          disabled={proses || !username || !password}
          onPress={masuk}
          accessibilityRole="button"
        >
          {proses ? <ActivityIndicator color="#fff" /> : <Text style={s.tombolTeks}>Masuk</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  layar: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: warna.primary },
  kartu: { backgroundColor: '#fff', borderRadius: 12, padding: 24, gap: 12 },
  judul: { fontSize: 22, fontWeight: '600', color: warna.primary },
  sub: { color: warna.teksRedup, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: warna.garis, borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: warna.danger, backgroundColor: warna.dangerBg, padding: 10, borderRadius: 8 },
  tombol: { backgroundColor: warna.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  tombolTeks: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
