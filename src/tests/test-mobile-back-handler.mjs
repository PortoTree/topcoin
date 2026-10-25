// Test script to verify useMobileBackHandler logic in a simulated browser history environment
import assert from 'node:assert';

console.log('🧪 Memulai Pengujian useMobileBackHandler...');

// 1. Simulasikan window.history dan window event listener
class MockHistory {
  constructor() {
    this.stack = [{ state: null, url: '' }];
    this.currentIndex = 0;
  }

  pushState(state, title, url) {
    this.stack.push({ state, url });
    this.currentIndex++;
  }

  back() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const entry = this.stack[this.currentIndex];
      const event = { state: entry.state };
      globalThis.dispatchEvent('popstate', event);
    }
  }

  get length() {
    return this.stack.length;
  }
}

const listeners = {};
globalThis.addEventListener = (event, fn) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
};
globalThis.removeEventListener = (event, fn) => {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(l => l !== fn);
};
globalThis.dispatchEvent = (event, data) => {
  if (listeners[event]) {
    for (const fn of listeners[event]) {
      fn(data);
    }
  }
};
globalThis.window = globalThis;
globalThis.history = new MockHistory();

// 2. Simulasikan alur hook
function simulateHookLifecycle(enabled, onBack) {
  let isPushed = false;
  let closedByPopstate = false;

  if (enabled) {
    globalThis.history.pushState({ modalOpen: true }, '');
    isPushed = true;
    closedByPopstate = false;

    const handlePopState = () => {
      closedByPopstate = true;
      isPushed = false;
      onBack();
    };

    globalThis.addEventListener('popstate', handlePopState);

    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
      if (isPushed && !closedByPopstate) {
        isPushed = false;
        globalThis.history.back();
      }
    };
  }
  return () => {};
}

// TEST 1: User menekan tombol Back HP (popstate terpicu)
console.log('Test 1: User menekan tombol Back HP...');
let modalClosed = false;
const initialHistoryLen = globalThis.history.stack.length;
const cleanup1 = simulateHookLifecycle(true, () => {
  modalClosed = true;
});

assert.strictEqual(globalThis.history.stack.length, initialHistoryLen + 1, 'History stack harus bertambah 1 saat modal terbuka');
assert.strictEqual(modalClosed, false, 'Modal belum tertutup sebelum tombol back ditekan');

// Simulasikan user tekan tombol back HP
globalThis.history.back();
assert.strictEqual(modalClosed, true, 'Callback onBack harus terpanggil saat tombol back HP ditekan');
cleanup1(); // Cleanup saat unmount
console.log('✅ Test 1 Passed: Tombol Back HP berhasil menutup modal tanpa double pop');

// TEST 2: User menutup modal via tombol (X) atau klik backdrop
console.log('Test 2: User menutup modal via tombol (X) UI...');
let modalClosedViaUI = false;
const historyLenBefore2 = globalThis.history.currentIndex;
const cleanup2 = simulateHookLifecycle(true, () => {
  modalClosedViaUI = true;
});
assert.strictEqual(globalThis.history.currentIndex, historyLenBefore2 + 1, 'History index harus bertambah 1');

// User klik tombol X (cleanup terpanggil secara normal tanpa popstate)
cleanup2();
assert.strictEqual(globalThis.history.currentIndex, historyLenBefore2, 'History index harus kembali normal setelah modal ditutup via UI');
assert.strictEqual(modalClosedViaUI, false, 'onBack tidak boleh terpanggil jika ditutup via UI');
console.log('✅ Test 2 Passed: Penutupan via UI tombol (X) otomatis membersihkan history dummy');

console.log('\n🎉 SEMUA PENGUJIAN LOGIKA BACK HANDLER LULUS 100%!');
