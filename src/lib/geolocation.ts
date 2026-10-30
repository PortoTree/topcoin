/**
 * Geolocation Utility dengan Dukungan Fallback Otomatis & Pesan Error Spesifik
 * Mengatasi masalah timeout satelit GPS indoor dan kesalahan deteksi izin pada perangkat mobile.
 */

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Menerjemahkan GeolocationPositionError menjadi pesan ramah pengguna berbahasa Indonesia.
 */
export function getGeolocationErrorMessage(error: any, isSecure: boolean = true): string {
  if (!isSecure) {
    return 'Browser HP memblokir GPS karena koneksi belum HTTPS. Akses sistem melalui HTTPS atau gunakan input koordinat manual.';
  }

  if (!error) return 'Gagal mendeteksi lokasi GPS.';

  switch (error.code) {
    case 1: // GeolocationPositionError.PERMISSION_DENIED
      return 'Izin lokasi ditolak di browser. Silakan izinkan akses lokasi di ikon gembok URL atau setelan browser Anda.';
    case 2: // GeolocationPositionError.POSITION_UNAVAILABLE
      return 'Layanan GPS HP tidak aktif atau tidak ada sinyal. Pastikan tombol/saklar "Lokasi" (GPS) di menu notifikasi HP Anda sudah dinyalakan.';
    case 3: // GeolocationPositionError.TIMEOUT
      return 'Waktu pencarian sinyal GPS satelit habis (sinyal lemah di dalam ruangan). Coba dekat jendela atau gunakan input manual.';
    default:
      return error.message || 'Gagal mendeteksi lokasi GPS. Periksa pengaturan lokasi HP Anda.';
  }
}

/**
 * Mengambil posisi GPS perangkat secara andal di mobile:
 * 1. Mencoba High Accuracy (GPS Hardware).
 * 2. Jika timeout atau gagal (misal indoor), otomatis fallback ke Network Triangulation (Wi-Fi/Cell).
 */
export function getDeviceLocation(): Promise<GpsLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject('Perangkat Anda tidak mendukung fitur pendeteksi GPS.');
    }

    const isSecure = typeof window.isSecureContext === 'boolean' ? window.isSecureContext : true;

    // Helper panggil getCurrentPosition dengan fallback
    const tryLowAccuracy = (primaryError: any) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        (fallbackError) => {
          // Jika low accuracy pun gagal, prioritaskan pesan error utama atau fallback
          const errorToReport = fallbackError.code === 1 ? fallbackError : (primaryError || fallbackError);
          reject(getGeolocationErrorMessage(errorToReport, isSecure));
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    // Langkah 1: Coba High Accuracy terlebih dahulu
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
      },
      (primaryError) => {
        // Jika ditolak izinnya oleh user di browser (code 1), jangan fallback karena browser memblokirnya
        if (primaryError.code === 1) {
          return reject(getGeolocationErrorMessage(primaryError, isSecure));
        }

        // Jika timeout (code 3) atau position unavailable (code 2), otomatis fallback ke low accuracy
        console.warn('High accuracy GPS gagal/timeout, beralih ke network location fallback:', primaryError);
        tryLowAccuracy(primaryError);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

