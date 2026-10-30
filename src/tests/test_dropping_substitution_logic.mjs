import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian TDD: Logika Substitusi Petugas Dropping & Isolasi Toko...');

// Import modul yang akan diimplementasikan (Red -> Green)
import {
  getEffectiveDroppingTargetId,
  filterStoresForDropping,
  formatVirtualMachineCode,
  getDroppingPageHeaderTitle,
} from '../lib/droppingSubstitutionLogic.ts';

// -----------------------------------------------------------------------------
// Test 1: getEffectiveDroppingTargetId
// -----------------------------------------------------------------------------
const pureDroppingUser = {
  id: 'user-naufal',
  role: 'dropping',
  full_name: 'Naufal Dropping',
  machine_prefix: 'NAUFAL',
};

const adminDroppingUser = {
  id: 'user-admin',
  role: 'admin_cabang',
  assigned_task: 'dropping',
  full_name: 'Admin Malang',
  machine_prefix: 'ADMIN',
};

// 1.1 Petugas dropping murni selalu membidik ID dirinya sendiri
assert.equal(
  getEffectiveDroppingTargetId({ profile: pureDroppingUser }),
  'user-naufal',
  'Petugas dropping murni harus membidik id miliknya sendiri'
);

// 1.2 Admin yang bertugas dropping membidik ID petugas yang digantikan jika ada substituteUserId
assert.equal(
  getEffectiveDroppingTargetId({ profile: adminDroppingUser, substituteUserId: 'user-naufal' }),
  'user-naufal',
  'Admin pengganti harus membidik id petugas yang digantikan'
);

// 1.3 Admin tanpa substituteUserId membidik ID dirinya sendiri
assert.equal(
  getEffectiveDroppingTargetId({ profile: adminDroppingUser }),
  'user-admin',
  'Admin tanpa substituteUserId membidik id dirinya sendiri'
);

console.log('✓ Test 1: Penentuan ID target dropping efektif lulus');

// -----------------------------------------------------------------------------
// Test 2: formatVirtualMachineCode (Virtual Alias Prefix Admin)
// -----------------------------------------------------------------------------
// Kasus A: Mesin NAUFAL-05 digantikan oleh Admin dengan prefix ADMIN -> ADMIN-05
assert.equal(
  formatVirtualMachineCode({ originalMachineCode: 'NAUFAL-05', virtualPrefix: 'ADMIN' }),
  'ADMIN-05',
  'Mesin NAUFAL-05 harus diformat menjadi ADMIN-05'
);

// Kasus B: Mesin [NAUFAL-01] dengan kurung siku -> ADMIN-01
assert.equal(
  formatVirtualMachineCode({ originalMachineCode: '[NAUFAL-01]', virtualPrefix: 'ADMIN' }),
  'ADMIN-01',
  'Mesin [NAUFAL-01] harus diformat menjadi ADMIN-01'
);

// Kasus C: Tanpa virtualPrefix, format kode asli tetap rapi
assert.equal(
  formatVirtualMachineCode({ originalMachineCode: 'NAUFAL-12' }),
  'NAUFAL-12',
  'Tanpa virtualPrefix, harus mengembalikan kode asli'
);

// Kasus D: Mesin null/undefined
assert.equal(
  formatVirtualMachineCode({ originalMachineCode: null, virtualPrefix: 'ADMIN' }),
  'Tanpa Mesin',
  'Mesin kosong harus mengembalikan Tanpa Mesin'
);

console.log('✓ Test 2: Pemformatan Virtual Alias kode mesin lulus');

// -----------------------------------------------------------------------------
// Test 3: filterStoresForDropping (Isolasi Toko)
// -----------------------------------------------------------------------------
const mockStores = [
  {
    id: 'store-1',
    name: 'Toko Naufal 1',
    machine: { id: 'm-1', machine_code: 'NAUFAL-01', assigned_dropping_id: 'user-naufal' },
  },
  {
    id: 'store-2',
    name: 'Toko Naufal 2',
    machine: { id: 'm-2', machine_code: 'NAUFAL-02', assigned_dropping_id: 'user-naufal' },
  },
  {
    id: 'store-3',
    name: 'Toko Budi',
    machine: { id: 'm-3', machine_code: 'BUDI-01', assigned_dropping_id: 'user-budi' },
  },
  {
    id: 'store-4',
    name: 'Toko Tanpa Mesin',
    machine: null,
  },
];

// 3.1 Petugas Naufal HANYA melihat Toko Naufal 1 & 2
const naufalStores = filterStoresForDropping({
  stores: mockStores,
  effectiveDroppingId: 'user-naufal',
});
assert.equal(naufalStores.length, 2);
assert.equal(naufalStores[0].name, 'Toko Naufal 1');
assert.equal(naufalStores[1].name, 'Toko Naufal 2');

// 3.2 Petugas Budi HANYA melihat Toko Budi
const budiStores = filterStoresForDropping({
  stores: mockStores,
  effectiveDroppingId: 'user-budi',
});
assert.equal(budiStores.length, 1);
assert.equal(budiStores[0].name, 'Toko Budi');

console.log('✓ Test 3: Isolasi toko antar petugas dropping lulus 100%');

// -----------------------------------------------------------------------------
// Test 4: getDroppingPageHeaderTitle
// -----------------------------------------------------------------------------
// 4.1 Petugas murni
assert.equal(
  getDroppingPageHeaderTitle({ profile: pureDroppingUser }),
  'Daftar dropping Naufal Dropping'
);

// 4.2 Admin menggantikan Naufal
assert.equal(
  getDroppingPageHeaderTitle({
    profile: adminDroppingUser,
    substituteStaff: pureDroppingUser,
  }),
  'Daftar dropping Admin Malang (Menggantikan Naufal Dropping)'
);

console.log('✓ Test 4: Judul Header halaman dropping dinamis lulus');
console.log('🎉 SEMUA PENGUJIAN TDD SUBSTITUSI DROPPING BERHASIL!\n');
