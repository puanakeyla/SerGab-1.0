import { randomUUID } from 'expo-crypto';

// Emulator Android menjangkau localhost PC lewat 10.0.2.2. HP fisik: isi EXPO_PUBLIC_API_URL
// di mobile/.env dengan IP LAN PC, mis. http://192.168.1.10:8000
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

let token: string | null = null;
let onUnauthorized: () => void = () => {};

export function setToken(value: string | null) {
  token = value;
}

export function setOnUnauthorized(handler: () => void) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: any,
  ) {
    super(data?.message ?? `HTTP ${status}`);
  }
}

type Opsi = Omit<RequestInit, 'body'> & {
  body?: object | FormData;
  /** Kunci tetap untuk satu aksi simpan. Kirim nilai yang SAMA saat mengulang, supaya server bisa menolak duplikat. */
  idempotencyKey?: string;
};

const METODE_SIMPAN = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** Panggil endpoint `/api{path}`. Body objek dikirim sebagai JSON, FormData apa adanya. */
export async function api<T = any>(path: string, { body, headers, idempotencyKey, ...init }: Opsi = {}): Promise<T> {
  const h = new Headers(headers);
  h.set('Accept', 'application/json');
  if (token) h.set('Authorization', `Bearer ${token}`);
  if (METODE_SIMPAN.includes((init.method ?? 'GET').toUpperCase())) {
    h.set('Idempotency-Key', idempotencyKey ?? randomUUID());
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body) {
    h.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers: h, body: payload });
  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Pesan yang bisa dibaca pengguna; padanan pesanKegagalan() di frontend web. */
export function pesanKegagalan(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Tidak bisa terhubung ke server. Periksa koneksi internet.';
  if (error.status === 422) {
    const pertama = Object.values(error.data?.errors ?? {})[0] as string[] | undefined;
    return pertama?.[0] ?? error.message;
  }
  if (error.status === 403) return 'Akun Anda tidak punya akses ke data ini. Hubungi admin bila seharusnya punya.';
  if (error.status === 401) return 'Sesi Anda sudah berakhir. Silakan masuk kembali.';
  if (error.status >= 500) return 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
  return error.message;
}
