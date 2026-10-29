import assert from 'node:assert/strict';
import {
  formatMachineCode,
  formatMachineBadge,
  displayMachineCode,
  parseMachineCode,
  generateDroppingMachineCodes,
  getNextAvailableMachineNumber,
  recodeMachinesForDropping,
} from '../lib/machineCodeLogic.ts';

console.log('🧪 Memulai Pengujian Logika Hybrid Kode Mesin (TDD)...');

// TEST 1: Sanitasi Prefix & Formatting 2-Digit
console.log('Test 1: Sanitasi Prefix & Format 2-Digit...');
assert.equal(formatMachineCode('pampam-', 1), 'PAMPAM-01');
assert.equal(formatMachineCode('  Pampam  ', 5), 'PAMPAM-05');
assert.equal(formatMachineCode('pampam', 20), 'PAMPAM-20');
assert.equal(formatMachineCode('budi', 10), 'BUDI-10');
assert.equal(formatMachineCode(null, 3), 'MESIN-03');
assert.equal(formatMachineBadge('pampam', 1), '[PAMPAM-01]');
assert.equal(displayMachineCode('PAMPAM-01'), '[PAMPAM-01]');
assert.equal(displayMachineCode('[PAMPAM-01]'), '[PAMPAM-01]');
assert.equal(displayMachineCode(null), 'Tanpa Mesin');
console.log('✓ Test 1 Lulus: Prefix disanitasi & nomor dipad menjadi 2 digit');

// TEST 2: Parsing Kode Mesin
console.log('Test 2: Parsing Kode Mesin...');
const parsed1 = parseMachineCode('PAMPAM-01');
assert.equal(parsed1.prefix, 'PAMPAM');
assert.equal(parsed1.number, 1);

const parsed2 = parseMachineCode('[BUDI-15]');
assert.equal(parsed2.prefix, 'BUDI');
assert.equal(parsed2.number, 15);

const parsedLegacy = parseMachineCode('M-001');
assert.equal(parsedLegacy.prefix, 'M');
assert.equal(parsedLegacy.number, 1);
console.log('✓ Test 2 Lulus: Kode mesin berhasil diparse menjadi prefix & nomor');

// TEST 3: Generate Satu Set Kode Mesin Dropping (1 - 20)
console.log('Test 3: Generate Satu Set Mesin Dropping 1-20...');
const set20 = generateDroppingMachineCodes('PAMPAM', 20);
assert.equal(set20.length, 20);
assert.equal(set20[0], 'PAMPAM-01');
assert.equal(set20[9], 'PAMPAM-10');
assert.equal(set20[19], 'PAMPAM-20');
console.log('✓ Test 3 Lulus: Generate 20 mesin dropping sesuai urutan 01-20');

// TEST 4: Menentukan Nomor Mesin Kosong Berikutnya
console.log('Test 4: Menentukan Slot Nomor Kosong Berikutnya...');
const next1 = getNextAvailableMachineNumber([1, 2, 3, 4, 5]);
assert.equal(next1, 6);

// Jika ada nomor yang lompat/kosong (misal nomor 2 ditarik ke gudang), isi slot kosong
const next2 = getNextAvailableMachineNumber([1, 3, 4]);
assert.equal(next2, 2);
console.log('✓ Test 4 Lulus: Otomatis mendeteksi nomor urut kosong atau slot berikutnya');

// TEST 5: Recode Mesin saat Prefix Dropping Diubah Admin/BM
console.log('Test 5: Recode Mesin saat Prefix Berubah...');
const oldMachines = [
  { id: 'm1', machine_number: 1, machine_code: 'PAMPAM-01' },
  { id: 'm2', machine_number: 2, machine_code: 'PAMPAM-02' },
  { id: 'm3', machine_number: 20, machine_code: 'PAMPAM-20' },
];
const recoded = recodeMachinesForDropping(oldMachines, 'PAM-BARAT');
assert.equal(recoded[0].machine_code, 'PAM-BARAT-01');
assert.equal(recoded[1].machine_code, 'PAM-BARAT-02');
assert.equal(recoded[2].machine_code, 'PAM-BARAT-20');
console.log('✓ Test 5 Lulus: Recode massal mesin berhasil saat prefix akun diubah');

console.log('\n🎉 SEMUA PENGUJIAN LOGIKA HYBRID KODE MESIN LULUS 100%!');
