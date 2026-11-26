# Modul Pengolahan Gabah — Kontrak REST API Awal (v0.2, draf untuk disepakati FE)

Status: **draf**. Setelah disepakati frontend web dan mobile, kontrak ini juga diekspor ke
Postman Collection. Setiap perubahan dicatat di Riwayat Perubahan beserta nomor versinya.
Model data dan tabel transisi: lihat
[pengolahan-gabah-arsitektur-erd.md](pengolahan-gabah-arsitektur-erd.md).

## 1. Konvensi umum

| Hal | Ketentuan |
|---|---|
| Base URL | `{API_URL}/api` |
| Format | JSON, header `Accept: application/json` wajib. Upload foto: `multipart/form-data` |
| Auth | `Authorization: Bearer <token>` (web juga boleh memakai cookie Sanctum) |
| Idempotensi | Semua `POST/PUT/PATCH/DELETE` mengirim `Idempotency-Key: <uuid>` (wajib untuk mobile). Ulangi dengan key yang sama ⇒ respons pertama dikembalikan, data tidak dibuat dua kali |
| Tanggal | `YYYY-MM-DD`; waktu `ISO-8601` (mis. `2026-11-26T09:15:00+07:00`) |
| Kuantum | kilogram, number dengan maks. 2 desimal |
| Nama field | `snake_case`, bahasa Indonesia, sama dengan kolom DB |
| Satu objek | `{ "data": { ... } }` |
| Daftar | `{ "data": [ ... ], "links": {...}, "meta": { "current_page", "per_page", "total", "last_page" } }` — query `page`, `per_page` (maks. 100) |

### Nilai enum

| Field | Nilai |
|---|---|
| `alur` | `GDG` (Gudang lebih dulu), `UBJ` (UB Jastasma lebih dulu) |
| `current_stage` | `gudang`, `ub_jastasma`, `operasi`, `pengadaan`, `selesai` |
| `status` pengolahan | `menunggu_review`, `ditolak`, `selesai`, `dibatalkan` |
| `status` MO | `draft`, `menunggu_review`, `ditolak`, `selesai`, `dibatalkan` |
| role modul | `gudang`, `ub_jastasma`, `operasi`, `pengadaan`, `admin` |

### Format error (seragam)

Semua error berbentuk `{ "message": string, "errors"?: { field: string[] } }`.

| Kode | Kapan | Contoh body |
|---|---|---|
| 401 | Tanpa token / token tidak sah / akun dinonaktifkan | `{"message":"Unauthenticated."}` |
| 403 | Role tidak berwenang atas endpoint | `{"message":"Anda tidak berwenang mengakses halaman ini."}` |
| 404 | Data tidak ada / di luar cakupan role | `{"message":"Data tidak ditemukan."}` |
| 422 | Validasi gagal, **atau perpindahan status di luar alur**, data terkunci, No LHPK/No MO ganda, kuota koreksi habis, kiriman Makloon melebihi kapasitas | `{"message":"Perpindahan status tidak sesuai alur.","errors":{"status":["Pengolahan tidak berada di tahap operasi."]}}` |
| 429 | Batas laju terlampaui (login, upload) | `{"message":"Too Many Attempts."}` + header `Retry-After` |
| 409 | Khusus Idempotency-Key: request pertama dengan key yang sama masih diproses | `{"message":"Permintaan yang sama sedang diproses."}` |

FE cukup menampilkan `message`, dan `errors[field][0]` di bawah input terkait.

## 2. Objek utama

### PengolahanGabah

