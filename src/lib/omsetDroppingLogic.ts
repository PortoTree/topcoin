/**
 * Business logic untuk modul Tab Omset Dropping
 * Berisi kalkulasi total omset, agregasi omset per petugas dropping,
 * pewarnaan status tier omset, dan penentuan rentang tanggal filter.
 */

export interface DroppingTransactionItem {
  id?: string;
  dropping_user_id?: string;
  gross_omset?: number | null;
  store_share_amount?: number | null;
  net_deposit_amount?: number | null;
  transaction_date?: string;
}

export interface DroppingStaffItem {
  id: string;
  full_name: string;
  username?: string;
  role?: string;
  assigned_task?: string | null;
}

export type OmsetTier = 'high' | 'medium' | 'low' | 'zero';

export interface OmsetTierResult {
  tier: OmsetTier;
  colorClass: string;
  label: string;
}

export interface StaffAggregatedOmset {
  staffId: string;
  staffName: string;
  totalGross: number;
  totalNet: number;
  totalShare: number;
  transactionCount: number;
  statusColor: OmsetTierResult;
}

/**
 * Format angka ke dalam representasi Rupiah ringkas dan rapi sesuai mockup:
 * e.g. "Rp 10.000.000", "Rp 9.000.000", "Rp 0"
 */
export function formatRupiahSimple(amount: number | null | undefined): string {
  const numeric = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const formattedNumber = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(numeric);

  return `Rp ${formattedNumber}`;
}

/**
 * Menentukan warna nominal berdasarkan nominal omset:
 * - >= Rp 500.000 : Hijau (High / Tercapai)
 * - >= Rp 200.000 s/d < Rp 500.000 : Kuning / Oranye (Medium / Sedang)
 * - > Rp 0 s/d < Rp 200.000 : Merah (Low / Minim)
 * - Rp 0 : Abu-abu netral (Zero / Nihil)
 */
export function getStaffOmsetTierColor(grossAmount: number | null | undefined): OmsetTierResult {
  const amount = typeof grossAmount === 'number' && !Number.isNaN(grossAmount) ? grossAmount : 0;

  if (amount <= 0) {
    return {
      tier: 'zero',
      colorClass: 'text-slate-500 dark:text-slate-400',
      label: 'Nihil',
    };
  }

  if (amount >= 500000) {
    return {
      tier: 'high',
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      label: 'Tinggi',
    };
  }

  if (amount >= 200000) {
    return {
      tier: 'medium',
      colorClass: 'text-amber-500 dark:text-amber-400',
      label: 'Sedang',
    };
  }

  return {
    tier: 'low',
    colorClass: 'text-rose-600 dark:text-rose-400',
    label: 'Rendah',
  };
}

/**
 * Menghitung akumulasi Total Omset Kotor (Gross), Total Bersih (Net), dan Bagi Hasil Toko (Share)
 */
export function calculateDroppingTotals(droppings: DroppingTransactionItem[]): {
  totalGross: number;
  totalNet: number;
  totalShare: number;
} {
  return droppings.reduce<{
    totalGross: number;
    totalNet: number;
    totalShare: number;
  }>(
    (acc, d) => {
      acc.totalGross += d.gross_omset || 0;
      acc.totalNet += d.net_deposit_amount || 0;
      acc.totalShare += d.store_share_amount || 0;
      return acc;
    },
    { totalGross: 0, totalNet: 0, totalShare: 0 }
  );
}

/**
 * Mengelompokkan dan merekap total omset dropping per petugas dropping
 * Mengembalikan list terurut dari omset terbesar ke terkecil
 */
export function aggregateDroppingByStaff(
  staffList: DroppingStaffItem[],
  droppings: DroppingTransactionItem[]
): StaffAggregatedOmset[] {
  const staffMap = new Map<string, StaffAggregatedOmset>();

  // Inisialisasi setiap petugas agar staf dengan omset 0 tetap tercatat di daftar
  staffList.forEach((staff) => {
    staffMap.set(staff.id, {
      staffId: staff.id,
      staffName: staff.full_name || staff.username || 'Petugas dropping',
      totalGross: 0,
      totalNet: 0,
      totalShare: 0,
      transactionCount: 0,
      statusColor: getStaffOmsetTierColor(0),
    });
  });

  // Akumulasikan transaksi dropping
  droppings.forEach((d) => {
    const staffId = d.dropping_user_id;
    if (!staffId) return;

    let item = staffMap.get(staffId);
    if (!item) {
      item = {
        staffId,
        staffName: 'Petugas dropping',
        totalGross: 0,
        totalNet: 0,
        totalShare: 0,
        transactionCount: 0,
        statusColor: getStaffOmsetTierColor(0),
      };
      staffMap.set(staffId, item);
    }

    item.totalGross += d.gross_omset || 0;
    item.totalNet += d.net_deposit_amount || 0;
    item.totalShare += d.store_share_amount || 0;
    item.transactionCount += 1;
  });

  // Hitung status color akhir dan konversi ke array
  const result: StaffAggregatedOmset[] = Array.from(staffMap.values()).map((item) => ({
    ...item,
    statusColor: getStaffOmsetTierColor(item.totalGross),
  }));

  // Urutkan omset tertinggi di atas
  result.sort((a, b) => b.totalGross - a.totalGross);

  return result;
}

/**
 * Menghitung rentang tanggal (startDate, endDate) dalam format YYYY-MM-DD
 */
export function getDateRangeForFilter(
  filterType: 'today' | '7days' | '30days' | 'custom',
  referenceDateStr?: string,
  customDateStr?: string
): { startDate: string; endDate: string } {
  const baseDate = referenceDateStr ? new Date(`${referenceDateStr}T00:00:00`) : new Date();

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const endDate = formatDate(baseDate);

  if (filterType === 'custom' && customDateStr) {
    return {
      startDate: customDateStr,
      endDate: customDateStr,
    };
  }

  if (filterType === '7days') {
    const start = new Date(baseDate);
    // 7 hari termasuk hari ini -> kurangi 6 hari
    start.setDate(start.getDate() - 6);
    return {
      startDate: formatDate(start),
      endDate,
    };
  }

  if (filterType === '30days') {
    const start = new Date(baseDate);
    start.setDate(start.getDate() - 29);
    return {
      startDate: formatDate(start),
      endDate,
    };
  }

  // Default: 'today'
  return {
    startDate: endDate,
    endDate,
  };
}
