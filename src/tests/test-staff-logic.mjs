import assert from 'node:assert/strict';
import {
  generateAutoUsername,
  generateAutoPrefix,
  validateNewStaffForm,
  getStaffRoleWeight,
  compareStaff,
  filterStaff,
  validateEditStaffForm,
} from '../lib/staffLogic.ts';

console.log('🧪 Memulai Pengujian Logika Manajemen Staf (TDD)...');

// Test 1: Auto Username dari Nama Depan
console.log('Test 1: Auto Generate Username...');
assert.equal(generateAutoUsername('Andi Saputra'), 'andi');
assert.equal(generateAutoUsername('  Budi Darmawan '), 'budi');
assert.equal(generateAutoUsername('Pak Joko'), 'joko');
assert.equal(generateAutoUsername('Siti-Aisyah Putri'), 'sitiaisyah');
console.log('✓ Test 1 Lulus: Username otomatis diekstrak dari nama depan');

// Test 2: Auto Prefix Mesin untuk Dropping
console.log('Test 2: Auto Generate Prefix Mesin...');
assert.equal(generateAutoPrefix('Andi Saputra'), 'ANDI');
assert.equal(generateAutoPrefix('pampam jaya'), 'PAMPAM');
assert.equal(generateAutoPrefix(''), 'MESIN');
console.log('✓ Test 2 Lulus: Prefix mesin otomatis diekstrak dari nama depan (UPPERCASE)');

// Test 3: Validasi Form Staf
console.log('Test 3: Validasi Form Pendaftaran Staf...');
const invalidName = validateNewStaffForm({
  fullName: '',
  username: 'andi',
  phone: '081234567890',
  pin: '123456',
  role: 'dropping',
});
assert.equal(invalidName.isValid, false);

const invalidUsernameSpace = validateNewStaffForm({
  fullName: 'Andi Saputra',
  username: 'andi saputra',
  phone: '081234567890',
  pin: '123456',
  role: 'dropping',
});
assert.equal(invalidUsernameSpace.isValid, false);

const invalidPin = validateNewStaffForm({
  fullName: 'Andi Saputra',
  username: 'andi',
  phone: '081234567890',
  pin: '123',
  role: 'dropping',
});
assert.equal(invalidPin.isValid, false);

const validForm = validateNewStaffForm({
  fullName: 'Andi Saputra',
  username: 'andi',
  phone: '081234567890',
  pin: '123456',
  role: 'dropping',
  machinePrefix: 'ANDI',
});
assert.equal(validForm.isValid, true);
console.log('✓ Test 3 Lulus: Validasi form nama, username, nomor WA, dan PIN 6-digit sukses');

// Test 4: Sorting Hierarki Staf: BM (1) -> Admin (2) -> Marketing (3) -> Dropping (4) -> Lainnya (5)
console.log('Test 4: Sorting Hierarki Staf Sesuai Prioritas...');
const mockStaff = [
  { full_name: 'Zaki Dropping', role: 'dropping' },
  { full_name: 'Budi Marketing', role: 'marketing' },
  { full_name: 'Andi BM', role: 'branch_manager' },
  { full_name: 'Citra Admin', role: 'admin_cabang' },
  { full_name: 'Dono Driver', role: 'driver' },
  { full_name: 'Anton Dropping', role: 'dropping' },
];

const sorted = [...mockStaff].sort(compareStaff);
assert.equal(sorted[0].full_name, 'Andi BM'); // 1. BM
assert.equal(sorted[1].full_name, 'Citra Admin'); // 2. Admin
assert.equal(sorted[2].full_name, 'Budi Marketing'); // 3. Marketing
assert.equal(sorted[3].full_name, 'Anton Dropping'); // 4. Dropping (A duluan sebelum Z)
assert.equal(sorted[4].full_name, 'Zaki Dropping'); // 4. Dropping
assert.equal(sorted[5].full_name, 'Dono Driver'); // 5. Lainnya
console.log('✓ Test 4 Lulus: Sorting hierarki BM -> Admin -> Marketing -> Dropping -> Lainnya -> Alfabetis');

// Test 5: Search & Filter Staf
console.log('Test 5: Filter dan Pencarian Staf...');
const filteredByPhone = filterStaff([
  { full_name: 'Andi', phone: '08123456789', role: 'dropping' },
  { full_name: 'Budi', phone: '08987654321', role: 'marketing' },
], '8987');
assert.equal(filteredByPhone.length, 1);
assert.equal(filteredByPhone[0].full_name, 'Budi');

const filteredByRole = filterStaff([
  { full_name: 'Andi', phone: '08123456789', role: 'dropping' },
  { full_name: 'Budi', phone: '08987654321', role: 'marketing' },
], 'market');
assert.equal(filteredByRole.length, 1);
assert.equal(filteredByRole[0].full_name, 'Budi');
console.log('✓ Test 5 Lulus: Filter staf via nomor telepon dan peran akurat');

// Test 6: Validasi Edit Staf
console.log('Test 6: Validasi Form Edit Staf...');
const validEditWithoutPin = validateEditStaffForm({
  fullName: 'Andi Saputra Updated',
  phone: '081299998888',
  role: 'dropping',
  machinePrefix: 'ANDI',
});
assert.equal(validEditWithoutPin.isValid, true);

const invalidEditPin = validateEditStaffForm({
  fullName: 'Andi Saputra Updated',
  phone: '081299998888',
  pin: 'abc',
  role: 'dropping',
});
assert.equal(invalidEditPin.isValid, false);
console.log('✓ Test 6 Lulus: Validasi edit staf (PIN opsional ganti, no WA valid)');

console.log('\n🎉 SEMUA PENGUJIAN LOGIKA STAF LULUS 100%!');


