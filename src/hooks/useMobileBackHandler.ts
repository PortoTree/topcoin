import { useEffect, useRef } from 'react';
import { toast } from '../context/ToastContext';

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
  isPushed: boolean;
  closedByPopstate: boolean;
}

let globalBackId = 0;
const activeHandlers: HandlerItem[] = [];
let isInternalBack = false;
let isGlobalListenerAttached = false;
let lastRootBackPressTime = 0;

function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;

  window.addEventListener('popstate', () => {
    // 1. Jika event popstate ini berasal dari window.history.back() internal (cleanup unmount modal UI),
    // abaikan agar tidak menembak modal di bawahnya.
    if (isInternalBack) {
      isInternalBack = false;
      return;
    }

    // 2. Jika user benar-benar menekan tombol Back HP (hardware button atau gesture swipe):
    // Eksekusi HANYA handler teratas di stack (top of stack)
    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers[activeHandlers.length - 1];
      topHandler.closedByPopstate = true;
      topHandler.isPushed = false;
      topHandler.onBack();
      return;
    }

    // 3. JIKA activeHandlers kosong (user berada di halaman utama atau semua modal sudah tertutup):
    // Cegah keluar aplikasi secara tidak sengaja dengan pola proteksi "Tekan sekali lagi untuk keluar"
    const now = Date.now();
    if (now - lastRootBackPressTime < 2000) {
      // Ditekan 2x dalam 2 detik di halaman utama -> Izinkan browser keluar secara normal
      try {
        window.history.back();
      } catch {
        // ignore
      }
    } else {
      // Tekanan pertama di halaman utama
      lastRootBackPressTime = now;
      try {
        window.history.pushState({ topcoin_root: true }, '');
      } catch {
        // ignore
      }
      toast.info('Tekan sekali lagi untuk keluar dari aplikasi');
    }
  });

  isGlobalListenerAttached = true;
}

/**
 * Hook penjaga halaman utama (root guard)
 * Memastikan selalu ada 1 entri penahan di browser history agar saat tombol Back
 * ditekan di halaman utama, user tidak langsung terlempar keluar tanpa konfirmasi.
 */
export function useRootBackGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    ensureGlobalPopstateListener();

    try {
      if (!window.history.state?.topcoin_root) {
        window.history.pushState({ topcoin_root: true }, '');
      }
    } catch {
      // ignore
    }
  }, []);
}

/**
 * Custom Hook untuk menangani navigasi tombol Back bawaan HP (hardware button atau gesture swipe)
 * agar modal/sub-view tertutup satu per satu secara native tanpa keluar dari aplikasi/PWA.
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
    const backKey = `topcoin_back_${id}`;
    let isPushed = false;

    try {
      window.history.pushState({ [backKey]: true }, '');
      isPushed = true;
    } catch {
      // Abaikan jika browser membatasi pushState
    }

    const handlerItem: HandlerItem = {
      id,
      onBack: () => onBackRef.current(),
      isPushed,
      closedByPopstate: false,
    };

    activeHandlers.push(handlerItem);

    return () => {
      // Keluarkan dari stack
      const idx = activeHandlers.findIndex((h) => h.id === id);
      const item = idx !== -1 ? activeHandlers.splice(idx, 1)[0] : handlerItem;

      // Jika komponen ditutup bukan karena tombol Back HP (misal: tombol X, tombol batal, atau trigger state),
      // buang entri dummy tadi dari riwayat browser dengan flag internal agar tidak memicu modal lain.
      if (item && item.isPushed && !item.closedByPopstate) {
        item.isPushed = false;
        isInternalBack = true;
        try {
          window.history.back();
        } catch {
          isInternalBack = false;
        }
      }
    };
  }, [enabled]);
}

