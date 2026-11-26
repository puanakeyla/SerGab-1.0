<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabel inti modul Pengolahan Gabah. Setiap transaksi melewati Gudang DAN UB Jastasma; yang
 * berbeda hanya urutan dua tahap awalnya (ditentukan role yang lebih dulu menginput):
 *   GDG: gudang      -> ub_jastasma -> operasi -> pengadaan -> selesai
 *   UBJ: ub_jastasma -> gudang      -> operasi -> pengadaan -> selesai
 * Penolakan mengembalikan data satu tahap ke pengirimnya; penolakan MO oleh Pengadaan kembali
 * ke Operasi.
 *
 * Pola mengikuti transaksi TJP/MPP: satu baris induk (pengolahan_gabah) + satu tabel data per
 * tahap input (data_hgl milik Gudang, data_lhpk milik UB Jastasma). Foto (nota timbang / LHPK)
 * menempel ke baris data_* lewat medialibrary, karena kolom media.model_id bertipe bigint.
 *
 * Tabel `mo` lama (modul Pengolahan versi 2026-07-20) sudah di-drop di 2026_07_30_120000;
 * nama dipakai ulang dengan struktur baru.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mo', function (Blueprint $table) {
            $table->id();
            // KNF-4: nomor MO ganda ditolak di level DB, juga untuk dua request bersamaan.
            $table->string('no_mo', 50)->unique();
            $table->foreignId('makloon_user_id')->constrained('users');
            $table->string('no_tm_ada', 50)->nullable();
            $table->string('no_tm_gudang', 50)->nullable();
            $table->string('current_stage', 30)->default('operasi');
            // draft: Operasi masih menambah/melepas anggota; menunggu_review: sudah dikirim ke Pengadaan.
            $table->enum('status', ['draft', 'menunggu_review', 'ditolak', 'selesai', 'dibatalkan'])->default('draft');
            // Nomor OUT diterbitkan sistem saat Pengadaan menerima MO dan mengisi tanggal OUT.
            $table->string('no_out', 50)->nullable()->unique();
            $table->date('tanggal_out')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['current_stage', 'status']);
            $table->index('makloon_user_id');
        });

        Schema::create('pengolahan_gabah', function (Blueprint $table) {
            $table->id();
            // Format 00001/11/2026/GDG, counter di nomor_urut_transaksi.
            $table->string('no_pengolahan', 30)->unique();
            $table->enum('alur', ['GDG', 'UBJ']);
            $table->string('current_stage', 30);
            $table->enum('status', ['menunggu_review', 'ditolak', 'selesai', 'dibatalkan'])->default('menunggu_review');
            $table->foreignId('makloon_user_id')->constrained('users');
            $table->foreignId('gudang_id')->nullable()->constrained('gudang');
            // KNF-4: satu pengolahan hanya di satu MO -- dijamin karena relasinya satu kolom.
            $table->foreignId('mo_id')->nullable()->constrained('mo')->nullOnDelete();
            $table->timestamp('locked_at')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['alur', 'current_stage', 'status']);
            $table->index(['makloon_user_id', 'status']);
        });

        Schema::create('data_hgl', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengolahan_gabah_id')->unique()->constrained('pengolahan_gabah')->cascadeOnDelete();
            $table->string('no_nota_timbang', 50);
            $table->date('tanggal_terima');
            $table->decimal('hgl_kg', 14, 2);
            $table->unsignedInteger('jumlah_karung')->nullable();
            $table->text('keterangan')->nullable();
            $table->foreignId('submitted_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('data_lhpk', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pengolahan_gabah_id')->unique()->constrained('pengolahan_gabah')->cascadeOnDelete();
            // KF-03/KNF-4: nomor LHPK ganda ditolak di level DB, bukan hanya validasi aplikasi.
            $table->string('no_lhpk', 50)->unique();
            $table->date('tanggal_lhpk');
            // Rendemen = data_hgl.hgl_kg / kuantum_olah_kg * 100, dihitung di API Resource --
            // tidak disimpan agar tidak bisa tidak sinkron.
            $table->decimal('kuantum_olah_kg', 14, 2);
            $table->decimal('ka1', 6, 2)->nullable();
            $table->decimal('ka2', 6, 2)->nullable();
            $table->decimal('ka3', 6, 2)->nullable();
            $table->decimal('broken_kg', 14, 2)->nullable();
            $table->decimal('menir_kg', 14, 2)->nullable();
            $table->decimal('katul_kg', 14, 2)->nullable();
            $table->foreignId('submitted_by')->constrained('users');
            $table->timestamps();
        });

        Schema::table('nomor_urut_transaksi', function (Blueprint $table) {
            $table->enum('skema', ['TJP', 'MPP', 'GDG', 'UBJ'])->change();
        });

        // RiwayatPenolakan (KF-06) dipakai bersama alur Serap Gabah: tepat satu dari
        // transaksi_id / pengolahan_gabah_id / mo_id yang terisi.
        Schema::table('riwayat_penolakan', function (Blueprint $table) {
            $table->string('transaksi_id', 30)->nullable()->change();
            $table->foreignId('pengolahan_gabah_id')->nullable()->after('transaksi_id')->constrained('pengolahan_gabah')->cascadeOnDelete();
            $table->foreignId('mo_id')->nullable()->after('pengolahan_gabah_id')->constrained('mo')->cascadeOnDelete();
            $table->index(['pengolahan_gabah_id', 'ditolak_pada']);
            $table->index(['mo_id', 'ditolak_pada']);
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->foreignId('pengolahan_gabah_id')->nullable()->after('transaksi_id')->constrained('pengolahan_gabah')->nullOnDelete();
            $table->foreignId('mo_id')->nullable()->after('pengolahan_gabah_id')->constrained('mo')->nullOnDelete();
            $table->index(['pengolahan_gabah_id', 'created_at']);
            $table->index(['mo_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['pengolahan_gabah_id', 'created_at']);
            $table->dropIndex(['mo_id', 'created_at']);
            $table->dropConstrainedForeignId('pengolahan_gabah_id');
            $table->dropConstrainedForeignId('mo_id');
        });

        Schema::table('riwayat_penolakan', function (Blueprint $table) {
            $table->dropIndex(['pengolahan_gabah_id', 'ditolak_pada']);
            $table->dropIndex(['mo_id', 'ditolak_pada']);
            $table->dropConstrainedForeignId('pengolahan_gabah_id');
            $table->dropConstrainedForeignId('mo_id');
        });
        // Rollback gagal bila sudah ada penolakan pengolahan (transaksi_id NULL) -- disengaja,
        // lebih baik gagal daripada diam-diam membuang riwayat.
        Schema::table('riwayat_penolakan', function (Blueprint $table) {
            $table->string('transaksi_id', 30)->nullable(false)->change();
        });

        Schema::table('nomor_urut_transaksi', function (Blueprint $table) {
            $table->enum('skema', ['TJP', 'MPP'])->change();
        });

        Schema::dropIfExists('data_lhpk');
        Schema::dropIfExists('data_hgl');
        Schema::dropIfExists('pengolahan_gabah');
        Schema::dropIfExists('mo');
    }
};
