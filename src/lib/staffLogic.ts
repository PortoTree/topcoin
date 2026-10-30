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

  const effectivePin = pin.trim() || '123456';
  if (!effectivePin || effectivePin.length !== 6 || !/^\d{6}$/.test(effectivePin)) {
    return { isValid: false, error: 'PIN login wajib 6 digit angka.' };
  }

  if (role === 'dropping' && machinePrefix && machinePrefix.length < 2) {
    return { isValid: false, error: 'Prefix kode mesin dropping minimal 2 karakter.' };
  }

  return { isValid: true };
}

/**
 * Bobot urutan hierarki peran staf:
 * 1. BM (Branch Manager)
 * 2. Admin Cabang
 * 3. Marketing
 * 4. Dropping
 * 5. Lainnya (Logistik, Driver, Teknisi, dll)
 */
export function getStaffRoleWeight(role: string): number {
  const r = (role || '').toLowerCase().trim();
  if (r === 'branch_manager' || r === 'bm') return 1;
  if (r === 'admin_cabang' || r === 'admin') return 2;
  if (r === 'marketing' || r === 'sales') return 3;
  if (r === 'dropping') return 4;
  return 5;
}

/**
 * Comparator untuk mengurutkan daftar staf:
 * Berdasarkan prioritas peran (BM -> Admin -> Marketing -> Dropping -> Lainnya)
 * lalu berdasarkan nama lengkap secara alfabetis.
 */
export function compareStaff(
  a: { full_name: string; role: string },
  b: { full_name: string; role: string }
): number {
  const weightA = getStaffRoleWeight(a.role);
  const weightB = getStaffRoleWeight(b.role);
  if (weightA !== weightB) {
    return weightA - weightB;
  }
  return (a.full_name || '').localeCompare(b.full_name || '', 'id');
}

/**
 * Filter daftar staf berdasarkan query pencarian (nama, username, nomor WA, atau role)
 */
export function filterStaff<T extends { full_name: string; username?: string; phone?: string | null; role: string }>(
  staffList: T[],
  query: string
): T[] {
  if (!query || !query.trim()) return staffList;
  const q = query.trim().toLowerCase();
  return staffList.filter((s) => {
    const nameMatch = (s.full_name || '').toLowerCase().includes(q);
    const userMatch = (s.username || '').toLowerCase().includes(q);
    const phoneMatch = (s.phone || '').toLowerCase().includes(q);
    const roleMatch = (s.role || '').toLowerCase().includes(q);
    return nameMatch || userMatch || phoneMatch || roleMatch;
  });
}

/**
 * Validasi form edit staf
 */
export function validateEditStaffForm(params: {
  fullName: string;
  phone: string;
  pin?: string;
  role: string;
  machinePrefix?: string | null;
}): { isValid: boolean; error?: string } {
  const { fullName, phone, pin, role, machinePrefix } = params;

  if (!fullName.trim()) {
    return { isValid: false, error: 'Nama lengkap wajib diisi.' };
  }

  if (!phone.trim() || phone.trim().length < 8) {
    return { isValid: false, error: 'Nomor WhatsApp / HP wajib valid (minimal 8 digit).' };
  }

  // PIN bersifat opsional saat edit (hanya jika diisi/ingin diubah)
  if (pin && pin.trim()) {
    const trimmedPin = pin.trim();
    if (trimmedPin.length !== 6 || !/^\d{6}$/.test(trimmedPin)) {
      return { isValid: false, error: 'PIN baru wajib 6 digit angka.' };
    }
  }

  if (role === 'dropping' && machinePrefix && machinePrefix.length < 2) {
    return { isValid: false, error: 'Prefix kode mesin minimal 2 karakter.' };
  }

  return { isValid: true };
}


