import assert from 'node:assert/strict';
import {
  generateAutoUsername,
  generateAutoPrefix,
  validateNewStaffForm,
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

console.log('\n🎉 SEMUA PENGUJIAN LOGIKA STAF LULUS 100%!');

