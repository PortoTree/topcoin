import assert from 'node:assert/strict';
import {
  formatMachineCode,
  formatMachineBadge,
  displayMachineCode,
  parseMachineCode,
  generateDroppingMachineCodes,
  getNextAvailableMachineNumber,
  recodeMachinesForDropping,
  validateNewMachineInput,
} from '../lib/machineCodeLogic.ts';

console.log('🧪 Memulai Pengujian Logika Hybrid Kode Mesin (TDD)...');

// TEST 1: Sanitasi Prefix & Formatting 2-Digit
console.log('Test 1: Sanitasi Prefix & Format 2-Digit...');
assert.equal(formatMachineCode('pampam-', 1), 'PAMPAM-01');
assert.equal(formatMachineCode('  Pampam  ', 5), 'PAMPAM-05');
assert.equal(formatMachineCode('pampam', 20), 'PAMPAM-20');
assert.equal(formatMachineCode('budi', 10), 'BUDI-10');
assert.equal(formatMachineCode(null, 3), 'MESIN-03');
assert.equal(formatMachineBadge('pampam', 1), 'PAMPAM-01');
assert.equal(displayMachineCode('PAMPAM-01'), 'PAMPAM-01');
assert.equal(displayMachineCode('[PAMPAM-01]'), 'PAMPAM-01');
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

// TEST 6: Validasi Input Penambahan Mesin (Range 1-20, Duplicate Code, Quota 20)
console.log('Test 6: Validasi Input Penambahan Mesin...');
const sampleExisting = [
  { machine_code: 'PAMPAM-01', machine_number: 1, assigned_dropping_id: 'user-pampam' },
  { machine_code: 'PAMPAM-02', machine_number: 2, assigned_dropping_id: 'user-pampam' },
];

// 6a. Range di luar 1..20 harus ditolak
const resInvalidRange1 = validateNewMachineInput({
  machineNumber: 0,
  prefix: 'PAMPAM',
  existingMachines: sampleExisting,
  targetDroppingId: 'user-pampam',
});
assert.equal(resInvalidRange1.isValid, false);

const resInvalidRange2 = validateNewMachineInput({
  machineNumber: 21,
  prefix: 'PAMPAM',
  existingMachines: sampleExisting,
  targetDroppingId: 'user-pampam',
});
assert.equal(resInvalidRange2.isValid, false);

// 6b. Duplikasi kode mesin harus ditolak
const resDuplicate = validateNewMachineInput({
  machineNumber: 1,
  prefix: 'PAMPAM',
  existingMachines: sampleExisting,
  targetDroppingId: 'user-pampam',
});
assert.equal(resDuplicate.isValid, false);
assert.match(resDuplicate.error || '', /sudah terdaftar/i);

// 6c. Kuota 20 unit per dropping
const full20Machines = Array.from({ length: 20 }, (_, idx) => ({
  machine_code: `PAMPAM-${String(idx + 1).padStart(2, '0')}`,
  machine_number: idx + 1,
  assigned_dropping_id: 'user-pampam',
}));
const resQuota = validateNewMachineInput({
  machineNumber: 5,
  prefix: 'PAMPAM',
  existingMachines: full20Machines,
  targetDroppingId: 'user-pampam',
  targetDroppingName: 'Naufal Pampam',
});
assert.equal(resQuota.isValid, false);
assert.match(resQuota.error || '', /maksimal 20 unit/i);

// 6d. Input valid harus diterima
const resValid = validateNewMachineInput({
  machineNumber: 3,
  prefix: 'PAMPAM',
  existingMachines: sampleExisting,
  targetDroppingId: 'user-pampam',
});
assert.equal(resValid.isValid, true);
assert.equal(resValid.error, undefined);
console.log('✓ Test 6 Lulus: Validasi batas 1-20, duplikasi kode, dan kuota 20 unit teruji 100%');

console.log('\n🎉 SEMUA PENGUJIAN LOGIKA HYBRID KODE MESIN LULUS 100%!');
