import { useEffect, useRef } from 'react';

export interface UseMobileBackHandlerOptions {
  /**
   * Menentukan apakah listener tombol back HP aktif (misal saat modal sedang terbuka).
   * Default: true
   */
  enabled?: boolean;
  /**
   * Fungsi yang dipanggil saat user menekan tombol Back bawaan HP (hardware / gesture swipe).
   */
  onBack: () => void;
}

interface HandlerItem {
  id: number;
  onBack: () => void;
}

let globalBackId = 0;
const activeHandlers: HandlerItem[] = [];
let isGlobalListenerAttached = false;
let rootBackCallback: (() => void) | null = null;
let lastRootBackTriggerTime = 0;

/**
 * Memaksa penambahan 1 entri penahan di browser history.
 * Menjamin browser selalu memiliki minimal 1 langkah riwayat untuk di-pop,
 * bahkan setelah halaman di-reload.
 */
export function pushGuard() {
  if (typeof window === 'undefined') return;
  try {
    window.history.pushState({ topcoin_guard: true, t: Date.now() }, '', window.location.href);
  } catch {
    // Abaikan jika browser membatasi pushState
  }
}

/**
 * Memastikan selalu ada history state penahan (guard) di browser jika belum ada.
 * Dipanggil saat ada interaksi user (touch/pointerdown/click).
 */
export function ensureHistoryGuard() {
  if (typeof window === 'undefined') return;
  try {
    if (!window.history.state || !window.history.state.topcoin_guard) {
      pushGuard();
    }
  } catch {
    // Abaikan jika browser membatasi pushState
  }
}

/**
 * Memasang global popstate listener satu kali saja di window.
 * Menjamin riwayat browser tidak pernah mundur melewati batas aman (tidak keluar aplikasi).
 */
function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;

  // 1. Tangani event popstate (saat user menekan tombol hardware / gesture Back di HP)
  window.addEventListener('popstate', () => {
    // KUNCI UTAMA: Seketika re-push guard state agar browser history TIDAK AKAN PERNAH
    // mencapai index 0 / keluar dari tab atau aplikasi, berapapun kali tombol back ditekan cepat!
    pushGuard();

    // 2. Jika ada modal / sheet / subview yang sedang aktif di stack:
    // Tutup elemen teratas (LIFO - Last In First Out)
    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers.pop()!;
      topHandler.onBack();
      return;
    }

    // 3. JIKA activeHandlers KOSONG (berada di halaman utama / root):
    // Panggil rootBackCallback untuk membuka Modal Konfirmasi Keluar.
    // Beri jeda debounce 300ms agar penekanan beruntun tidak memicu flicker.
    const now = Date.now();
    if (now - lastRootBackTriggerTime > 300) {
      lastRootBackTriggerTime = now;
      if (rootBackCallback) {
        rootBackCallback();
      }
    }
  });

  // 4. Perkuat penjagaan dengan User Gesture:
  // Browser Chromium/Android membutuhkan interaksi nyata user agar pushState tidak diabaikan
  // oleh 'History Manipulation Intervention'.
  const handleUserInteraction = () => {
    ensureHistoryGuard();
  };

  window.addEventListener('pointerdown', handleUserInteraction, { passive: true, capture: true });
  window.addEventListener('touchstart', handleUserInteraction, { passive: true, capture: true });
  window.addEventListener('click', handleUserInteraction, { passive: true, capture: true });
  window.addEventListener('keydown', handleUserInteraction, { passive: true, capture: true });

  isGlobalListenerAttached = true;
}

/**
 * Hook penjaga halaman utama (root guard).
 * Dijalankan di komponen root (App.tsx).
 * Memastikan tombol Back bawaan HP di halaman utama menampilkan modal konfirmasi keluar,
 * dan TIDAK PERNAH keluar langsung tanpa konfirmasi dari user.
 */
export function useRootBackGuard(onRootBack?: () => void) {
  const onRootBackRef = useRef(onRootBack);
  onRootBackRef.current = onRootBack;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    rootBackCallback = () => {
      if (onRootBackRef.current) {
        onRootBackRef.current();
      }
    };

    ensureGlobalPopstateListener();
    pushGuard();

    return () => {
      rootBackCallback = null;
    };
  }, []);
}

/**
 * Custom Hook untuk menangani navigasi tombol Back bawaan HP (hardware button atau gesture swipe)
 * agar modal / sub-view / drawer tertutup satu per satu secara native tanpa merusak browser history.
 */
export function useMobileBackHandler({
  enabled = true,
  onBack,
}: UseMobileBackHandlerOptions) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    ensureGlobalPopstateListener();
    pushGuard();

    const id = ++globalBackId;
    const handlerItem: HandlerItem = {
      id,
      onBack: () => onBackRef.current(),
    };

    activeHandlers.push(handlerItem);

    return () => {
      // Keluarkan dari activeHandlers stack jika ditutup via UI (tombol X, batal, atau state)
      const idx = activeHandlers.findIndex((h) => h.id === id);
      if (idx !== -1) {
        activeHandlers.splice(idx, 1);
      }
    };
  }, [enabled]);
}