```json
{
  "id": 12,
  "no_pengolahan": "00012/11/2026/GDG",
  "alur": "GDG",
  "current_stage": "operasi",
  "status": "menunggu_review",
  "makloon": { "id": 7, "nama_maklon": "PB Sumber Rejeki" },
  "gudang": { "id": 2, "kode_gudang": "GD-LPG-02", "nama_gudang": "Gudang Natar" },
  "mo": null,
  "terkunci": false,
  "rendemen": 62.40,
  "hgl": {
    "no_nota_timbang": "NT/0098",
    "tanggal_terima": "2026-11-25",
    "hgl_kg": 7800.00,
    "jumlah_karung": 156,
    "keterangan": null,
    "foto": [{ "jenis": "foto_nota_timbang", "url": "<signed-url>", "thumb_url": "<signed-url>" }],
    "submitted_by": { "id": 5, "username": "gudang01" }
  },
  "lhpk": {
    "no_lhpk": "LHPK/UBJ/2026/0451",
    "tanggal_lhpk": "2026-11-26",
    "kuantum_olah_kg": 12500.00,
    "ka1": 14.2, "ka2": 14.0, "ka3": 13.9,
    "broken_kg": 900.00, "menir_kg": 150.00, "katul_kg": 1100.00,
    "foto": [{ "jenis": "foto_lhpk", "url": "<signed-url>", "thumb_url": "<signed-url>" }],
    "submitted_by": { "id": 4, "username": "ubj01" }
  },
  "penolakan_terakhir": null,
  "aksi_tersedia": ["tolak"],
  "created_at": "2026-11-25T09:15:00+07:00",
  "updated_at": "2026-11-26T10:02:00+07:00"
}
```

- `hgl` / `lhpk` bernilai `null` selama bagian tersebut belum mengisi.
- `rendemen` = `hgl.hgl_kg / lhpk.kuantum_olah_kg × 100`, dihitung server; `null` bila salah
  satu belum ada.
- `penolakan_terakhir`: `{ "tahap", "catatan", "ditolak_oleh": {id, username}, "ditolak_pada" }`
  bila status `ditolak`.
- `aksi_tersedia`: aksi yang boleh dilakukan **user yang sedang login** saat ini, salah satu dari
  `isi_hgl`, `isi_lhpk`, `tolak`, `batal`, `masuk_mo`, `koreksi`. FE cukup menampilkan tombol yang
  ada di daftar ini, tanpa menduplikasi aturan alur.
- `url` foto adalah signed URL berumur pendek (pola `/api/foto/{media}` yang sudah ada).

### Mo

```json
{
  "id": 3,
  "no_mo": "MO/2026/11/0003",
  "makloon": { "id": 7, "nama_maklon": "PB Sumber Rejeki" },
  "no_tm_ada": "TM-ADA/2026/0091",
  "no_tm_gudang": "TM-GDG/2026/0091",
  "current_stage": "pengadaan",
  "status": "menunggu_review",
  "total_kuantum_olah_kg": 37500.00,
  "total_hgl_kg": 23400.00,
  "no_out": null,
  "tanggal_out": null,
  "anggota": [
    { "id": 12, "no_pengolahan": "00012/11/2026/GDG", "alur": "GDG", "no_lhpk": "LHPK/UBJ/2026/0451", "kuantum_olah_kg": 12500.00, "hgl_kg": 7800.00 }
  ],
  "penolakan_terakhir": null,
  "aksi_tersedia": ["terima", "tolak"],
  "created_at": "2026-11-26T10:00:00+07:00"
}
```

Total dihitung server dari anggota (tidak disimpan).

## 3. Endpoint

Semua endpoint di bawah, kecuali login, memerlukan token sah dan akun aktif.

### 3.1 Auth (KF-01) — sudah ada, dipakai ulang

| Method & path | Body | Respons |
|---|---|---|
| `POST /login` | `{username, password, device_name}` | 200 `{user, token}`. Salah password / akun nonaktif ⇒ 422. Throttle ⇒ 429 |
| `POST /logout` | — | 204 (token dicabut) |
| `GET /me` | — | 200 `{user}` (memuat `role.nama_role`, `gudang_id`, `kuota_koreksi`) |

### 3.2 Pengolahan gabah (KF-02, KF-03, KF-06, KF-10, KF-12)

| # | Method & path | Role | Fungsi |
|---|---|---|---|
| 1 | `GET /pengolahan-gabah` | gudang, ub_jastasma, operasi, pengadaan, admin | Daftar terklasifikasi |
| 2 | `GET /pengolahan-gabah/{id}` | sama | Detail + riwayat penolakan |
| 3 | `POST /pengolahan-gabah` | gudang, ub_jastasma | Buat transaksi (tahap 1); `alur` ditentukan dari role pembuat |
| 4 | `PATCH /pengolahan-gabah/{id}/hgl` | gudang | Isi/perbaiki data HGL lalu kirim ke tahap berikutnya |
| 5 | `PATCH /pengolahan-gabah/{id}/lhpk` | ub_jastasma | Isi/perbaiki data LHPK lalu kirim ke tahap berikutnya |
| 6 | `POST /pengolahan-gabah/{id}/foto` | gudang, ub_jastasma | Upload foto tahap sendiri |
| 7 | `POST /pengolahan-gabah/{id}/tolak` | ub_jastasma, gudang, operasi | Tolak ke tahap sebelumnya |
| 8 | `POST /pengolahan-gabah/{id}/batal` | pembuat, admin | Batalkan (belum masuk MO) |
| 9 | `PATCH /pengolahan-gabah/{id}/koreksi` | gudang, ub_jastasma, operasi, pengadaan | Koreksi data terkunci (pakai kuota) |

