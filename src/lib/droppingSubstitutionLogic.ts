import type { UserProfile, Store } from '../types';
import {
  parseMachineCode,
  formatMachineCode,
  displayMachineCode,
  sanitizeMachinePrefix,
} from './machineCodeLogic';

/**
 * Menentukan ID staf dropping yang sedang dibidik / dijalankan.
 * - Jika petugas dropping biasa: selalu membidik profile.id miliknya sendiri.
 * - Jika admin yang ditugaskan ke dropping: membidik substituteUserId (staf yang digantikan),
 *   atau fallback ke profile.id jika tidak ada yang digantikan.
 */
export function getEffectiveDroppingTargetId(params: {
  profile: Partial<UserProfile> | null | undefined;
  substituteUserId?: string | null;
}): string | null {
  const { profile, substituteUserId } = params;
  if (!profile || !profile.id) return null;

  // Jika admin sedang menggantikan staf dropping dan substituteUserId valid
  const isAdminDropping =
    (profile.role === 'admin_cabang' || profile.role === 'admin') &&
    profile.assigned_task === 'dropping';

  if (isAdminDropping && substituteUserId) {
    return substituteUserId;
  }

  return profile.id;
}

/**
 * Memformat kode mesin menjadi Virtual Alias dengan prefix Admin.
 * Contoh:
 * - Mesin fisik NAUFAL-05 saat dibuka oleh Admin ber-prefix "ADMIN" -> "ADMIN-05"
 * - Mesin fisik [NAUFAL-01] saat dibuka oleh Admin -> "ADMIN-01"
 * - Jika tidak ada virtualPrefix atau sama dengan aslinya -> tetap kode asli yang bersih
 */
export function formatVirtualMachineCode(params: {
  originalMachineCode?: string | null;
  virtualPrefix?: string | null;
}): string {
  const { originalMachineCode, virtualPrefix } = params;
  if (!originalMachineCode) return 'Tanpa Mesin';

  const cleanOriginal = displayMachineCode(originalMachineCode);
  if (!virtualPrefix) return cleanOriginal;

  const parsed = parseMachineCode(cleanOriginal);
  const cleanVirtualPrefix = sanitizeMachinePrefix(virtualPrefix);

  return formatMachineCode(cleanVirtualPrefix, parsed.number);
}

/**
 * Filter toko mitra khusus untuk alur dropping:
 * - Mengisolasi toko berdasarkan assigned_dropping_id pada mesin yang terpasang di toko.
 * - Jika effectiveDroppingId diberikan, HANYA menampilkan toko yang mesinnya di-assign ke ID tersebut.
 */
export function filterStoresForDropping(params: {
  stores: Store[];
  effectiveDroppingId: string | null;
  isAllDroppingView?: boolean;
}): Store[] {
  const { stores, effectiveDroppingId, isAllDroppingView = false } = params;
  if (!Array.isArray(stores)) return [];

  // Jika mode pengelola / supervisor yang sengaja menampilkan semua
  if (isAllDroppingView || !effectiveDroppingId) {
    return stores;
  }

  return stores.filter((s) => {
    // Toko harus memiliki mesin yang terpasang dan ditugaskan ke effectiveDroppingId
    const machine = s.machine;
    if (!machine) return false;
    return machine.assigned_dropping_id === effectiveDroppingId;
  });
}

/**
 * Menemukan objek profil staf dropping yang sedang digantikan oleh Admin
 */
export function getSubstitutedDroppingStaff(params: {
  droppingStaff: UserProfile[];
  substituteUserId?: string | null;
}): UserProfile | null {
  const { droppingStaff, substituteUserId } = params;
  if (!substituteUserId || !Array.isArray(droppingStaff)) return null;
  return droppingStaff.find((s) => s.id === substituteUserId) || null;
}

/**
 * Menghasilkan judul header yang jelas di halaman dropping
 * - Petugas murni: "Daftar dropping [Nama]"
 * - Admin pengganti: "Daftar dropping [Nama Admin] (Menggantikan [Nama Staf])"
 */
export function getDroppingPageHeaderTitle(params: {
  profile: Partial<UserProfile> | null | undefined;
  substituteStaff?: Partial<UserProfile> | null;
}): string {
  const { profile, substituteStaff } = params;
  const adminName = profile?.full_name || 'Petugas Dropping';

  if (substituteStaff && substituteStaff.full_name) {
    return `Daftar dropping ${adminName}`;
  }

  return `Daftar dropping ${adminName}`;
}
