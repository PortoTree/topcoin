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

// ===========================================================================
// GLOBAL STATE (dipertahankan antar render, bukan per-komponen)
// ===========================================================================
let globalBackId = 0;
const activeHandlers: HandlerItem[] = [];
let isGlobalListenerAttached = false;
let rootBackCallback: (() => void) | null = null;
let lastRootBackTriggerTime = 0;

// Berapa kali sudah dipush (guard depth). Dijaga selalu >= 2 agar ada buffer
// untuk rapid back presses.
const GUARD_DEPTH = 3;

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Push GUARD_DEPTH dummy states sekaligus.
 * Alasan perlu lebih dari 1: Jika user tekan Back cepat 2x, browser Android
 * mungkin pop 2 state sebelum JS sempat pushState lagi (race condition).
 * Dengan buffer depth 3, kita punya ruang gerak yang aman.
 */
function pushDeepGuard() {
  if (typeof window === 'undefined') return;
  for (let i = 0; i < GUARD_DEPTH; i++) {
    try {
      window.history.pushState(
        { topcoin_guard: true, depth: i, t: Date.now() },
        '',
        window.location.href
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Push SATU guard state (dipakai setelah modal handler sudah dijalankan).
 * Dipanggil via setTimeout(fn, 0) agar tidak terjadi race condition dengan
 * Chrome's internal navigation queue pada saat popstate.
 */
function scheduleGuardReplenish() {
  if (typeof window === 'undefined') return;
  // Pakai setTimeout agar eksekusi terjadi SETELAH Chrome selesai settle
  // popstate event-nya. Ini kunci utama menghindari Chrome silently ignoring pushState.
  setTimeout(() => {
    try {
      window.history.pushState(
        { topcoin_guard: true, t: Date.now() },
        '',
        window.location.href
      );
    } catch {
      // ignore
    }
  }, 0);
}

// ===========================================================================
// GLOBAL POPSTATE LISTENER (hanya dipasang SEKALI seumur hidup tab)
// ===========================================================================

function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;

  window.addEventListener('popstate', () => {
    // ------------------------------------------------------------------
    // STRATEGI UTAMA:
    // 1. Segera schedule replenish SEBELUM mengeksekusi handler, agar buffer
    //    dipastikan terisi kembali meskipun handler berikutnya lambat.
    // 2. Eksekusi handler LIFO.
    // 3. Jika root, trigger exit confirmation modal.
    //
    // Chrome's race condition: pushState yang dipanggil SYNCHRONOUS di dalam
    // popstate handler kadang diabaikan. setTimeout(0) menyelesaikan ini dengan
    // menangguhkan pushState ke event loop berikutnya, setelah Chrome selesai
    // settle navigasinya.
    // ------------------------------------------------------------------

    scheduleGuardReplenish();

    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers.pop()!;
      topHandler.onBack();
      return;
    }

    // Di root: trigger exit confirmation modal dengan debounce 400ms
    const now = Date.now();
    if (now - lastRootBackTriggerTime > 400) {
      lastRootBackTriggerTime = now;
      if (rootBackCallback) {
        rootBackCallback();
      }
    }
  });

  // Perkuat dengan user gesture listeners: setiap kali ada interaksi user,
  // pastikan guard state ada. Ini menggabungkan dua strategi secara bersamaan:
  // (1) guard from page load, (2) guard replenished on interaction.
  const replenishOnInteraction = () => {
    // Hanya replenish jika state saat ini bukan guard (artinya guard sudah di-pop)
    if (
      typeof window !== 'undefined' &&
      (!window.history.state || !window.history.state.topcoin_guard)
    ) {
      scheduleGuardReplenish();
    }
  };

  window.addEventListener('pointerdown', replenishOnInteraction, {
    passive: true,
    capture: true,
  });
  window.addEventListener('touchstart', replenishOnInteraction, {
    passive: true,
    capture: true,
  });

  isGlobalListenerAttached = true;
}

// ===========================================================================
// PUBLIC HOOKS
// ===========================================================================

/**
 * Hook penjaga halaman utama (root guard).
 * Dijalankan di komponen root (App.tsx).
 * Ketika tombol Back HP ditekan di halaman utama, trigger onRootBack
 * (biasanya membuka modal konfirmasi keluar).
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

    // Push deep guard buffer saat pertama mount (termasuk setelah reload).
    // Dipanggil unconditionally—tidak perlu cek state sebelumnya—karena kita
    // SELALU butuh buffer yang fresh setelah halaman dimuat.
    pushDeepGuard();

    return () => {
      rootBackCallback = null;
    };
  }, []);
}

/**
 * Custom Hook untuk menangani navigasi tombol Back bawaan HP (hardware button
 * atau gesture swipe) agar modal / sub-view / drawer tertutup satu per satu
 * secara native tanpa merusak browser history.
 *
 * @example
 * useMobileBackHandler({
 *   enabled: isModalOpen,
 *   onBack: () => setIsModalOpen(false),
 * });
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

    const id = ++globalBackId;
    const handlerItem: HandlerItem = {
      id,
      onBack: () => onBackRef.current(),
    };

    activeHandlers.push(handlerItem);

    return () => {
      // Lepas dari stack saat komponen unmount / enabled berubah false
      const idx = activeHandlers.findIndex((h) => h.id === id);
      if (idx !== -1) {
        activeHandlers.splice(idx, 1);
      }
    };
  }, [enabled]);
}
