// Test script to verify useMobileBackHandler & useRootBackGuard logic in a simulated browser history environment
import assert from 'node:assert';

console.log('🧪 Memulai Pengujian useMobileBackHandler & Root Back Guard...');

// 1. Simulasikan browser window & history
class MockHistory {
  constructor() {
    // Pada awal buka web / reload, browser berada di index 0
    this.stack = [{ state: null, url: '' }];
    this.currentIndex = 0;
  }

  get state() {
    return this.stack[this.currentIndex]?.state || null;
  }

  pushState(state, title, url) {
    this.stack = this.stack.slice(0, this.currentIndex + 1);
    this.stack.push({ state, url });
    this.currentIndex++;
  }

  back() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const entry = this.stack[this.currentIndex];
      const event = { state: entry.state };
      globalThis.dispatchEvent('popstate', event);
    } else {
      // Browser mencoba keluar aplikasi jika currentIndex mencapai 0 lalu di-back lagi!
      throw new Error('BROWSER_EXIT_UNINTENDED: Browser keluar dari aplikasi!');
    }
  }

  get length() {
    return this.stack.length;
  }
}

const listeners = {};
globalThis.addEventListener = (event, fn, options) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
};
globalThis.removeEventListener = (event, fn) => {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter((l) => l !== fn);
};
globalThis.dispatchEvent = (event, data) => {
  if (listeners[event]) {
    for (const fn of [...listeners[event]]) {
      fn(data);
    }
  }
};
globalThis.window = globalThis;
globalThis.history = new MockHistory();

// 2. Simulasikan modul useMobileBackHandler
let globalBackId = 0;
const activeHandlers = [];
let isGlobalListenerAttached = false;
let rootBackCallback = null;
let lastRootBackTriggerTime = 0;

function pushGuard() {
  globalThis.history.pushState({ topcoin_guard: true, t: Date.now() }, '', '');
}

function ensureHistoryGuard() {
  if (!globalThis.history.state || !globalThis.history.state.topcoin_guard) {
    pushGuard();
  }
}

function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached) return;

  globalThis.addEventListener('popstate', () => {
    // 1. KUNCI UTAMA: Seketika re-push guard state agar riwayat TIDAK AKAN PERNAH jatuh ke 0
    pushGuard();

    // 2. Jika ada modal di activeHandlers:
    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers.pop();
      topHandler.onBack();
      return;
    }

    // 3. Jika di root:
    const now = Date.now();
    if (now - lastRootBackTriggerTime > 100) {
      lastRootBackTriggerTime = now;
      if (rootBackCallback) {
        rootBackCallback();
      }
    }
  });

  isGlobalListenerAttached = true;
}

function simulateRootGuard(onRootBack) {
  rootBackCallback = onRootBack;
  ensureGlobalPopstateListener();
  // Selalu push guard state saat init (meskipun reload) agar tidak berada di index 0
  pushGuard();
}

function simulateModalHook(enabled, onBack) {
  if (!enabled) return () => {};
  ensureGlobalPopstateListener();
  ensureHistoryGuard();

  const id = ++globalBackId;
  const item = { id, onBack };
  activeHandlers.push(item);

  return () => {
    const idx = activeHandlers.findIndex((h) => h.id === id);
    if (idx !== -1) {
      activeHandlers.splice(idx, 1);
    }
  };
}

// =========================================================================
// TEST SUITE
// =========================================================================

// Inisialisasi Root Guard
let rootBackCount = 0;
simulateRootGuard(() => {
  rootBackCount++;
});

// TEST 1: Tekan Back HP di Halaman Utama (Root)
console.log('Test 1: Tekan tombol Back HP di halaman utama (root)...');
assert.strictEqual(globalThis.history.currentIndex >= 1, true, 'History guard harus aktif (currentIndex >= 1)');
globalThis.history.back();
assert.strictEqual(rootBackCount, 1, 'Callback onRootBack harus terpanggil saat Back ditekan di root');
assert.strictEqual(globalThis.history.currentIndex >= 1, true, 'History guard harus langsung di-repush (tidak boleh exit)');
console.log('✅ Test 1 Passed: Tombol Back di halaman utama memicu modal keluar dan TIDAK keluar aplikasi');

