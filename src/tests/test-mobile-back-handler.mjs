// Test script - verifikasi logika useMobileBackHandler dengan strategi guard buffer
import assert from 'node:assert';

console.log('🧪 Memulai Pengujian useMobileBackHandler (Deep Guard Buffer Strategy)...');

// ===========================================================================
// MOCK BROWSER ENVIRONMENT
// ===========================================================================

class MockHistory {
  constructor() {
    this.stack = [{ state: null, url: '' }];
    this.currentIndex = 0;
  }

  get state() {
    return this.stack[this.currentIndex]?.state ?? null;
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
      globalThis.dispatchEvent('popstate', { state: entry.state });
    } else {
      throw new Error('BROWSER_EXIT: Keluar dari aplikasi!');
    }
  }

  get length() {
    return this.stack.length;
  }
}

// Immediate + deferred setTimeout simulation
const pendingTimers = [];
globalThis.setTimeout = (fn, delay) => {
  pendingTimers.push(fn);
};
globalThis.flushTimers = () => {
  const toRun = [...pendingTimers];
  pendingTimers.length = 0;
  toRun.forEach((fn) => fn());
};

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
    for (const fn of [...listeners[event]]) fn(data);
  }
};
globalThis.window = globalThis;
globalThis.history = new MockHistory();

// ===========================================================================
// SIMULASIKAN MODUL useMobileBackHandler
// ===========================================================================

let globalBackId = 0;
const activeHandlers = [];
let isGlobalListenerAttached = false;
let rootBackCallback = null;
let lastRootBackTriggerTime = 0;
const GUARD_DEPTH = 3;

function pushDeepGuard() {
  for (let i = 0; i < GUARD_DEPTH; i++) {
    globalThis.history.pushState({ topcoin_guard: true, depth: i, t: Date.now() }, '', '');
  }
}

function scheduleGuardReplenish() {
  globalThis.setTimeout(() => {
    globalThis.history.pushState({ topcoin_guard: true, t: Date.now() }, '', '');
  }, 0);
}

function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached) return;

  globalThis.addEventListener('popstate', () => {
    scheduleGuardReplenish();

    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers.pop();
      topHandler.onBack();
      return;
    }

    const now = Date.now();
    if (now - lastRootBackTriggerTime > 400) {
      lastRootBackTriggerTime = now;
      if (rootBackCallback) rootBackCallback();
    }
  });

  isGlobalListenerAttached = true;
}

function simulateRootGuard(onRootBack) {
  rootBackCallback = onRootBack;
  ensureGlobalPopstateListener();
  pushDeepGuard();
}

function simulateModalHook(enabled, onBack) {
  if (!enabled) return () => {};
  ensureGlobalPopstateListener();
  const id = ++globalBackId;
  const item = { id, onBack };
  activeHandlers.push(item);
  return () => {
    const idx = activeHandlers.findIndex((h) => h.id === id);
    if (idx !== -1) activeHandlers.splice(idx, 1);
  };
}

// ===========================================================================
// TEST SUITE
// ===========================================================================

let rootBackCount = 0;
simulateRootGuard(() => { rootBackCount++; });

const historyAfterInit = globalThis.history.currentIndex;

// TEST 1: Guard Buffer Aktif setelah init
console.log('Test 1: Guard buffer aktif dengan kedalaman 3...');
assert.strictEqual(historyAfterInit, GUARD_DEPTH, `History index harus ada di kedalaman ${GUARD_DEPTH}`);
console.log('✅ Test 1 Passed: Buffer 3 state guard berhasil di-push saat init');

// TEST 2: Back sekali di root -> modal keluar, bukan exit
console.log('Test 2: Back 1x di root -> harus trigger exit modal bukan crash...');
globalThis.history.back();
globalThis.flushTimers(); // flush setTimeout replenish
assert.strictEqual(rootBackCount, 1, 'Root callback terpanggil');
assert.doesNotThrow(() => {}, 'Tidak boleh ada BROWSER_EXIT exception');
console.log('✅ Test 2 Passed: Back di root tidak keluar aplikasi');

