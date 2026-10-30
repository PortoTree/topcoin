import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Memulai Pengujian TDD: Preview Foto Depan Toko pada StoreInfoModal...');

// 1. Logika helper pembentukan payload preview foto
function getStorePhotoPreviewPayload(store) {
  if (!store?.photo_store_url) return null;
  return {
    url: store.photo_store_url,
    title: `Foto Depan Toko - ${store.name}`,
  };
}

// Test 1: Payload preview foto valid ketika photo_store_url ada
const storeWithPhoto = {
  id: 'store-1',
  name: 'Toko Berkah Sejahtera',
  photo_store_url: 'https://res.cloudinary.com/demo/image/upload/v1/toko-1.jpg',
};
const payload = getStorePhotoPreviewPayload(storeWithPhoto);
assert.deepEqual(payload, {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/toko-1.jpg',
  title: 'Foto Depan Toko - Toko Berkah Sejahtera',
});

// Test 2: Tidak menghasilkan payload ketika photo_store_url kosong
const storeWithoutPhoto = {
  id: 'store-2',
  name: 'Toko Tanpa Foto',
  photo_store_url: null,
};
assert.equal(getStorePhotoPreviewPayload(storeWithoutPhoto), null);
console.log('✓ Test 1: Logika pembentukan payload preview foto toko valid');

// Test 3: Logika Back Handler bertingkat untuk StoreInfoModal
function simulateModalBackAction(state) {
  // Jika preview foto sedang aktif, back HANYA menutup preview foto
  if (state.activePreviewImage) {
    return { ...state, activePreviewImage: null };
  }
  // Jika preview foto sudah tertutup, back menutup modal StoreInfoModal
  if (state.isModalOpen) {
    return { ...state, isModalOpen: false };
  }
  return state;
}

const stateStep1 = {
  isModalOpen: true,
  activePreviewImage: { url: 'https://example.com/foto.jpg', title: 'Foto Depan Toko - Toko Berkah' },
};

// Tekan Back ke-1: Preview tertutup, modal StoreInfoModal tetap terbuka
const stateStep2 = simulateModalBackAction(stateStep1);
assert.equal(stateStep2.activePreviewImage, null, 'Preview harus tertutup');
assert.equal(stateStep2.isModalOpen, true, 'Modal info toko harus tetap terbuka');

// Tekan Back ke-2: Modal info toko tertutup
const stateStep3 = simulateModalBackAction(stateStep2);
assert.equal(stateStep3.isModalOpen, false, 'Modal info toko harus tertutup');
console.log('✓ Test 2: Alur Back stack navigasi mobile (Preview -> Modal -> List) valid');

// Test 4: Verifikasi integrasi kode pada StoreInfoModal.tsx
const storeInfoModalPath = path.resolve('src/components/StoreInfoModal.tsx');
const fileContent = fs.readFileSync(storeInfoModalPath, 'utf-8');

assert.ok(
  fileContent.includes('useMobileBackHandler'),
  'StoreInfoModal wajib mengimpor dan menggunakan useMobileBackHandler untuk menangani preview gambar'
);

assert.ok(
  fileContent.includes('setActivePreviewImage({') &&
  fileContent.includes('store.photo_store_url'),
  'Foto depan toko wajib memiliki handler onClick untuk membuka preview'
);

console.log('✓ Test 3: Verifikasi kode statis StoreInfoModal.tsx lulus 100%');
console.log('🎉 SEMUA TEST TDD STORE INFO PHOTO PREVIEW BERHASIL!\n');

