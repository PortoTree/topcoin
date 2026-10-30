import assert from 'node:assert/strict';
import {
  getEffectiveDroppingTargetId,
  filterStoresForDropping,
  formatVirtualMachineCode,
  getSubstitutedDroppingStaff,
  getDroppingPageHeaderTitle,
} from '../lib/droppingSubstitutionLogic.ts';

console.log('🧪 Memulai Pengujian Integrasi: Substitusi Dropping & Isolasi Toko...');

// 1. Setup Data Mock
const staffList = [
  {
    id: 'staff-admin-01',
    role: 'admin_cabang',
    assigned_task: 'dropping',
    full_name: 'Super Admin Cabang',
    machine_prefix: 'ADMIN',
  },
  {
    id: 'staff-naufal-02',
    role: 'dropping',
    full_name: 'Naufal Dropping',
    machine_prefix: 'NAUFAL',
  },
  {
    id: 'staff-budi-03',
    role: 'dropping',
    full_name: 'Budi Dropping',
    machine_prefix: 'BUDI',
  },
];

const mockStores = [
  {
    id: 'store-naufal-1',
    name: 'Toko Berkah Naufal 1',
    route_order: 1,
    current_machine_id: 'm-naufal-01',
    machine: {
      id: 'm-naufal-01',
      machine_code: 'NAUFAL-01',
      assigned_dropping_id: 'staff-naufal-02',
    },
  },
  {
    id: 'store-naufal-2',
    name: 'Toko Berkah Naufal 2',
    route_order: 2,
    current_machine_id: 'm-naufal-05',
    machine: {
      id: 'm-naufal-05',
      machine_code: 'NAUFAL-05',
      assigned_dropping_id: 'staff-naufal-02',
    },
  },
  {
    id: 'store-budi-1',
    name: 'Toko Jaya Budi 1',
    route_order: 1,
    current_machine_id: 'm-budi-01',
    machine: {
      id: 'm-budi-01',
      machine_code: 'BUDI-01',
      assigned_dropping_id: 'staff-budi-03',
    },
  },
  {
    id: 'store-cadangan-1',
    name: 'Toko Cadangan',
    current_machine_id: null,
    machine: null,
  },
];

// -----------------------------------------------------------------------------
// Skenario A: Petugas Naufal Login (Akun Dropping Murni)
// -----------------------------------------------------------------------------
const naufalProfile = staffList[1];
const naufalEffectiveId = getEffectiveDroppingTargetId({ profile: naufalProfile });
assert.equal(naufalEffectiveId, 'staff-naufal-02', 'Target ID Naufal harus ID dirinya sendiri');

const naufalStores = filterStoresForDropping({
  stores: mockStores,
  effectiveDroppingId: naufalEffectiveId,
});

assert.equal(naufalStores.length, 2, 'Naufal hanya boleh melihat 2 toko miliknya');
assert.equal(naufalStores[0].name, 'Toko Berkah Naufal 1');
assert.equal(naufalStores[1].name, 'Toko Berkah Naufal 2');

// Kode mesin Naufal tetap NAUFAL-01 dan NAUFAL-05
const naufalCode1 = formatVirtualMachineCode({
  originalMachineCode: naufalStores[0].machine.machine_code,
  virtualPrefix: naufalProfile.machine_prefix,
});
const naufalCode2 = formatVirtualMachineCode({
  originalMachineCode: naufalStores[1].machine.machine_code,
  virtualPrefix: naufalProfile.machine_prefix,
});
assert.equal(naufalCode1, 'NAUFAL-01');
assert.equal(naufalCode2, 'NAUFAL-05');
console.log('✓ Skenario A: Petugas dropping murni terisolasi 100%');

// -----------------------------------------------------------------------------
// Skenario B: Admin Cabang Menggantikan Naufal yang Libur
// -----------------------------------------------------------------------------
const adminProfile = staffList[0];
const substituteId = 'staff-naufal-02'; // Admin memilih Naufal

const adminEffectiveId = getEffectiveDroppingTargetId({
  profile: adminProfile,
  substituteUserId: substituteId,
});
assert.equal(adminEffectiveId, 'staff-naufal-02', 'Admin pengganti harus membidik toko milik Naufal');

const adminStores = filterStoresForDropping({
  stores: mockStores,
  effectiveDroppingId: adminEffectiveId,
});
assert.equal(adminStores.length, 2, 'Admin pengganti harus mendapatkan toko milik Naufal');
assert.equal(adminStores[0].name, 'Toko Berkah Naufal 1');
assert.equal(adminStores[1].name, 'Toko Berkah Naufal 2');

// Tampilan Virtual Alias Admin: NAUFAL-01 -> ADMIN-01, NAUFAL-05 -> ADMIN-05
const adminVirtualCode1 = formatVirtualMachineCode({
  originalMachineCode: adminStores[0].machine.machine_code,
  virtualPrefix: adminProfile.machine_prefix, // "ADMIN"
});
const adminVirtualCode2 = formatVirtualMachineCode({
  originalMachineCode: adminStores[1].machine.machine_code,
  virtualPrefix: adminProfile.machine_prefix, // "ADMIN"
});
assert.equal(adminVirtualCode1, 'ADMIN-01', 'Mesin 1 Naufal harus tampil sebagai ADMIN-01');
assert.equal(adminVirtualCode2, 'ADMIN-05', 'Mesin 2 Naufal harus tampil sebagai ADMIN-05');

// Resolusi staf yang digantikan
const substitutedStaff = getSubstitutedDroppingStaff({
  droppingStaff: staffList,
  substituteUserId: substituteId,
});
assert.equal(substitutedStaff?.full_name, 'Naufal Dropping');

// Header title
const headerTitle = getDroppingPageHeaderTitle({
  profile: adminProfile,
  substituteStaff: substitutedStaff,
});
assert.equal(
  headerTitle,
  'Daftar dropping Super Admin Cabang (Menggantikan Naufal Dropping)'
);

console.log('✓ Skenario B: Admin pengganti mewarisi toko Naufal dengan virtual prefix ADMIN-XX lulus 100%');
console.log('🎉 SEMUA PENGUJIAN INTEGRASI BERHASIL!\n');