**1. `GET /pengolahan-gabah`** — query opsional: `kategori` = `perlu_tindakan` | `diproses` |
`selesai` | `ditolak`, `alur`, `status`, `current_stage`, `makloon_user_id`, `gudang_id`,
`tanggal_dari`, `tanggal_sampai`, `q` (no pengolahan / No LHPK / No nota timbang), `page`,
`per_page`. `perlu_tindakan` = `current_stage` milik role user. Petugas Gudang hanya melihat
transaksi gudangnya (`users.gudang_id`). Kolom disaring sesuai role.

**3. `POST /pengolahan-gabah`** — body berisi data milik role pembuat.

Gudang (alur GDG):

```json
{
  "makloon_user_id": 7,
  "no_nota_timbang": "NT/0098",
  "tanggal_terima": "2026-11-25",
  "hgl_kg": 7800,
  "jumlah_karung": 156,
  "keterangan": null
}
```

UB Jastasma (alur UBJ):

```json
{
  "makloon_user_id": 7,
  "gudang_id": 2,
  "no_lhpk": "LHPK/UBJ/2026/0451",
  "tanggal_lhpk": "2026-11-26",
  "kuantum_olah_kg": 12500,
  "ka1": 14.2, "ka2": 14.0, "ka3": 13.9,
  "broken_kg": 900, "menir_kg": 150, "katul_kg": 1100
}
```

Validasi: `makloon_user_id` user aktif ber-role makloon; untuk Gudang, `gudang_id` diisi server
dari akunnya; `no_lhpk` unik (ganda ⇒ 422 `errors.no_lhpk`); kuantum > 0; `ka*` 0–100.
Respons **201** `{data: PengolahanGabah}` dengan `current_stage` = tahap 2,
`status = menunggu_review`.

**4 & 5. `PATCH /pengolahan-gabah/{id}/hgl` dan `/lhpk`** — body sama dengan bagian data
role tersebut di #3 (tanpa `makloon_user_id`). Dipakai untuk tiga situasi; selain itu ⇒ 422:

| Situasi | Syarat | Hasil |
|---|---|---|
| Tahap 2 menerima & menginput | `current_stage` = role ini, `status = menunggu_review` | ke `operasi`, `menunggu_review` |
| Tahap 1 memperbaiki | `current_stage` = role ini, `status = ditolak` | ke tahap 2, `menunggu_review` |
| Tahap 2 memperbaiki setelah ditolak Operasi | `current_stage` = role ini, `status = ditolak` | ke `operasi`, `menunggu_review` |

Respons 200 `{data: PengolahanGabah}`.

