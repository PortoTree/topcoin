/**
 * Utility & Business Logic: Format & Management Kode Mesin Hybrid
 * Standard Format: [PREFIX-01] s/d [PREFIX-20] (2-digit padding)
 */

export interface ParsedMachineCode {
  prefix: string;
  number: number;
}

/**
 * Membersihkan string prefix (trim, hapus strip di ujung, jadikan UPPERCASE)
 * Contoh: "pampam-" -> "PAMPAM", "  budi  " -> "BUDI"
 */
export function sanitizeMachinePrefix(prefix?: string | null): string {
  if (!prefix) return 'MESIN';
  const cleaned = prefix
    .trim()
    .replace(/^\[+|\]+$/g, '') // buang tanda kurung siku jika ada
    .replace(/[-_\s]+$/g, '') // buang strip/underscore/spasi di ujung
    .toUpperCase();
  return cleaned || 'MESIN';
}

/**
 * Format kode mesin menjadi format standar (contoh: PAMPAM-01)
 */
export function formatMachineCode(
  prefix: string | null | undefined,
  machineNumber: number | null | undefined
): string {
  const cleanPrefix = sanitizeMachinePrefix(prefix);
  const num = typeof machineNumber === 'number' && !isNaN(machineNumber) ? machineNumber : 1;
  const numPadded = String(Math.max(1, num)).padStart(2, '0');
  return `${cleanPrefix}-${numPadded}`;
}

/**
 * Format kode mesin lengkap dengan tanda kurung siku untuk UI visual
 * Contoh: [PAMPAM-01]
 */
export function formatMachineBadge(
  prefix: string | null | undefined,
  machineNumber: number | null | undefined
): string {
  return `[${formatMachineCode(prefix, machineNumber)}]`;
}

/**
 * Memastikan tampilan kode mesin selalu dalam kurung siku [PREFIX-01]
 * Jika input sudah [PAMPAM-01] atau PAMPAM-01, output tetap [PAMPAM-01]
 */
export function displayMachineCode(code?: string | null): string {
  if (!code) return 'Tanpa Mesin';
  const clean = code.replace(/^\[+|\]+$/g, '').trim();
  return clean ? `[${clean}]` : 'Tanpa Mesin';
}

/**
 * Ekstraksi prefix dan nomor dari kode mesin yang ada
 * Mendukung: "PAMPAM-01", "[PAMPAM-01]", "M-001"
 */
export function parseMachineCode(codeStr?: string | null): ParsedMachineCode {
  if (!codeStr) {
    return { prefix: 'MESIN', number: 1 };
  }
  const clean = codeStr.replace(/^\[+|\]+$/g, '').trim();
  const match = clean.match(/^(.*?)[-_](\d+)$/);
  if (match) {
    return {
      prefix: sanitizeMachinePrefix(match[1]),
      number: parseInt(match[2], 10) || 1,
    };
  }
  return { prefix: sanitizeMachinePrefix(clean), number: 1 };
}

/**
 * Menghasilkan array kode mesin urut dari 01 hingga targetCount (default 20)
 */
export function generateDroppingMachineCodes(
  prefix: string | null | undefined,
  count = 20
): string[] {
  const safeCount = Math.max(1, count);
  const codes: string[] = [];
  for (let i = 1; i <= safeCount; i++) {
    codes.push(formatMachineCode(prefix, i));
  }
  return codes;
}

/**
 * Mencari nomor mesin terkecil yang belum digunakan (mengisi slot kosong)
 * Contoh: [1, 3, 4] -> 2. Jika [1, 2, 3] -> 4
 */
export function getNextAvailableMachineNumber(existingNumbers: number[]): number {
  if (!existingNumbers || existingNumbers.length === 0) return 1;
  const numSet = new Set(existingNumbers.filter((n) => typeof n === 'number' && n > 0));
  let candidate = 1;
  while (numSet.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Recode massal mesin milik satu dropping saat prefix dropping diubah Admin/BM
 */
export function recodeMachinesForDropping<T extends { machine_number?: number | null; machine_code: string }>(
  machines: T[],
  newPrefix: string
): T[] {
  return machines.map((m) => {
    const num = m.machine_number ?? parseMachineCode(m.machine_code).number;
    return {
      ...m,
      machine_number: num,
      machine_code: formatMachineCode(newPrefix, num),
    };
  });
}
