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
  isPushed: boolean;
  closedByPopstate: boolean;
}

let globalBackId = 0;
const activeHandlers: HandlerItem[] = [];
let isInternalBack = false;
let isGlobalListenerAttached = false;
let rootBackCallback: (() => void) | null = null;

function ensureGlobalPopstateListener() {
  if (isGlobalListenerAttached || typeof window === 'undefined') return;

  window.addEventListener('popstate', () => {
    // 1. Jika event popstate ini berasal dari window.history.back() internal (cleanup unmount modal UI),
    // abaikan agar tidak menembak modal di bawahnya.
    if (isInternalBack) {
      isInternalBack = false;
      return;
    }

    // 2. Jika user menekan tombol Back HP dan ada modal/sub-view di stack:
    // POP handler teratas seketika agar stack sinkron dengan history browser yang sudah mundur 1 langkah!
    if (activeHandlers.length > 0) {
      const topHandler = activeHandlers.pop()!;
      topHandler.closedByPopstate = true;
      topHandler.isPushed = false;
      topHandler.onBack();
      return;
    }

    // 3. JIKA activeHandlers kosong (user berada di halaman utama atau semua modal sudah tertutup):
    // PUSH KEMBALI guard state seketika agar browser TIDAK AKAN PERNAH keluar dari aplikasi ke blank page!
    try {
      window.history.pushState({ topcoin_root: true }, '');
    } catch {
      // ignore
    }

    // Panggil callback konfirmasi keluar (membuka Modal Konfirmasi Keluar)
    if (rootBackCallback) {
      rootBackCallback();
    }
  });

  isGlobalListenerAttached = true;
}

/**
 * Hook penjaga halaman utama (root guard)
 * Memastikan selalu ada 1 entri penahan di browser history. Ketika tombol Back HP ditekan
 * di halaman utama (atau setelah semua modal tertutup), sistem akan memicu callback onRootBack
 * (misal memunculkan modal konfirmasi keluar) dan TIDAK AKAN PERNAH langsung melempar user keluar aplikasi.
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

    try {
      if (!window.history.state?.topcoin_root) {
        window.history.pushState({ topcoin_root: true }, '');
      }
    } catch {
      // ignore
    }

    return () => {
      rootBackCallback = null;
    };
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

