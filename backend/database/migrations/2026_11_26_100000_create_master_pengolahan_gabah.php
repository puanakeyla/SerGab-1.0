<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fondasi modul Pengolahan Gabah: role pelaku, master Gudang (KF-09), Jaminan Makloon (KF-15),
 * dan jatah koreksi per petugas (KF-12).
 *
 * Role `operasi` & `gudang` sempat dihapus di 2026_08_12_100000. Modul ini memerlukannya lagi,
 * jadi dikembalikan ke DUA tabel role (`roles` milik aplikasi dan `permission_roles` milik
 * spatie) -- sama seperti RoleSeeder.
 *
 * Berbeda dengan desain lama (gudang = akun user + users.nama_gudang), gudang sekarang punya
 * tabel master sendiri karena Admin perlu CRUD data gudang terlepas dari akun. Petugas Gudang
 * ditautkan ke gudangnya lewat users.gudang_id.
 */
return new class extends Migration
{
    private const ROLE = ['operasi', 'gudang'];

    public function up(): void
    {
        foreach (self::ROLE as $nama) {
            DB::table('roles')->insertOrIgnore(['nama_role' => $nama, 'created_at' => now(), 'updated_at' => now()]);
            DB::table('permission_roles')->insertOrIgnore(['name' => $nama, 'guard_name' => 'web', 'created_at' => now(), 'updated_at' => now()]);
        }

        Schema::create('gudang', function (Blueprint $table) {
            $table->id();
            $table->string('kode_gudang', 20)->unique();
            $table->string('nama_gudang', 150);
            $table->string('alamat')->nullable();
            $table->string('kabupaten', 100)->nullable();
            $table->decimal('kapasitas_kg', 14, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('gudang_id')->nullable()->after('nama_maklon')->constrained('gudang')->nullOnDelete();
            // Jatah koreksi data terkunci (0-99) yang diberikan Admin. Berkurang satu setiap
            // petugas menyimpan koreksi; 0 = terkunci lagi. Melengkapi akses_edit_dibuka_at.
            $table->unsignedTinyInteger('kuota_koreksi')->default(0)->after('akses_edit_dibuka_at');
        });

        // Batas kiriman Makloon (alur Serap Gabah) yang diatur Operasi. Satu baris per periode
        // berlaku, supaya perubahan jaminan tidak menimpa histori. Sisa kapasitas tidak
        // disimpan: dihitung dari stok gabah di Makloon yang belum diolah.
        Schema::create('jaminan_makloon', function (Blueprint $table) {
            $table->id();
            $table->foreignId('makloon_user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('nilai_jaminan', 16, 2);
            $table->decimal('kapasitas_kg', 14, 2);
            $table->date('berlaku_mulai');
            $table->date('berlaku_sampai')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['makloon_user_id', 'berlaku_mulai']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jaminan_makloon');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gudang_id');
            $table->dropColumn('kuota_koreksi');
        });

        Schema::dropIfExists('gudang');

        // Role row dibiarkan: bisa saja sudah ada user yang memakainya.
    }
};
