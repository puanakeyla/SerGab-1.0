<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Idempotency-Key hanya berlaku 24 jam (App\Http\Middleware\VerifikasiIdempotencyKey).
Schedule::call(fn () => DB::table('idempotency_keys')->where('created_at', '<', now()->subDay())->delete())->daily();
