import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian Validasi Dropping Form & Tombol Disable (TDD)...');

// Fungsi pembantu menghitung daftar field yang belum diisi
export function getMissingFields({
  hasOptional,
  isStoreClosed,
  isMinimalCoin,
  photoOptional,
  optionalNotes,
  photoMachine,
  photoMachineNumber,
  photoCoin,
  hasOmset,
  coinsCollected,
  photoNota,
  hasMismatch,
  discrepancyReason,
  actualPhysicalMeter,
  noOmsetMeterStr,
}) {
  const missing = [];

  // 1. JALUR KENDALA / OPSIONAL (Bypass Foto Wajib)
  if (hasOptional) {
    const hasAnyOptionalContent = Boolean(
      isStoreClosed ||
      isMinimalCoin ||
      photoOptional ||
      (optionalNotes && optionalNotes.trim().length > 0)
    );

    if (!hasAnyOptionalContent) {
      missing.push('Pilih Kendala (Toko Tutup / Minimal Koin) atau isi Foto / Catatan');
    }

    if (hasOmset) {
      if (!coinsCollected || coinsCollected <= 0) missing.push('Total Koin');
      if (!photoNota) missing.push('Foto Nota');
      if (hasMismatch) {
        if (actualPhysicalMeter === null) missing.push('Meteran Fisik');
        if (!discrepancyReason?.trim()) missing.push('Alasan Selisih');
      }
    }

    return missing;
  }

  // 2. JALUR NORMAL (Foto wajib harus lengkap)
  if (!photoMachine) missing.push('Foto Mesin');
  if (!photoMachineNumber) missing.push('Foto No. Mesin');
  if (!hasOmset && !photoCoin) missing.push('Foto Koin');

  if (hasOmset) {
    if (!coinsCollected || coinsCollected <= 0) missing.push('Total Koin');
    if (!photoNota) missing.push('Foto Nota');
    if (hasMismatch) {
      if (actualPhysicalMeter === null) missing.push('Meteran Fisik');
      if (!discrepancyReason?.trim()) missing.push('Alasan Selisih');
    }
  } else {
    if (!noOmsetMeterStr || !noOmsetMeterStr.trim()) missing.push('Angka Meteran');
  }

  return missing;
}

// Fungsi pembantu logika validasi tombol Simpan (isFormValid)
function checkIsFormValid(props) {
  return getMissingFields(props).length === 0;
}

// TEST 1: Normal Flow - Foto Wajib lengkap, Tarik Omset aktif TANPA Foto Nota -> Harus FALSE (Disable)
console.log('Test 1: Tarik omset aktif tanpa Foto Nota...');
const test1 = checkIsFormValid({
  hasOptional: false,
  photoMachine: 'data:img1',
  photoMachineNumber: 'data:img2',
  photoCoin: null,
  hasOmset: true,
  coinsCollected: 30,
  photoNota: null, // belum ada foto nota
  hasMismatch: false,
});
assert.equal(test1, false, 'Tombol harus disable jika Tarik Omset aktif tapi belum ada Foto Nota');
console.log('✓ Test 1 Lulus: Foto Nota wajib saat Tarik Omset');

// TEST 2: Normal Flow - Tarik Omset aktif DENGAN Foto Nota -> Harus TRUE (Enable)
console.log('Test 2: Tarik omset aktif DENGAN Foto Nota...');
const test2 = checkIsFormValid({
  hasOptional: false,
  photoMachine: 'data:img1',
  photoMachineNumber: 'data:img2',
  photoCoin: null,
  hasOmset: true,
  coinsCollected: 30,
  photoNota: 'data:img_nota',
  hasMismatch: false,
});
assert.equal(test2, true, 'Tombol harus aktif saat semua syarat normal terpenuhi');
console.log('✓ Test 2 Lulus: Tombol aktif saat foto wajib & foto nota terisi');

// TEST 3: Jalur Kendala / Opsional - TANPA Foto Wajib, tapi centang Toko Tutup -> Harus TRUE (Enable)
console.log('Test 3: Kendala Toko Tutup tanpa foto wajib...');
const test3 = checkIsFormValid({
  hasOptional: true,
  isStoreClosed: true,
  isMinimalCoin: false,
  photoOptional: null,
  optionalNotes: '',
  photoMachine: null, // TANPA foto mesin
  photoMachineNumber: null, // TANPA foto nomor mesin
  photoCoin: null,
  hasOmset: false,
  noOmsetMeterStr: '',
});
assert.equal(test3, true, 'Tombol harus aktif saat ada kendala toko tutup meskipun tanpa foto wajib');
console.log('✓ Test 3 Lulus: Opsional Toko Tutup mengizinkan simpan tanpa foto wajib');

// TEST 4: Jalur Kendala / Opsional - hasOptional dicentang tapi belum ada isi apapun -> Harus FALSE (Disable)
console.log('Test 4: Opsional dicentang tapi kosong...');
const test4 = checkIsFormValid({
  hasOptional: true,
  isStoreClosed: false,
  isMinimalCoin: false,
  photoOptional: null,
  optionalNotes: '',
  photoMachine: null,
  photoMachineNumber: null,
  photoCoin: null,
  hasOmset: false,
  noOmsetMeterStr: '',
});
assert.equal(test4, false, 'Tombol harus disable jika opsional dicentang tapi belum ada kendala/foto/catatan');
console.log('✓ Test 4 Lulus: Tombol disable jika opsional belum ada isinya');

// TEST 5: Jalur Kendala - Minimal Koin (MK) dengan catatan kendala -> Harus TRUE (Enable)
console.log('Test 5: Minimal Koin (MK)...');
const test5 = checkIsFormValid({
  hasOptional: true,
  isStoreClosed: false,
  isMinimalCoin: true,
  photoOptional: null,
  optionalNotes: 'Koin di bawah target',
  photoMachine: null,
  photoMachineNumber: null,
  photoCoin: null,
  hasOmset: false,
  noOmsetMeterStr: '',
});
assert.equal(test5, true, 'Tombol harus aktif saat Minimal Koin dicentang');
console.log('✓ Test 5 Lulus: Opsional Minimal Koin (MK) berfungsi valid');

// TEST 6: Missing fields saat hanya Foto Nota yang belum diisi (Tarik Omset)
console.log('Test 6: Validasi missingFields hanya memuat Foto Nota...');
const missing6 = getMissingFields({
  hasOptional: false,
  photoMachine: 'data:img1',
  photoMachineNumber: 'data:img2',
  photoCoin: null,
  hasOmset: true,
  coinsCollected: 50,
  photoNota: null,
  hasMismatch: false,
});
assert.deepEqual(missing6, ['Foto Nota'], 'Harus hanya memuat Foto Nota yang belum diisi');
console.log('✓ Test 6 Lulus: missingFields hanya menampilkan ["Foto Nota"]');

// TEST 7: Missing fields saat Foto Mesin dan Foto Koin belum diisi (Kunjungan Biasa)
console.log('Test 7: Validasi missingFields saat Foto Mesin dan Koin kosong...');
const missing7 = getMissingFields({
  hasOptional: false,
  photoMachine: null,
  photoMachineNumber: 'data:img2',
  photoCoin: null,
  hasOmset: false,
  noOmsetMeterStr: '1234',
});
assert.deepEqual(missing7, ['Foto Mesin', 'Foto Koin'], 'Harus memuat Foto Mesin dan Foto Koin');
console.log('✓ Test 7 Lulus: missingFields hanya menampilkan ["Foto Mesin", "Foto Koin"]');

console.log('\n🎉 SEMUA TEST VALIDASI & DISABLE TOMBOL LULUS 100%!');

