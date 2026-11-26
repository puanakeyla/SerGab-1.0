<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header Idempotency-Key: aplikasi mobile mengirim key yang SAMA saat mengulang satu aksi simpan
 * (mobile/src/lib/api.ts, antrean foto di mobile/src/lib/foto.ts). Key yang sudah berhasil
 * diproses tidak diproses ulang -- respons pertama dikembalikan apa adanya.
 *
 * Hanya respons 2xx yang disimpan, karena hanya itu yang mengubah data. Respons gagal melepas
 * key-nya lagi, sehingga pengulangan dengan key yang sama diproses ulang (dan, untuk 4xx,
 * menghasilkan penolakan yang sama).
 *
 * Kode status disesuaikan dengan mobile, yang menganggap semua 4xx selain 401/408/429 sebagai
 * gagal permanen: request kembar yang datang selagi request pertama masih berjalan dijawab 429
 * + Retry-After agar mobile mencoba lagi, bukan menandai fotonya gagal.
 *
 * Request tanpa header (frontend web) diteruskan seperti biasa.
 */
class VerifikasiIdempotencyKey
{
    private const BERLAKU_JAM = 24;

    // Reservasi yang tidak pernah diselesaikan (proses PHP mati di tengah jalan) dianggap
    // ditinggalkan setelah selang ini, supaya key-nya tidak terkunci selamanya.
    private const RESERVASI_BASI_DETIK = 120;

    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');
        $user = $request->user();

        if ($key === null || ! $user || $request->isMethodSafe()) {
            return $next($request);
        }

        if ($key === '' || strlen($key) > 100) {
            return $this->tolak(422, 'Idempotency-Key harus 1-100 karakter.');
        }

        $hash = $this->hashRequest($request);
        $tersimpan = $this->reservasi($user->id, $key, $request, $hash);

        if ($tersimpan) {
            if (! hash_equals($tersimpan->request_hash, $hash)) {
                return $this->tolak(422, 'Idempotency-Key ini sudah dipakai untuk permintaan lain.');
            }

            if ($tersimpan->status_code === null) {
                return $this->tolak(429, 'Permintaan yang sama masih diproses.')->header('Retry-After', '2');
            }

            return response($tersimpan->response_body, $tersimpan->status_code)
                ->header('Content-Type', 'application/json')
                ->header('Idempotent-Replayed', 'true');
        }

        $response = $next($request);

        $baris = DB::table('idempotency_keys')->where('user_id', $user->id)->where('key', $key);
        if ($response->isSuccessful()) {
            $baris->update([
                'status_code' => $response->getStatusCode(),
                'response_body' => $response->getContent(),
                'updated_at' => now(),
            ]);
        } else {
            $baris->delete();
        }

        return $response;
    }

    /**
     * Klaim key secara atomik lewat unique (user_id, key). null = klaim berhasil, request ini
     * yang memproses. Selain itu kembalikan baris pemilik key sebelumnya.
     */
    private function reservasi(int $userId, string $key, Request $request, string $hash): ?object
    {
        for ($percobaan = 0; $percobaan < 2; $percobaan++) {
            try {
                DB::table('idempotency_keys')->insert([
                    'user_id' => $userId,
                    'key' => $key,
                    'method' => $request->method(),
                    'path' => $request->path(),
                    'request_hash' => $hash,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return null;
            } catch (UniqueConstraintViolationException) {
                $lama = DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->first();
                if (! $lama) {
                    continue; // baru saja dilepas request lain; coba klaim lagi
                }

                $kedaluwarsa = $lama->status_code !== null
                    && now()->subHours(self::BERLAKU_JAM)->gt($lama->created_at);
                $basi = $lama->status_code === null
                    && now()->subSeconds(self::RESERVASI_BASI_DETIK)->gt($lama->updated_at);

                if (! $kedaluwarsa && ! $basi) {
                    return $lama;
                }

                DB::table('idempotency_keys')->where('id', $lama->id)->delete();
            }
        }

        // Masih berebut dengan request kembar setelah dua kali coba: anggap sedang diproses.
        return DB::table('idempotency_keys')->where('user_id', $userId)->where('key', $key)->first()
            ?? (object) ['request_hash' => $hash, 'status_code' => null];
    }

    /** Sidik jari method + path + isi body, termasuk isi berkas foto (multipart). */
    private function hashRequest(Request $request): string
    {
        $berkas = array_map(
            fn ($f) => $f instanceof UploadedFile ? hash_file('sha256', $f->getRealPath()) : null,
            $request->allFiles()
        );

        return hash('sha256', json_encode([
            $request->method(),
            $request->path(),
            $request->except(array_keys($berkas)),
            $berkas,
        ]));
    }

    private function tolak(int $status, string $pesan): JsonResponse
    {
        return response()->json([
            'message' => $pesan,
            'errors' => ['idempotency_key' => [$pesan]],
        ], $status);
    }
}
