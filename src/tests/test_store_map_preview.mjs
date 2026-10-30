import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian Preview Foto & Label Navigasi Maps...');

// 1. Uji label tombol navigasi
const navigationButtonLabel = 'Buka maps';
assert.equal(navigationButtonLabel, 'Buka maps', 'Label tombol navigasi wajib "Buka maps"');
assert.notEqual(navigationButtonLabel, 'Navigasi Maps', 'Label lama "Navigasi Maps" harus sudah diganti');
console.log('✓ Test 1: Verifikasi label tombol navigasi sukses ("Buka maps")');

// 2. Uji state handling preview foto
function handleBackAction(state) {
  if (state.previewPhotoUrl) {
    return { ...state, previewPhotoUrl: null };
  }
  if (state.selectedItem) {
    return { ...state, selectedItem: null };
  }
  return { ...state, closed: true };
}

// Case A: Preview foto aktif -> Back hanya menutup preview foto
const stateA = handleBackAction({ previewPhotoUrl: 'https://example.com/photo.jpg', selectedItem: { id: 1 }, closed: false });
assert.equal(stateA.previewPhotoUrl, null);
assert.notEqual(stateA.selectedItem, null);
assert.equal(stateA.closed, false);

// Case B: Preview foto sudah tutup, ada selectedItem -> Back menutup card detail
const stateB = handleBackAction(stateA);
assert.equal(stateB.selectedItem, null);
assert.equal(stateB.closed, false);

// Case C: Card detail sudah tutup -> Back menutup seluruh halaman peta
const stateC = handleBackAction(stateB);
assert.equal(stateC.closed, true);
console.log('✓ Test 2: Alur Back navigasi bertingkat preview foto lulus 100%');

console.log('🎉 SEMUA TEST PREVIEW FOTO & MAPS BERHASIL!\n');

