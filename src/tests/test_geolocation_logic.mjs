import assert from 'node:assert';

// Geolocation Position Error Codes
const GeolocationErrorCodes = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};

export function getGeolocationErrorMessage(error, isSecure = true) {
  if (!isSecure) {
    return 'Browser HP memblokir GPS karena koneksi belum HTTPS. Gunakan HTTPS atau masukkan koordinat manual.';
  }

  if (!error) return 'Gagal mendeteksi lokasi GPS.';

  switch (error.code) {
    case GeolocationErrorCodes.PERMISSION_DENIED:
      return 'Izin lokasi ditolak di browser. Silakan izinkan akses lokasi di ikon gembok URL atau setelan browser.';
    case GeolocationErrorCodes.POSITION_UNAVAILABLE:
      return 'GPS HP tidak aktif atau tidak ada sinyal. Pastikan saklar "Lokasi" (GPS) di menu notifikasi HP Anda sudah dinyalakan.';
    case GeolocationErrorCodes.TIMEOUT:
      return 'Waktu pencarian GPS habis karena sinyal satelit lemah di dalam ruangan. Coba geser ke dekat jendela/luar ruangan.';
    default:
      return error.message || 'Gagal mendeteksi lokasi GPS. Periksa pengaturan lokasi HP Anda.';
  }
}

// Tests
console.log('🧪 Memulai pengujian pesan error Geolocation...');

// Test 1: Insecure context
const msgInsecure = getGeolocationErrorMessage({ code: 1 }, false);
assert.ok(msgInsecure.includes('belum HTTPS'));
console.log('✅ Test 1 (Insecure context) Lulus');

// Test 2: PERMISSION_DENIED
const msgPermDenied = getGeolocationErrorMessage({ code: 1 }, true);
assert.ok(msgPermDenied.includes('Izin lokasi ditolak'));
console.log('✅ Test 2 (Permission Denied) Lulus');

// Test 3: POSITION_UNAVAILABLE (The exact bug reported by user!)
const msgPosUnavail = getGeolocationErrorMessage({ code: 2 }, true);
assert.ok(msgPosUnavail.includes('saklar "Lokasi" (GPS) di menu notifikasi'));
console.log('✅ Test 3 (Position Unavailable - GPS Master Toggle Off) Lulus');

// Test 4: TIMEOUT
const msgTimeout = getGeolocationErrorMessage({ code: 3 }, true);
assert.ok(msgTimeout.includes('sinyal satelit lemah'));
console.log('✅ Test 4 (Timeout) Lulus');

console.log('🎉 SEMUA PENGUJIAN GEOLOCATION LOGIC LULUS!');

