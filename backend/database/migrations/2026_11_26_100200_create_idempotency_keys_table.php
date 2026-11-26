<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Header Idempotency-Key yang sudah dikirim aplikasi mobile (mobile/src/lib/api.ts).
 * Key yang sama dari user yang sama tidak diproses ulang: respons tersimpan dikembalikan.
 * status_code NULL = request pertama masih diproses (request kembar dijawab 409).
 * request_hash membedakan key yang dipakai ulang untuk body berbeda (dijawab 422).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('key', 100);
            $table->string('method', 10);
            $table->string('path');
            $table->char('request_hash', 64);
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->longText('response_body')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'key']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
