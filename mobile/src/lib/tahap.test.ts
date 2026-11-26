// npm test  (runtime bawaan Node, tanpa dependency test)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aksiUntuk, fieldKosong, kePayload, URUTAN, type Transaksi } from './tahap.ts';

const trx = (patch: Partial<Transaksi>): Transaksi => ({
  id_transaksi: '00001/11/2026/TJP',
  skema: 'TJP',
  current_stage: 'jemput_pangan',
  status_keseluruhan: 'berjalan',
  ...patch,
});

test('TJP baru: Jemput Pangan mengisi, role lain hanya melihat', () => {
  assert.equal(aksiUntuk(trx({}), 'jemput_pangan').mode, 'isi');
  assert.equal(aksiUntuk(trx({}), 'makloon').mode, 'lihat');
});

test('setelah JP mengirim: Makloon memeriksa, JP tidak bisa mengubah', () => {
  const t = trx({ current_stage: 'makloon', data_jemput_pangan: { status: 'menunggu_review' } });
  const a = aksiUntuk(t, 'makloon');
  assert.equal(a.mode, 'periksa');
  assert.equal(a.mode === 'periksa' && a.tahap.role, 'jemput_pangan');
  assert.equal(aksiUntuk(t, 'jemput_pangan').mode, 'lihat');
});

test('setelah diterima: Makloon mengisi tahapnya; setelah dikirim jadi lihat', () => {
  const diterima = trx({ current_stage: 'makloon', data_jemput_pangan: { status: 'diterima' } });
  assert.equal(aksiUntuk(diterima, 'makloon').mode, 'isi');
  const draft = { ...diterima, data_makloon_tjp: { status: 'draft' as const } };
  assert.equal(aksiUntuk(draft, 'makloon').mode, 'isi');
  const dikirim = { ...diterima, current_stage: 'ub_jastasma', data_makloon_tjp: { status: 'menunggu_review' as const } };
  assert.equal(aksiUntuk(dikirim, 'makloon').mode, 'lihat');
  assert.equal(aksiUntuk(dikirim, 'ub_jastasma').mode, 'periksa');
});

test('ditolak: kembali ke pengisi untuk diperbaiki', () => {
  const t = trx({ current_stage: 'jemput_pangan', data_jemput_pangan: { status: 'ditolak' } });
  assert.equal(aksiUntuk(t, 'jemput_pangan').mode, 'isi');
});

test('MPP: Makloon Terima memeriksa Makloon Kirim (aktor sama)', () => {
  const t = trx({ skema: 'MPP', current_stage: 'makloon_terima', data_makloon_mpp: { status: 'menunggu_review' } });
  assert.equal(aksiUntuk(t, 'makloon').mode, 'periksa');
  const lanjut = { ...t, data_makloon_mpp: { status: 'diterima' as const } };
  const a = aksiUntuk(lanjut, 'makloon');
  assert.equal(a.mode === 'isi' && a.tahap.endpoint, 'makloon-terima');
});

test('Pengadaan memeriksa UB di mobile, pekerjaan PO diarahkan ke web', () => {
  const t = trx({ current_stage: 'pengadaan', data_ub_jastasma: { status: 'menunggu_review' } });
  assert.equal(aksiUntuk(t, 'pengadaan').mode, 'periksa');
  assert.equal(aksiUntuk({ ...t, data_ub_jastasma: { status: 'diterima' } }, 'pengadaan').mode, 'web');
  assert.equal(aksiUntuk(trx({ current_stage: 'keuangan' }), 'keuangan').mode, 'web');
});

test('transaksi selesai atau admin: lihat saja', () => {
  assert.equal(aksiUntuk(trx({ status_keseluruhan: 'selesai' }), 'jemput_pangan').mode, 'lihat');
  assert.equal(aksiUntuk(trx({}), 'admin').mode, 'lihat');
});

test('payload form', () => {
  const ub = URUTAN.TJP[2];
  assert.deepEqual(kePayload(ub, { ka1: '12,5', ka2: '', hampa: 'x' }), { ka1: 12.5, hampa: 'x' });
  const jp = URUTAN.TJP[0];
  assert.deepEqual(kePayload(jp, { kuantum: '1.500', makloon_user_id: '7', supir: ' Budi ' }), {
    supir: 'Budi',
    makloon_user_id: 7,
    kuantum: 1500,
  });
  assert.equal(fieldKosong(ub, { ka1: '1', ka2: '1', ka3: '1', hampa: '1' }).map((x) => x.key).join(), 'butir_hijau');
});
