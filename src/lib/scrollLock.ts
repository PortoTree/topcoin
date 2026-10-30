/**
 * Utility untuk mengunci scroll background (document.body) saat modal / bottom sheet / kamera terbuka.
 * Menggunakan Reference Counting (stack counter) agar ketika ada modal bertumpuk
 * (nested modal atau transisi modal satu ke modal lain), style body tidak terkunci
 * permanen atau salah me-restore status 'hidden'.
 */

let activeLockCount = 0;
let originalOverflow: string = '';
let originalTouchAction: string = '';

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined' || !document.body) {
    return () => {};
  }

  // Jika ini modal pertama yang dibuka, simpan style asli body
  if (activeLockCount === 0) {
    originalOverflow = document.body.style.overflow || '';
    originalTouchAction = document.body.style.touchAction || '';

    // Safeguard: Jika style yang tersimpan sebelumnya ternyata sudah 'hidden' / 'none'
    // akibat sisa unmount modal lain yang glitch, normalize ke empty string ''
    if (originalOverflow === 'hidden') {
      originalOverflow = '';
    }
    if (originalTouchAction === 'none') {
      originalTouchAction = '';
    }

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }

  activeLockCount++;

  let isUnlocked = false;

  return function unlock(): void {
    if (isUnlocked) return;
    isUnlocked = true;

    activeLockCount = Math.max(0, activeLockCount - 1);

    // Hanya restore style jika SUDAH TIDAK ADA modal aktif yang terbuka
    if (activeLockCount === 0) {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    }
  };
}

export function forceUnlockBodyScroll(): void {
  if (typeof document === 'undefined' || !document.body) return;
  activeLockCount = 0;
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
}

