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

let globalBackId = 0;

/**
 * Custom Hook untuk menangani navigasi tombol Back bawaan HP (hardware button atau gesture swipe)
 * agar modal/sub-view tertutup satu per satu secara native tanpa keluar dari aplikasi/PWA.
 *
 * Alur Kerja:
 * 1. Saat enabled = true, mencatat 1 titik history dummy di browser (`window.history.pushState`).
 * 2. Jika user tekan Back di HP, browser menembakkan event `popstate`. Hook menangkap event ini
 *    lalu menjalankan callback `onBack()`.
 * 3. Jika modal ditutup lewat UI (tombol X, tombol batal, atau backdrop), hook secara otomatis
 *    memanggil `window.history.back()` pada proses cleanup agar riwayat browser tetap bersih.
 */
export function useMobileBackHandler({
  enabled = true,
  onBack,
}: UseMobileBackHandlerOptions) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const isPushedRef = useRef(false);
  const closedByPopstateRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const backKey = `topcoin_back_${++globalBackId}`;

    try {
      window.history.pushState({ [backKey]: true }, '');
      isPushedRef.current = true;
      closedByPopstateRef.current = false;
    } catch {
      // Abaikan jika browser membatasi pushState
    }

    const handlePopState = () => {
      closedByPopstateRef.current = true;
      isPushedRef.current = false;
      onBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Jika komponen ditutup bukan karena tombol Back HP (misal: tombol X atau backdrop),
      // buang entri dummy tadi dari riwayat browser.
      if (isPushedRef.current && !closedByPopstateRef.current) {
        isPushedRef.current = false;
        try {
          window.history.back();
        } catch {
          // ignore
        }
      }
    };
  }, [enabled]);
}
