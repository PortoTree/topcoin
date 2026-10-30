/**
 * Business Logic & Utilities untuk Manajemen Staf / Karyawan
 */

/**
 * Ekstraksi nama depan dan buat username otomatis (lowercase, alphanumeric saja)
 * Contoh: "Andi Saputra" -> "andi", "Dr. Budi" -> "budi"
 */
export function generateAutoUsername(fullName: string): string {
  if (!fullName) return '';
  const clean = fullName
    .trim()
    .replace(/^(bpk|ibu|pak|dr|ir)\.?\s+/i, ''); // buang gelar umum jika ada
  const words = clean.split(/\s+/).filter(Boolean);
  const firstWord = words[0] || '';
  return firstWord
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

/**
 * Ekstraksi nama depan untuk prefix mesin dropping (UPPERCASE)
 * Contoh: "Andi Saputra" -> "ANDI", "Pampam Jaya" -> "PAMPAM"
 */
export function generateAutoPrefix(fullName: string): string {
  if (!fullName) return 'MESIN';
  const clean = fullName
    .trim()
    .replace(/^(bpk|ibu|pak|dr|ir)\.?\s+/i, '');
  const words = clean.split(/\s+/).filter(Boolean);
  const firstWord = words[0] || 'MESIN';
  const sanitized = firstWord
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return sanitized || 'MESIN';
}

/**
 * Validasi form tambah karyawan
 */
export function validateNewStaffForm(params: {
  fullName: string;
  username: string;
  phone: string;
  pin: string;
  role: string;
  machinePrefix?: string | null;
}): { isValid: boolean; error?: string } {
  const { fullName, username, phone, pin, role, machinePrefix } = params;

  if (!fullName.trim()) {
    return { isValid: false, error: 'Nama lengkap wajib diisi.' };
  }

  if (!username.trim() || username.trim().length < 3) {
    return { isValid: false, error: 'Username minimal 3 karakter tanpa spasi.' };
  }

  if (/\s/.test(username.trim())) {
    return { isValid: false, error: 'Username tidak boleh mengandung spasi.' };
  }

  if (!phone.trim() || phone.trim().length < 8) {
    return { isValid: false, error: 'Nomor WhatsApp / HP wajib valid (minimal 8 digit).' };
  }

  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return { isValid: false, error: 'PIN login wajib 6 digit angka.' };
  }

  if (role === 'dropping' && machinePrefix && machinePrefix.length < 2) {
    return { isValid: false, error: 'Prefix kode mesin dropping minimal 2 karakter.' };
  }

  return { isValid: true };
}

