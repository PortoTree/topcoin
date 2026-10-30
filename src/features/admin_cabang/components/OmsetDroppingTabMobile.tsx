import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, ChevronDown, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  type DroppingTransactionItem,
  type DroppingStaffItem,
  calculateDroppingTotals,
  aggregateDroppingByStaff,
  getDateRangeForFilter,
  formatRupiahSimple,
} from '../../../lib/omsetDroppingLogic';

export interface OmsetDroppingTabMobileProps {
  activeBranchId: string;
  branchStaff: DroppingStaffItem[];
  todayDroppings: DroppingTransactionItem[];
}

type FilterPeriod = 'today' | '7days' | '30days' | 'custom';

export const OmsetDroppingTabMobile: React.FC<OmsetDroppingTabMobileProps> = ({
  activeBranchId,
  branchStaff,
  todayDroppings,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('7days');
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [periodDroppings, setPeriodDroppings] = useState<DroppingTransactionItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState<boolean>(false);

  const dateInputRef = useRef<HTMLInputElement>(null);

  // Filter daftar staf khusus role dropping (atau admin cabang dengan tugas dropping)
  const droppingStaffList = useMemo(() => {
    return branchStaff.filter(
      (s) =>
        s.role === 'dropping' ||
        (s.role === 'admin_cabang' && s.assigned_task === 'dropping')
    );
  }, [branchStaff]);

  // Hitung rentang tanggal berdasarkan filter yang aktif
  const dateRange = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return getDateRangeForFilter(filterPeriod, today, selectedCustomDate);
  }, [filterPeriod, selectedCustomDate]);

  // Format tanggal untuk label pill (misal DD/MM/YY)
  const formattedDateLabel = useMemo(() => {
    const d = new Date(`${selectedCustomDate}T00:00:00`);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }, [selectedCustomDate]);

  // Label periode yang aktif
  const periodLabel = useMemo(() => {
    switch (filterPeriod) {
      case 'today':
        return 'Hari Ini';
      case '7days':
        return '7 Hari';
      case '30days':
        return '30 Hari';
      case 'custom':
        return 'Kustom';
      default:
        return '7 Hari';
    }
  }, [filterPeriod]);

  // Fetch data dropping sesuai rentang filter
  useEffect(() => {
    let isMounted = true;

    // Jika filter adalah 'today' dan tanggal kustom adalah hari ini, gunakan todayDroppings yang sudah ada
    const today = new Date().toISOString().split('T')[0];
    if (filterPeriod === 'today' && selectedCustomDate === today && todayDroppings.length > 0) {
      setPeriodDroppings(todayDroppings);
      return;
    }

    const fetchRangeDroppings = async () => {
      if (!activeBranchId) return;
      setIsLoadingData(true);

      try {
        const { data, error } = await supabase
          .from('droppings')
          .select(`
            id,
            dropping_user_id,
            gross_omset,
            store_share_amount,
            net_deposit_amount,
            transaction_date
          `)
          .eq('branch_id', activeBranchId)
          .gte('transaction_date', dateRange.startDate)
          .lte('transaction_date', dateRange.endDate);

        if (error) {
          console.warn('Gagal memuat omset periode:', error);
          if (isMounted) setPeriodDroppings(todayDroppings);
        } else if (isMounted && data) {
          setPeriodDroppings(data as DroppingTransactionItem[]);
        }
      } catch (err) {
        console.warn('Error fetching omset dropping:', err);
        if (isMounted) setPeriodDroppings(todayDroppings);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    fetchRangeDroppings();

    return () => {
      isMounted = false;
    };
  }, [activeBranchId, dateRange.startDate, dateRange.endDate, filterPeriod, selectedCustomDate, todayDroppings]);

  // Hitung akumulasi omset kotor dan setoran bersih
  const totals = useMemo(() => {
    return calculateDroppingTotals(periodDroppings);
  }, [periodDroppings]);

  // Agregasi omset per petugas dropping
  const staffOmsetList = useMemo(() => {
    return aggregateDroppingByStaff(droppingStaffList, periodDroppings);
  }, [droppingStaffList, periodDroppings]);

  // Trigger klik pada hidden input date picker
  const handleOpenDatePicker = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedCustomDate(e.target.value);
      setFilterPeriod('custom');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Hidden Native Date Input untuk Picker Tanggal Mobile */}
      <input
        ref={dateInputRef}
        type="date"
        value={selectedCustomDate}
        onChange={handleCustomDateChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Hero Section: Kontainer Atas Gelap dengan Rounded Bottom Sesuai Mockup */}
      <div className="bg-[#383a3d] dark:bg-slate-900 text-white rounded-3xl p-5 pb-4 shadow-lg border border-slate-700/60 dark:border-slate-800 relative">
        {/* Header Judul & Subjudul */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight leading-tight">
            Omset Dropping
          </h2>
          <p className="text-xs text-slate-300 dark:text-slate-400 font-medium">
            Data pemasukan keuangan harian.
          </p>
        </div>

        {/* Garis Horizontal Pembatas Tipis */}
        <div className="border-b border-slate-600/60 dark:border-slate-700/80 my-3.5" />

        {/* Filter Kapsul (Pill Tanggal & Rentang Waktu) di Kanan Atas */}
        <div className="flex items-center justify-end gap-2 relative">
          {/* Pill Kalender */}
          <button
            type="button"
            onClick={handleOpenDatePicker}
            title="Pilih tanggal kustom"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-900 text-xs font-bold shadow-xs hover:bg-slate-100 active:scale-95 transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-700" />
            <span>{formattedDateLabel}</span>
          </button>

          {/* Pill Rentang Waktu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsPeriodMenuOpen((prev) => !prev)}
              title="Pilih rentang filter"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-slate-900 text-xs font-bold shadow-xs hover:bg-slate-100 active:scale-95 transition cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-slate-700" />
              <span>{periodLabel}</span>
              <ChevronDown className="w-3 h-3 text-slate-600 ml-0.5" />
            </button>

            {/* Dropdown Menu Pilihan Rentang Waktu */}
            {isPeriodMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsPeriodMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 animate-in fade-in zoom-in-95 text-slate-900 dark:text-white">
                  {(
                    [
                      { id: 'today', label: 'Hari Ini' },
                      { id: '7days', label: '7 Hari' },
                      { id: '30days', label: '30 Hari' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFilterPeriod(p.id);
                        setIsPeriodMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between transition cursor-pointer"
                    >
                      <span>{p.label}</span>
                      {filterPeriod === p.id && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2 Card Metrik: Total Omset & Total Bersih */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {/* Card 1: Total Omset (Kotor) */}
          <div className="bg-[#5a5c60]/60 dark:bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-500/30 flex flex-col justify-between shadow-xs">
            <div className="bg-white text-slate-900 text-xs sm:text-sm font-black py-1.5 text-center shadow-xs">
              Total Omset
            </div>
            <div className="p-3">
              <span className="text-[11px] font-bold text-slate-300 block mb-0.5">
                Rp
              </span>
              <span className="text-lg sm:text-xl font-black text-white tracking-tight block truncate">
                {isLoadingData ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white inline-block" />
                ) : (
                  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totals.totalGross)
                )}
              </span>
            </div>
          </div>

          {/* Card 2: Total Bersih */}
          <div className="bg-[#5a5c60]/60 dark:bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-500/30 flex flex-col justify-between shadow-xs">
            <div className="bg-white text-slate-900 text-xs sm:text-sm font-black py-1.5 text-center shadow-xs">
              Total bersih
            </div>
            <div className="p-3">
              <span className="text-[11px] font-bold text-slate-300 block mb-0.5">
                Rp
              </span>
              <span className="text-lg sm:text-xl font-black text-white tracking-tight block truncate">
                {isLoadingData ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white inline-block" />
                ) : (
                  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totals.totalNet)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Grab Handle Bar */}
        <div className="w-24 h-1.5 bg-slate-500/70 dark:bg-slate-600 rounded-full mx-auto mt-5 mb-0.5" />
      </div>

      {/* Bagian Bawah: Daftar Dropping */}
      <div className="px-1 pt-2">
        <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
          Daftar dropping
        </h3>
        {/* Garis Pembatas di Bawah Daftar Dropping */}
        <div className="border-b-2 border-slate-300 dark:border-slate-700 mt-2 mb-3" />

        {/* List Petugas Dropping */}
        {staffOmsetList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 font-medium">
            Tidak ada petugas dropping terdaftar di cabang ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {staffOmsetList.map((item) => (
              <div
                key={item.staffId}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 px-1 rounded-xl transition"
              >
                {/* Nama Petugas Dropping di Kiri */}
                <div className="min-w-0 pr-2">
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200 block truncate">
                    {item.staffName}
                  </span>
                  {item.transactionCount > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                      {item.transactionCount} transaksi dropping
                    </span>
                  )}
                </div>

                {/* Nilai Omset di Kanan dengan Pewarnaan Khusus */}
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-black tracking-tight ${item.statusColor.colorClass}`}>
                    {formatRupiahSimple(item.totalGross)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