// TEST 2: Tekan Back HP beruntun 5x di Root (Rapid clicks)
console.log('Test 2: Tekan tombol Back HP secara cepat beruntun 5x di halaman utama...');
let initialRootBackCount = rootBackCount;
for (let i = 0; i < 5; i++) {
  lastRootBackTriggerTime = 0;
  globalThis.history.back();
}
assert.strictEqual(rootBackCount, initialRootBackCount + 5, 'Root callback harus terpanggil di setiap penekanan');
assert.strictEqual(globalThis.history.currentIndex >= 1, true, 'Riwayat browser tetap terjaga di atas batas aman');
console.log('✅ Test 2 Passed: 5x Back beruntun tidak melempar user keluar dari aplikasi');

// TEST 3: Buka Modal, lalu Tekan Back HP
console.log('Test 3: Buka modal lalu tekan tombol Back HP...');
let modal1Closed = false;
const closeModal1 = simulateModalHook(true, () => {
  modal1Closed = true;
});
assert.strictEqual(activeHandlers.length, 1, 'Modal 1 harus terdaftar di activeHandlers');
globalThis.history.back();
assert.strictEqual(modal1Closed, true, 'Modal 1 harus tertutup');
assert.strictEqual(activeHandlers.length, 0, 'activeHandlers harus kosong setelah modal tertutup');
closeModal1(); // unmount cleanup
console.log('✅ Test 3 Passed: Tombol Back berhasil menutup modal');

// TEST 4: Nested Modals (Modal Toko -> Lightbox Foto)
console.log('Test 4: Buka 2 modal bertingkat (Nested Modals)...');
let storeModalClosed = false;
let photoLightboxClosed = false;

const closeStoreModal = simulateModalHook(true, () => {
  storeModalClosed = true;
});
const closeLightbox = simulateModalHook(true, () => {
  photoLightboxClosed = true;
});

assert.strictEqual(activeHandlers.length, 2, 'Harus ada 2 modal di stack');

// Back 1: Harus menutup Lightbox terlebih dahulu
globalThis.history.back();
assert.strictEqual(photoLightboxClosed, true, 'Lightbox harus tertutup duluan');
assert.strictEqual(storeModalClosed, false, 'Modal Toko harus tetap terbuka');
closeLightbox();

// Back 2: Harus menutup Modal Toko
globalThis.history.back();
assert.strictEqual(storeModalClosed, true, 'Modal Toko harus tertutup berikutnya');
closeStoreModal();

assert.strictEqual(activeHandlers.length, 0, 'Stack kembali bersih');
console.log('✅ Test 4 Passed: Nested modal tertutup satu-per-satu dari teratas ke terbawah');

// TEST 5: Menutup modal via tombol UI (X / Batal)
console.log('Test 5: Menutup modal via tombol UI (X)...');
let modalUiClosed = false;
const closeModalUI = simulateModalHook(true, () => {
  modalUiClosed = true;
});
assert.strictEqual(activeHandlers.length, 1);
closeModalUI(); // klik tombol X di UI (unmount)
assert.strictEqual(activeHandlers.length, 0, 'Handler harus dicabut dari stack saat tombol UI diklik');
assert.strictEqual(modalUiClosed, false, 'onBack tidak boleh dipanggil jika ditutup via tombol UI');

// Setelah tutup via UI, tekan tombol Back HP -> harus memicu root exit callback, bukan crash
let rootBefore = rootBackCount;
lastRootBackTriggerTime = 0;
globalThis.history.back();
assert.strictEqual(rootBackCount, rootBefore + 1, 'Root back harus dipanggil dengan benar setelah modal UI ditutup');
console.log('✅ Test 5 Passed: Penutupan via tombol UI tidak merusak history dan tombol back tetap aman');

// TEST 6: Reload simulasi
console.log('Test 6: Simulasi reload halaman...');
// Pada reload, history.state mungkin sudah ada objek sebelumnya, tapi posisi session ada di titik awal
globalThis.history = new MockHistory();
globalThis.history.stack[0].state = { topcoin_guard: true, t: 12345 }; // persisted state from previous session
rootBackCount = 0;
lastRootBackTriggerTime = 0;

// Pasang root guard lagi seolah app baru dimuat ulang
simulateRootGuard(() => {
  rootBackCount++;
});
// Pastikan setelah init, currentIndex bertambah jadi >= 1
assert.strictEqual(globalThis.history.currentIndex >= 1, true, 'Setelah reload, guard baru harus di-push');
globalThis.history.back();
assert.strictEqual(rootBackCount, 1, 'Back setelah reload tidak boleh melempar user keluar');
console.log('✅ Test 6 Passed: Reload tidak merusak penjagaan tombol Back');

console.log('\n🎉 SEMUA 6 PENGUJIAN LOGIKA BACK HANDLER LULUS 100%!');
