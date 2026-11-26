# SerGab Lampung — Sistem Serap Gabah

Aplikasi Sistem Informasi Serap Gabah untuk Perum BULOG. Project ini terdiri dari backend Laravel API, frontend React/Vite, dan aplikasi mobile Expo (React Native).

## Akun Login Default

Username: admin
Password: password
Role: admin

## Stack

- Backend: Laravel 11
- Frontend: React + Vite + TypeScript
- Mobile: Expo SDK 58 (React Native)
- Database: MySQL 8.0 (Laragon, `C:\laragon\bin\mysql\mysql-8.0.30-winx64`)
- PHP: 8.2.12 (`php` di PATH = `C:\XAMPP1\php\php.exe`). Minimal PHP 8.2.
- Node.js: 22

## Database

Project ini memakai MySQL Laragon. Database lokal yang digunakan: `sergab_lampung`.

Konfigurasi `backend/.env`:

```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=sergab_lampung
DB_USERNAME=root
DB_PASSWORD=123
```

Pastikan MySQL di Laragon sudah **Start All** sebelum menjalankan backend.

## Setup Backend (sekali saja)

```
cd C:\laragon\www\SerGab-1.0\backend
composer install
copy .env.example .env
```

Ubah bagian database di `backend/.env` seperti di atas, lalu:

```
php artisan key:generate
php artisan migrate --seed
```

## Setup Frontend (sekali saja)

```
cd C:\laragon\www\SerGab-1.0\frontend
npm install
copy .env.example .env
```

Isi `frontend/.env`:

```
VITE_API_URL=http://localhost:8000
```

## Menjalankan Aplikasi

Buka dua terminal.

Terminal 1 - backend Laravel:

```
cd C:\laragon\www\SerGab-1.0\backend
php artisan serve
```

Backend berjalan di http://127.0.0.1:8000

Terminal 2 - frontend React/Vite:

```
cd C:\laragon\www\SerGab-1.0\frontend
npm run dev
```

Frontend berjalan di http://localhost:5173 — buka lalu login dengan akun default.

## Aplikasi Mobile (opsional)

```
cd C:\laragon\www\SerGab-1.0\mobile
npm install
copy .env.example .env
npx expo start
```

- Emulator Android: `.env` boleh dikosongkan (default `http://10.0.2.2:8000`).
- HP fisik: isi `EXPO_PUBLIC_API_URL=http://<IP-LAN-PC>:8000` di `mobile/.env`, dan jalankan backend dengan `php artisan serve --host=0.0.0.0`.

## Perintah Penting

Cek migration:

```
php artisan migrate:status
```

Reset database lokal:

```
php artisan migrate:fresh --seed
```

Perhatian: perintah reset menghapus semua data lokal di database `sergab_lampung`.

Menjalankan tes:

```
cd C:\laragon\www\SerGab-1.0\backend
php artisan test

cd C:\laragon\www\SerGab-1.0\frontend
npm run test:lib
```

Tes backend memakai SQLite in-memory (`backend/.env.testing`), jadi tidak menyentuh database `sergab_lampung`.

## Troubleshooting Singkat

- **Tidak bisa login / error 500**: pastikan `backend/.env` ada dan `APP_KEY` sudah terisi (`php artisan key:generate`), serta MySQL Laragon sedang berjalan.
- **`Access denied for user 'root'`**: password di `DB_PASSWORD` tidak cocok dengan password root MySQL Laragon.
- **`vendor/autoload.php` tidak ditemukan**: jalankan `composer install` di folder `backend`.
- **`vite` tidak dikenali**: jalankan `npm install` di folder `frontend`.
- **`Table ... already exists` saat migrate**: database berisi tabel dari branch lain. Cadangkan dulu (`mysqldump`), lalu `php artisan migrate:fresh --seed`.
- **Frontend gagal memanggil backend**: pastikan backend berjalan di port 8000 dan `frontend/.env` berisi `VITE_API_URL=http://localhost:8000`.
- **Versi PHP salah**: cek dengan `php -v` (harus 8.2 ke atas). `php` di terminal saat ini berasal dari XAMPP, bukan dari menu PHP Laragon.
