<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Transaksi;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class IdempotencyKeyTest extends TestCase
{
    use RefreshDatabase;

    private User $makloon;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->makloon = User::create([
            'username' => 'makloon_idem',
            'password' => bcrypt('secret'),
            'role_id' => Role::where('nama_role', 'makloon')->value('id'),
        ]);
    }

    public function test_key_sama_tidak_membuat_data_ganda_dan_mengembalikan_respons_pertama(): void
    {
        $headers = ['Idempotency-Key' => 'kunci-1'];

        $pertama = $this->actingAs($this->makloon)->postJson('/api/transaksi', [], $headers)->assertCreated();
        $kedua = $this->actingAs($this->makloon)->postJson('/api/transaksi', [], $headers)
            ->assertCreated()
            ->assertHeader('Idempotent-Replayed', 'true');

        $this->assertSame($pertama->json('data.id_transaksi'), $kedua->json('data.id_transaksi'));
        $this->assertSame(1, Transaksi::count());
    }

    public function test_key_berbeda_atau_tanpa_key_diproses_normal(): void
    {
        $this->actingAs($this->makloon)->postJson('/api/transaksi', [], ['Idempotency-Key' => 'a'])->assertCreated();
        $this->actingAs($this->makloon)->postJson('/api/transaksi', [], ['Idempotency-Key' => 'b'])->assertCreated();
        $this->actingAs($this->makloon)->postJson('/api/transaksi')->assertCreated();
        $this->actingAs($this->makloon)->postJson('/api/transaksi')->assertCreated();

        $this->assertSame(4, Transaksi::count());
    }

    public function test_key_dipakai_untuk_body_lain_ditolak_422(): void
    {
        $this->registerRuteUji();
        $headers = ['Idempotency-Key' => 'kunci-2'];

        $this->actingAs($this->makloon)->postJson('/api/_uji-idem', ['x' => 1], $headers)->assertOk();
        $this->actingAs($this->makloon)->postJson('/api/_uji-idem', ['x' => 2], $headers)
            ->assertStatus(422)
            ->assertJsonValidationErrors('idempotency_key');
    }

    public function test_key_milik_user_lain_tidak_bentrok(): void
    {
        $lain = User::create([
            'username' => 'makloon_lain',
            'password' => bcrypt('secret'),
            'role_id' => $this->makloon->role_id,
        ]);
        $headers = ['Idempotency-Key' => 'kunci-3'];

        $this->actingAs($this->makloon)->postJson('/api/transaksi', [], $headers)->assertCreated();
        $this->actingAs($lain)->postJson('/api/transaksi', [], $headers)->assertCreated()->assertHeaderMissing('Idempotent-Replayed');

        $this->assertSame(2, Transaksi::count());
    }

    public function test_request_kembar_yang_masih_diproses_dijawab_429_agar_mobile_mengulang(): void
    {
        $this->registerRuteUji();
        $headers = ['Idempotency-Key' => 'kunci-4'];
        DB::table('idempotency_keys')->insert([
            'user_id' => $this->makloon->id,
            'key' => 'kunci-4',
            'method' => 'POST',
            'path' => 'api/_uji-idem',
            'request_hash' => hash('sha256', json_encode(['POST', 'api/_uji-idem', ['x' => 1], []])),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->makloon)->postJson('/api/_uji-idem', ['x' => 1], $headers)
            ->assertStatus(429)
            ->assertHeader('Retry-After');
    }

    public function test_respons_gagal_tidak_disimpan_sehingga_boleh_diulang(): void
    {
        $this->registerRuteUji();
        $headers = ['Idempotency-Key' => 'kunci-5'];

        $this->actingAs($this->makloon)->postJson('/api/_uji-idem', ['gagal' => true], $headers)->assertStatus(422);
        $this->assertDatabaseMissing('idempotency_keys', ['key' => 'kunci-5']);

        $this->actingAs($this->makloon)->postJson('/api/_uji-idem', ['gagal' => true], $headers)->assertStatus(422);
    }

    public function test_upload_foto_ulang_dengan_key_sama_tidak_diproses_ulang(): void
    {
        $this->registerRuteUji();
        $headers = ['Idempotency-Key' => 'foto-1', 'Accept' => 'application/json'];
        $foto = UploadedFile::fake()->image('nota.jpg');

        $this->actingAs($this->makloon)->post('/api/_uji-idem', ['jenis_foto' => 'x', 'foto' => $foto], $headers)->assertOk();
        $this->actingAs($this->makloon)->post('/api/_uji-idem', ['jenis_foto' => 'x', 'foto' => $foto], $headers)
            ->assertOk()
            ->assertHeader('Idempotent-Replayed', 'true');

        $this->assertSame(1, cache('uji_idem_dipanggil'));
    }

    public function test_key_terlalu_panjang_ditolak(): void
    {
        $this->actingAs($this->makloon)->postJson('/api/transaksi', [], ['Idempotency-Key' => str_repeat('a', 101)])
            ->assertStatus(422);
        $this->assertSame(0, Transaksi::count());
    }

    private function registerRuteUji(): void
    {
        Route::middleware(['api', 'auth:sanctum', 'idempotency'])->post('/api/_uji-idem', function () {
            cache(['uji_idem_dipanggil' => cache('uji_idem_dipanggil', 0) + 1]);

            return request('gagal')
                ? response()->json(['message' => 'gagal'], 422)
                : response()->json(['ok' => true]);
        });
    }
}
