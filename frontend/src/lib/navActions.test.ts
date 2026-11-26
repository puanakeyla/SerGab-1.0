// npm run test:lib
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AKSES_HALAMAN, bolehAkses, buildActions } from './navActions.ts'

const label = (role: string) => buildActions(role).map((a) => a.label)

test('menu tiap role', () => {
  assert.deepEqual(label('admin'), ['Kelola User', 'Monitoring', 'Rekap Data', 'Audit Log'])
  assert.deepEqual(label('jemput_pangan'), ['Buat Transaksi', 'Rekap Data'])
  assert.deepEqual(label('makloon'), ['Buat MPP', 'Rekap Data'])
  for (const role of ['ub_jastasma', 'pengadaan', 'keuangan']) assert.deepEqual(label(role), ['Rekap Data'])
  assert.deepEqual(label('role_tak_dikenal'), [])
})

test('setiap menu yang tampil bisa dibuka role itu', () => {
  for (const role of ['admin', 'jemput_pangan', 'makloon', 'ub_jastasma', 'pengadaan', 'keuangan']) {
    for (const a of buildActions(role)) assert.ok(bolehAkses(role, a.to), `${role} -> ${a.to}`)
  }
})

test('penjaga route', () => {
  assert.equal(bolehAkses('makloon', '/admin/users'), false)
  assert.equal(bolehAkses('jemput_pangan', '/transaksi/baru-mpp'), false)
  assert.equal(bolehAkses('keuangan', '/pengadaan'), false)
  assert.equal(bolehAkses('makloon', '/dashboard'), true, 'halaman tak terdaftar terbuka untuk semua')
  for (const path of Object.keys(AKSES_HALAMAN)) assert.ok(bolehAkses('admin', path), `admin -> ${path}`)
})