**6. `POST /pengolahan-gabah/{id}/foto`** — multipart: `jenis_foto` (`foto_nota_timbang` untuk
Gudang, `foto_lhpk` untuk UB Jastasma), `foto` (jpeg/png, ≤ 5 MB). Throttle 40/menit. Hanya
selama data role tersebut belum terkunci. Respons 201 `{data: {jenis, url, thumb_url}}`.
Urutan FE: simpan data (#3/#4/#5) ⇒ dapat `id` ⇒ upload foto. Masing-masing memakai
Idempotency-Key sendiri.

**7. `POST /pengolahan-gabah/{id}/tolak`** — `{ "alasan": "Foto nota timbang buram" }` (wajib,
5–500 karakter). Hanya role `current_stage` saat `status = menunggu_review` dan belum masuk MO.
Data kembali **satu tahap** ke pengirimnya:

| Penolak | Alur GDG kembali ke | Alur UBJ kembali ke |
|---|---|---|
| tahap 2 | `gudang` | `ub_jastasma` |
| `operasi` | `ub_jastasma` | `gudang` |

Respons 200, `status = ditolak`; alasan, pelaku, dan waktu tersimpan di riwayat penolakan.

**8. `POST /pengolahan-gabah/{id}/batal`** — `{ "alasan": "..." }`. Sudah masuk MO / selesai ⇒ 422.

**9. `PATCH /pengolahan-gabah/{id}/koreksi`** — body field data milik role user (seperti #4/#5) +
`"alasan"` wajib. Hanya untuk transaksi `selesai`. `kuota_koreksi` user = 0 ⇒ 422
`errors.kuota_koreksi`. Berhasil ⇒ `kuota_koreksi` user berkurang 1, perubahan tercatat di
audit log.

### 3.3 Move Order (KF-04, KF-05)

| # | Method & path | Role | Fungsi |
|---|---|---|---|
| 10 | `GET /mo/kandidat?makloon_user_id=` | operasi | Pengolahan di tahap `operasi`, `menunggu_review`, belum ber-MO |
| 11 | `GET /mo` | operasi, pengadaan, admin | Daftar MO (filter `status`, `current_stage`, `makloon_user_id`) |
| 12 | `GET /mo/{id}` | operasi, pengadaan, admin | Detail MO + anggota + riwayat penolakan |
| 13 | `POST /mo` | operasi | Buat MO (status `draft`) |
| 14 | `PATCH /mo/{id}` | operasi | Ubah No TM ADA / No TM Gudang (`draft`/`ditolak`) |
| 15 | `POST /mo/{id}/anggota` | operasi | Tambah anggota `{pengolahan_gabah_ids: []}` |
| 16 | `DELETE /mo/{id}/anggota/{pengolahanId}` | operasi | Lepaskan anggota |
| 17 | `POST /mo/{id}/kirim` | operasi | Kirim ke Pengadaan |
| 18 | `POST /mo/{id}/batal` | operasi | Batalkan MO `draft`; anggota dilepas |
| 19 | `POST /mo/{id}/terima` | pengadaan | Terima MO + tanggal OUT |
| 20 | `POST /mo/{id}/tolak` | pengadaan | Tolak MO, kembali ke Operasi |

**13. `POST /mo`**

```json
{
  "no_mo": "MO/2026/11/0003",
  "makloon_user_id": 7,
  "no_tm_ada": "TM-ADA/2026/0091",
  "no_tm_gudang": "TM-GDG/2026/0091",
  "pengolahan_gabah_ids": [12, 13, 15]
}
```

Validasi (#13 dan #15): `no_mo` unik (ganda ⇒ 422 `errors.no_mo`); setiap anggota berada di
`current_stage = operasi`, `status = menunggu_review`, belum punya MO, dan **Makloon-nya sama
dengan MO** (beda ⇒ 422 `errors.pengolahan_gabah_ids`). Anggota boleh campuran alur GDG dan UBJ.
Dua request bersamaan yang memasukkan pengolahan yang sama: hanya satu yang berhasil. Respons
201 `{data: Mo}`.

**17. `POST /mo/{id}/kirim`** — tanpa body. Syarat: status `draft`/`ditolak`, minimal satu
anggota, `no_tm_ada` dan `no_tm_gudang` terisi. Hasil: `status = menunggu_review`,
`current_stage = pengadaan`, anggota ikut ke `pengadaan`.

**19. `POST /mo/{id}/terima`** — `{ "tanggal_out": "2026-11-27" }`. Syarat: status
`menunggu_review`. Sistem menerbitkan `no_out` (unik). Hasil: MO `selesai`, semua anggota
`status = selesai` dan terkunci. Respons 200 `{data: Mo}`.

**20. `POST /mo/{id}/tolak`** — `{ "alasan": "..." }`. Hasil: MO `ditolak`,
`current_stage = operasi`, anggota kembali ke `operasi`.

### 3.4 Master Gudang & Jaminan Makloon (KF-09, KF-15)

| # | Method & path | Role | Fungsi |
|---|---|---|---|
| 21 | `GET /gudang` | semua role modul | Daftar gudang (`?aktif=1` untuk dropdown) |
| 22 | `POST /gudang`, `GET/PATCH/DELETE /gudang/{id}` | admin | CRUD gudang. DELETE gudang yang sudah dipakai ⇒ 422 (nonaktifkan saja) |
| 23 | `GET /makloon-options` | semua | Sudah ada; dropdown Makloon |
| 24 | `GET /makloon/{userId}/jaminan` | operasi, admin, makloon (miliknya) | `{nilai_jaminan, kapasitas_kg, stok_belum_diolah_kg, sisa_kapasitas_kg, berlaku_mulai, berlaku_sampai}` |
| 25 | `POST /makloon/{userId}/jaminan` | operasi | `{nilai_jaminan, kapasitas_kg, berlaku_mulai, berlaku_sampai?}` |
| 26 | `PATCH /transaksi/{id}/makloon` | makloon | Sudah ada (Serap Gabah). Tambahan: kuantum melebihi sisa kapasitas ⇒ 422 `errors.kuantum` |

Body gudang: `{kode_gudang, nama_gudang, alamat?, kabupaten?, kapasitas_kg?, is_active?}`.

### 3.5 Laporan, notifikasi, audit, akun (KF-07, KF-08, KF-11, KF-12, KF-13, KF-14)

| # | Method & path | Role | Fungsi |
|---|---|---|---|
| 27 | `GET /pengolahan-gabah/rekap` | admin | Rekap paginated (filter sama dengan #1) + rendemen & stok per gudang |
| 28 | `GET /pengolahan-gabah/neraca?tanggal_dari=&tanggal_sampai=` | admin | Per Makloon: `{makloon, diterima_kg, in_spp_kg, diolah_kg, belum_diproses_kg}` |
| 29 | `GET /pengolahan-gabah/monitoring/ringkasan` | admin | `{total, menunggu_review, ditolak, selesai, dibatalkan}` |
| 30 | `GET /pengolahan-gabah/monitoring/sebaran-tahap` | admin | `[{alur, current_stage, jumlah}]` |
| 31 | `GET /pengolahan-gabah/monitoring/tren-bulanan?tahun=` | admin | `[{bulan, jumlah, kuantum_olah_kg, hgl_kg}]` |
| 32 | `GET /notifikasi`, `PATCH /notifikasi/{id}/read`, `PATCH /notifikasi/read-all` | semua | Sudah ada. Notifikasi modul ini: `tipe = "pengolahan_gabah"` atau `"mo"`, `data = {pengolahan_gabah_id}` / `{mo_id}` |
| 33 | `GET /admin/audit-logs` | admin | Sudah ada; tambah filter `pengolahan_gabah_id`, `mo_id`, `aksi`, `user_id`, `tanggal_dari`, `tanggal_sampai` |
| 34 | `/admin/users` (CRUD) | admin | Sudah ada; user role gudang menyertakan `gudang_id` |
| 35 | `PATCH /admin/users/{id}/akses-edit` | admin | Sudah ada; tambah body `{ "kuota_koreksi": 0-99 }` untuk membuka/menutup jatah koreksi |

## 4. Idempotency-Key

| Situasi | Respons |
|---|---|
| Key baru | Diproses normal, respons disimpan 24 jam |
| Key sama, body sama, sudah selesai | Respons tersimpan dikembalikan + header `Idempotent-Replayed: true` |
| Key sama, request pertama masih diproses | 409 |
| Key sama, body berbeda | 422 `errors.idempotency_key` |

Key berlaku per user. Respons 5xx tidak disimpan, jadi boleh diulang dengan key yang sama.

## 5. Hal yang perlu disepakati FE

1. Bentuk objek di bagian 2, terutama `aksi_tersedia` dan foto di dalam `hgl`/`lhpk`.
2. Satu endpoint input per bagian (#4 `/hgl`, #5 `/lhpk`) untuk terima, isi, dan perbaiki
   sekaligus, ditambah #7 `/tolak`.
3. Penyimpanan data dan upload foto sebagai dua request terpisah.
4. Nilai `kategori` di daftar (#1) untuk tab "Perlu tindakan / Diproses / Selesai / Ditolak".

## Riwayat Perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 0.1 | 2026-11-26 | Draf awal |
| 0.2 | 2026-11-26 | Disesuaikan dengan laporan: setiap alur melewati Gudang dan UB Jastasma; transisi di luar alur 422; MO punya status `draft` dan kelola anggota; No OUT diterbitkan sistem; kuota koreksi per petugas; Jaminan Makloon memeriksa kiriman Makloon |