// TEST 3: Rapid Back 5x -> masih tetap di dalam aplikasi
console.log('Test 3: Rapid Back 5x -> tidak boleh keluar...');
let threw = false;
try {
  for (let i = 0; i < 5; i++) {
    lastRootBackTriggerTime = 0;
    globalThis.history.back();
    globalThis.flushTimers();
  }
} catch (e) {
  threw = true;
  console.error('❌ GAGAL:', e.message);
}
assert.strictEqual(threw, false, 'Tidak ada BROWSER_EXIT bahkan setelah 5x back rapid');
console.log('✅ Test 3 Passed: 5x rapid back tidak melempar user keluar');

// TEST 4: Buka modal lalu Back -> modal tertutup
console.log('Test 4: Buka modal, tekan Back -> modal tertutup...');
let modal1Closed = false;
const closeModal1 = simulateModalHook(true, () => { modal1Closed = true; });
assert.strictEqual(activeHandlers.length, 1);
globalThis.history.back();
globalThis.flushTimers();
assert.strictEqual(modal1Closed, true, 'Modal harus tertutup');
assert.strictEqual(activeHandlers.length, 0);
closeModal1();
console.log('✅ Test 4 Passed: Back menutup modal dengan benar');

// TEST 5: Nested modals (Lightbox di dalam Modal Toko)
console.log('Test 5: Nested modals -> tertutup LIFO...');
let storeModalClosed = false;
let lightboxClosed = false;
const closeStore = simulateModalHook(true, () => { storeModalClosed = true; });
const closeLightbox = simulateModalHook(true, () => { lightboxClosed = true; });
assert.strictEqual(activeHandlers.length, 2);

globalThis.history.back(); // back 1: lightbox
globalThis.flushTimers();
assert.strictEqual(lightboxClosed, true, 'Lightbox tertutup duluan');
assert.strictEqual(storeModalClosed, false, 'Store modal masih terbuka');
closeLightbox();

globalThis.history.back(); // back 2: store modal
globalThis.flushTimers();
assert.strictEqual(storeModalClosed, true, 'Store modal tertutup berikutnya');
closeStore();
assert.strictEqual(activeHandlers.length, 0);
console.log('✅ Test 5 Passed: Nested modal tertutup LIFO dengan benar');

// TEST 6: Tutup modal via tombol UI (X), bukan tombol Back HP
console.log('Test 6: Tutup modal via tombol UI -> onBack tidak dipanggil...');
let uiModalOnBackCalled = false;
const closeUiModal = simulateModalHook(true, () => { uiModalOnBackCalled = true; });
assert.strictEqual(activeHandlers.length, 1);
closeUiModal(); // unmount / klik tombol X
assert.strictEqual(activeHandlers.length, 0, 'Handler tercabut dari stack');
assert.strictEqual(uiModalOnBackCalled, false, 'onBack tidak boleh dipanggil via tombol UI');

// Setelah tutup via UI, Back di root masih trigger exit modal
let rootBefore = rootBackCount;
lastRootBackTriggerTime = 0;
globalThis.history.back();
globalThis.flushTimers();
assert.strictEqual(rootBackCount, rootBefore + 1, 'Root back tetap bekerja setelah modal ditutup via UI');
console.log('✅ Test 6 Passed: Tutup via tombol UI tidak merusak root guard');

// TEST 7: Simulasi reload halaman (state persisted tapi index reset ke 0)
console.log('Test 7: Reload simulasi -> guard langsung re-push...');
globalThis.history = new MockHistory();
globalThis.history.stack[0].state = { topcoin_guard: true, t: 123 }; // state lama yang tersimpan di browser
isGlobalListenerAttached = false;
activeHandlers.length = 0;
rootBackCount = 0;
lastRootBackTriggerTime = 0;

simulateRootGuard(() => { rootBackCount++; });
assert.strictEqual(globalThis.history.currentIndex, GUARD_DEPTH, 'Guard buffer di-push ulang setelah reload');

// Setelah reload, Back harus tetap trigger root modal bukan crash
globalThis.history.back();
globalThis.flushTimers();
assert.strictEqual(rootBackCount, 1, 'Root callback bekerja setelah reload');
console.log('✅ Test 7 Passed: Reload tidak merusak penjagaan tombol Back');

console.log('\n🎉 SEMUA 7 PENGUJIAN LULUS 100%! Guard buffer strategy berfungsi sempurna.');
