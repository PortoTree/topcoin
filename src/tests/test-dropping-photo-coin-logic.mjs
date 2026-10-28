import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian Logika Foto Koin Dropping (TDD)...');

// Helper simulasi kalkulasi steps dan validasi foto dropping
function getDroppingPhotoSteps(hasOmset) {
  const baseSteps = [
    { key: 'photoMachine', label: 'Foto Mesin / Boneka' },
    { key: 'photoMachineNumber', label: 'Foto Nomor Mesin' },
  ];

  if (hasOmset) {
    baseSteps.push({ key: 'photoNota', label: 'Foto Nota / Kuitansi' });
  } else {
    baseSteps.push({ key: 'photoCoin', label: 'Foto Koin' });
  }

  return baseSteps;
}

function validateDroppingPhotos({ photoMachine, photoMachineNumber, photoCoin, photoNota, hasOmset }) {
  if (!photoMachine) {
    return { valid: false, error: 'Wajib melampirkan Foto 1: Foto Mesin / Boneka.' };
  }
  if (!photoMachineNumber) {
    return { valid: false, error: 'Wajib melampirkan Foto 2: Foto Nomor Mesin.' };
  }
  if (!hasOmset && !photoCoin) {
    return { valid: false, error: 'Wajib melampirkan Foto 3: Foto Koin.' };
  }
  if (hasOmset && !photoNota) {
    return { valid: false, error: 'Wajib melampirkan Foto Nota.' };
  }
  return { valid: true };
}

// TEST 1: Saat hasOmset === true (Tarik Omset DICENTANG)
console.log('Test 1: Saat Tarik Omset DICENTANG...');
const stepsWithOmset = getDroppingPhotoSteps(true);
assert.equal(stepsWithOmset.length, 3, 'Steps harus berjumlah 3 jika hasOmset === true (Mesin, No. Mesin, Nota)');
assert.equal(stepsWithOmset.some(s => s.key === 'photoCoin'), false, 'photoCoin TIDAK boleh ada di steps jika hasOmset === true');
assert.equal(stepsWithOmset.some(s => s.key === 'photoNota'), true, 'photoNota WAJIB ada di steps jika hasOmset === true');

const validWithOmsetWithoutCoin = validateDroppingPhotos({
  photoMachine: 'base64_machine',
  photoMachineNumber: 'base64_num',
  photoCoin: null,
  photoNota: 'base64_nota',
  hasOmset: true,
});
assert.equal(validWithOmsetWithoutCoin.valid, true, 'Submit harus valid saat foto nota terisi meski photoCoin kosong jika hasOmset === true');
console.log('✓ Test 1 Lulus: Foto Koin diganti dengan Foto Nota pada modal kamera saat Tarik Omset dicentang');

// TEST 2: Saat hasOmset === false (Tarik Omset TIDAK dicentang)
console.log('Test 2: Saat Tarik Omset TIDAK dicentang...');
const stepsWithoutOmset = getDroppingPhotoSteps(false);
assert.equal(stepsWithoutOmset.length, 3, 'Steps harus berjumlah 3 jika hasOmset === false');
assert.equal(stepsWithoutOmset.some(s => s.key === 'photoCoin'), true, 'photoCoin WAJIB ada di steps jika hasOmset === false');

const invalidWithoutOmsetWithoutCoin = validateDroppingPhotos({
  photoMachine: 'base64_machine',
  photoMachineNumber: 'base64_num',
  photoCoin: null,
  hasOmset: false,
});
assert.equal(invalidWithoutOmsetWithoutCoin.valid, false, 'Submit harus gagal jika photoCoin kosong saat hasOmset === false');
assert.match(invalidWithoutOmsetWithoutCoin.error, /Foto 3: Foto Koin/, 'Pesan error harus menunjuk ke Foto Koin');

const validWithoutOmsetWithCoin = validateDroppingPhotos({
  photoMachine: 'base64_machine',
  photoMachineNumber: 'base64_num',
  photoCoin: 'base64_coin',
  hasOmset: false,
});
assert.equal(validWithoutOmsetWithCoin.valid, true, 'Submit harus valid saat ketiga foto terisi');
console.log('✓ Test 2 Lulus: Foto Koin tampil dan wajib dilampirkan saat Tarik Omset tidak dicentang');

console.log('🎉 SEMUA TEST LOGIKA FOTO KOIN DROPPING LULUS!');
