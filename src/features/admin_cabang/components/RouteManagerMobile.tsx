import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import { BottomSheetModal } from '../../../components/BottomSheetModal';
import {
  Route,
  Truck,
  TrendingUp,
  Info,
  Edit2,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  MessageCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  User,
  Store as StoreIcon,
} from 'lucide-react';
import type { Machine, UserProfile, Store, DriverTask } from '../../../types';
import {
  displayMachineCode,
  sanitizeMachinePrefix,
  recodeMachinesForDropping,
} from '../../../lib/machineCodeLogic';

interface RouteManagerMobileProps {
  branchId: string;
  machines: Machine[];
  droppingStaff: UserProfile[];
  stores: Store[];
  onRefresh: () => Promise<void> | void;
}

export const RouteManagerMobile: React.FC<RouteManagerMobileProps> = ({
  branchId,
  machines,
  droppingStaff,
  stores,
  onRefresh,
}) => {
  // Sub-Tab Switcher: 'dropping' | 'logistik' | 'marketing'
  const [activeSubTab, setActiveSubTab] = useState<'dropping' | 'logistik' | 'marketing'>('dropping');

  // =========================================================================
  // STATE DROPPING
  // =========================================================================
  const [selectedDroppingForDetail, setSelectedDroppingForDetail] = useState<UserProfile | null>(null);
  const [isPrefixModalOpen, setIsPrefixModalOpen] = useState(false);
  const [selectedStaffForPrefix, setSelectedStaffForPrefix] = useState<UserProfile | null>(null);
  const [inputPrefix, setInputPrefix] = useState('');
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);

  const [togglingMachineId, setTogglingMachineId] = useState<string | null>(null);
  const [editingStoreRouteId, setEditingStoreRouteId] = useState<string | null>(null);
  const [inputRouteOrder, setInputRouteOrder] = useState<string>('');
  const [isSavingRouteOrder, setIsSavingRouteOrder] = useState<boolean>(false);

  // =========================================================================
  // STATE LOGISTIK
  // =========================================================================
  const [driverTasks, setDriverTasks] = useState<DriverTask[]>([]);
  const [isLoadingLogistics, setIsLoadingLogistics] = useState(false);
  const [logisticsFilter, setLogisticsFilter] = useState<'all' | 'completed' | 'in_progress' | 'kendala'>('all');
  const [selectedTaskForSummary, setSelectedTaskForSummary] = useState<DriverTask | null>(null);

  // Fetch Riwayat Tugas Logistik
  const fetchLogisticsTasks = useCallback(async () => {
    setIsLoadingLogistics(true);
    try {
      const { data, error } = await supabase
        .from('driver_tasks')
        .select(`
          *,
          store:stores!store_id(name, address),
          target_store:stores!target_store_id(name, address),
          machine:machines(machine_code),
          driver:profiles!driver_id(full_name, username)
        `)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDriverTasks(data as DriverTask[]);
      } else if (error) {
        console.warn('Gagal mengambil tugas logistik:', error);
      }
    } catch (err) {
      console.error('Error fetching driver tasks:', err);
    } finally {
      setIsLoadingLogistics(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (activeSubTab === 'logistik') {
      fetchLogisticsTasks();
    }
  }, [activeSubTab, fetchLogisticsTasks]);

  // Filter Logistik Tasks
  const filteredDriverTasks = useMemo(() => {
    return driverTasks.filter((t) => {
      if (logisticsFilter === 'all') return true;
      return t.status === logisticsFilter;
    });
  }, [driverTasks, logisticsFilter]);

  // =========================================================================
  // STATE MARKETING
  // =========================================================================
  const [marketingSearchQuery, setMarketingSearchQuery] = useState('');
  const [marketingStatusFilter, setMarketingStatusFilter] = useState<'all' | 'proses' | 'terpasang'>('all');

  const filteredMarketingStores = useMemo(() => {
    return stores.filter((st) => {
      if (marketingStatusFilter !== 'all') {
        if (marketingStatusFilter === 'proses' && st.status === 'terpasang') return false;
        if (marketingStatusFilter === 'terpasang' && st.status !== 'terpasang') return false;
      }
      if (!marketingSearchQuery) return true;
      const q = marketingSearchQuery.toLowerCase().trim();
      return (
        st.name.toLowerCase().includes(q) ||
        st.owner_name?.toLowerCase().includes(q) ||
        st.address?.toLowerCase().includes(q) ||
        st.phone?.includes(q)
      );
    });
  }, [stores, marketingStatusFilter, marketingSearchQuery]);

  // =========================================================================
  // HANDLERS DROPPING
  // =========================================================================
  const handleOpenPrefixModal = (staff: UserProfile) => {
    setSelectedStaffForPrefix(staff);
    setInputPrefix(staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name));
    setIsPrefixModalOpen(true);
  };

  const handleSavePrefix = async () => {
    if (!selectedStaffForPrefix) return;
    const cleanPrefix = sanitizeMachinePrefix(inputPrefix);
    if (!cleanPrefix) {
      toast.error('Prefix tidak boleh kosong.');
      return;
    }

    setIsSavingPrefix(true);
    try {
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ machine_prefix: cleanPrefix })
        .eq('id', selectedStaffForPrefix.id);

      if (profileErr) throw profileErr;

      const heldMachines = machines.filter((m) => m.assigned_dropping_id === selectedStaffForPrefix.id);
      if (heldMachines.length > 0) {
        const recoded = recodeMachinesForDropping(heldMachines, cleanPrefix);
        for (const item of recoded) {
          await supabase
            .from('machines')
            .update({
              machine_number: item.machine_number,
              machine_code: item.machine_code,
            })
            .eq('id', item.id);
        }
      }

      toast.success(`Prefix untuk ${selectedStaffForPrefix.full_name} berhasil diubah ke ${cleanPrefix}-01..20!`);
      setIsPrefixModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error('Error saving prefix:', err);
      toast.error('Gagal menyimpan prefix: ' + err.message);
    } finally {
      setIsSavingPrefix(false);
    }
  };

  const handleToggleVisitRequirement = async (m: Machine) => {
    if (togglingMachineId) return;

    const isCurrentlyTwoVisits = m.daily_visit_target === 2 || m.notes?.includes('2x Kunjungan');
    const newTarget = isCurrentlyTwoVisits ? 1 : 2;

    let updatedNotes = m.notes || '';
    if (newTarget === 2) {
      if (!updatedNotes.includes('2x Kunjungan')) {
        updatedNotes = updatedNotes ? `${updatedNotes} [2x Kunjungan]` : '[2x Kunjungan]';
      }
    } else {
      updatedNotes = updatedNotes.replace(/\[?2x Kunjungan\]?/gi, '').trim();
    }

    setTogglingMachineId(m.id);
    try {
      const { error } = await supabase
        .from('machines')
        .update({
          daily_visit_target: newTarget,
          notes: updatedNotes || null,
        })
        .eq('id', m.id);

      if (error) {
        const { error: fallbackErr } = await supabase
          .from('machines')
          .update({
            notes: updatedNotes || null,
          })
          .eq('id', m.id);

        if (fallbackErr) throw fallbackErr;
      }

      toast.success(`Target kunjungan mesin ${displayMachineCode(m.machine_code)} diubah ke ${newTarget}x.`);
      await onRefresh();
    } catch (err: any) {
      console.error('Error toggling visit requirement:', err);
      toast.error('Gagal memperbarui target kunjungan: ' + err.message);
    } finally {
      setTogglingMachineId(null);
    }
  };

  const handleSaveStoreRouteOrder = async (storeId: string) => {
    const orderNum = parseInt(inputRouteOrder, 10);
    if (isNaN(orderNum) || orderNum < 1) {
      toast.error('Silakan masukkan nomor rute valid (angka 1 ke atas).');
      return;
    }

    setIsSavingRouteOrder(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ route_order: orderNum })
        .eq('id', storeId);

      if (error) throw error;

      toast.success(`Urutan rute berhasil diubah ke #${orderNum}!`);
      setEditingStoreRouteId(null);
      setInputRouteOrder('');
      await onRefresh();
    } catch (err: any) {
      console.error('Error saving store route order:', err);
      toast.error('Gagal menyimpan nomor rute: ' + err.message);
    } finally {
      setIsSavingRouteOrder(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-8">
      {/* Header & Subtitle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Route className="w-5 h-5 text-indigo-500" />
            <span>Rute & Operasional Lapangan</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola rute dropping, riwayat logistik armada, dan outlet marketing.
          </p>
        </div>
      </div>

      {/* Navigasi 3 Sub-Tab: Dropping, Logistik, Marketing */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveSubTab('dropping')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'dropping'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Dropping ({droppingStaff.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('logistik')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'logistik'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Logistik ({driverTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('marketing')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'marketing'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Marketing ({stores.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. KONTEN SUB-TAB DROPPING (SEPERTI SEKARANG)                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'dropping' && (
        <div className="space-y-1 pt-1">
          {droppingStaff.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-6 text-center">
              Belum ada staf dengan role Dropping di cabang ini.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {droppingStaff.map((staff) => {
                const staffMachines = machines.filter((m) => m.assigned_dropping_id === staff.id);

                return (
                  <div key={staff.id} className="py-3 first:pt-1 space-y-1">
                    {/* [nama petugas] */}
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">
                      {staff.full_name}
                    </h4>

                    {/* [Unit: total yang di pegang]   [tombol edit / info] */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Total mesin yang di pegang: <strong className="text-slate-800 dark:text-slate-200 font-bold">{staffMachines.length}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedDroppingForDetail(staff)}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition active:scale-90 cursor-pointer shadow-xs"
                        title="Detail Mesin Petugas"
                      >
                        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KONTEN SUB-TAB LOGISTIK (RIWAYAT TUGAS LOGISTIK)                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'logistik' && (
        <div className="space-y-3 pt-1">
          {/* Header & Filter Chips */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-indigo-500" />
              <span>Riwayat Tugas Logistik</span>
            </h3>

            <button
              type="button"
              onClick={fetchLogisticsTasks}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Segarkan data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogistics ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Status Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setLogisticsFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                logisticsFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Semua ({driverTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setLogisticsFilter('in_progress')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                logisticsFilter === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Proses / Antar ({driverTasks.filter((t) => t.status === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setLogisticsFilter('completed')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                logisticsFilter === 'completed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Selesai ({driverTasks.filter((t) => t.status === 'completed').length})
            </button>
            <button
              type="button"
              onClick={() => setLogisticsFilter('kendala')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                logisticsFilter === 'kendala'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Kendala ({driverTasks.filter((t) => t.status === 'kendala').length})
            </button>
          </div>

          {/* List Kartu Tugas Logistik (Unboxed nempel ke body) */}
          {filteredDriverTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Truck className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium">Belum ada riwayat tugas logistik.</p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {filteredDriverTasks.map((t) => {
                const teamInfo = t.notes?.match(/\[Tim Logistik: ([^\]]+)\]/);
                const assignedText = teamInfo ? teamInfo[1] : (t.driver?.full_name || 'Petugas');
                const isCompleted = t.status === 'completed';
                const isKendala = t.status === 'kendala';
                const isInProgress = t.status === 'in_progress';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskForSummary(t)}
                    className={`p-3.5 rounded-2xl flex items-start justify-between gap-3 text-xs transition-all cursor-pointer active:scale-[0.99] group shadow-xs ${
                      isCompleted
                        ? 'border-2 border-emerald-400/90 dark:border-emerald-600/90 bg-emerald-50/20 dark:bg-emerald-950/25 hover:border-emerald-500'
                        : isKendala
                        ? 'border-2 border-rose-400/90 dark:border-rose-600/90 bg-rose-50/20 dark:bg-rose-950/25 hover:border-rose-500'
                        : isInProgress
                        ? 'border-2 border-blue-400/90 dark:border-blue-600/90 bg-blue-50/20 dark:bg-blue-950/25 hover:border-blue-500'
                        : 'border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Toko Asal -> Toko Tujuan */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {t.store?.name || 'Toko Asal'}
                        </span>
                        {t.target_store && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{t.target_store.name}</span>
                          </span>
                        )}
                      </div>

                      {/* Nomor Mesin & Petugas */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        {t.machine?.machine_code && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600">
                            {displayMachineCode(t.machine.machine_code)}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-600 dark:text-slate-300">
                          Petugas: <strong className="text-slate-900 dark:text-white font-bold">{assignedText}</strong>
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-0.5 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Klik untuk melihat summary detail</span>
                      </p>
                    </div>

                    {/* Status & Jam */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                          t.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                            : t.status === 'kendala'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60'
                            : t.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                        }`}
                      >
                        {t.status === 'kendala'
                          ? 'Kendala'
                          : t.status === 'in_progress'
                          ? 'Diangkut / Kirim'
                          : t.status === 'assigned'
                          ? 'Ditugaskan'
                          : 'Selesai'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. KONTEN SUB-TAB MARKETING (OUTLET & TOKO MITRA MARKETING)                */}
      {/* ========================================================================= */}
      {activeSubTab === 'marketing' && (
        <div className="space-y-3 pt-1">
          {/* Search Bar & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama toko, pemilik, atau alamat..."
                value={marketingSearchQuery}
                onChange={(e) => setMarketingSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>

            {/* Filter Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setMarketingStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  marketingStatusFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Semua Toko ({stores.length})
              </button>
              <button
                type="button"
                onClick={() => setMarketingStatusFilter('proses')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  marketingStatusFilter === 'proses'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Menunggu Mesin ({stores.filter((s) => s.status !== 'terpasang').length})
              </button>
              <button
                type="button"
                onClick={() => setMarketingStatusFilter('terpasang')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  marketingStatusFilter === 'terpasang'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Terpasang Mesin ({stores.filter((s) => s.status === 'terpasang').length})
              </button>
            </div>
          </div>

          {/* List Kartu Toko Marketing */}
          {filteredMarketingStores.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <StoreIcon className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-medium">Tidak ada toko yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredMarketingStores.map((st) => {
                const isInstalled = st.status === 'terpasang';
                const installedMachine = machines.find((m) => m.id === st.current_machine_id || m.current_store_id === st.id);

                return (
                  <div
                    key={st.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2 shadow-xs transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {st.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{st.owner_name || 'Pemilik Belum Terdata'}</span>
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                          isInstalled
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                        }`}
                      >
                        {isInstalled ? 'Terpasang' : 'Menunggu Mesin'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5 font-medium line-clamp-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span>{st.address || 'Alamat belum diatur'}</span>
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      {installedMachine ? (
                        <div className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/80">
                          {displayMachineCode(installedMachine.machine_code)}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Belum ada unit mesin</span>
                      )}

                      <div className="flex items-center gap-1.5">
                        {st.phone && (
                          <a
                            href={`https://wa.me/${st.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-[11px] font-bold"
                            title="Hubungi WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </a>
                        )}
                        {st.latitude && st.longitude && (
                          <a
                            href={`https://maps.google.com/?q=${st.latitude},${st.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 flex items-center gap-1 text-[11px] font-bold"
                            title="Buka di Google Maps"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Peta</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL MESIN & TOKO DROPPING                                        */}
      {/* ========================================================================= */}
      {selectedDroppingForDetail && (() => {
        const staff = selectedDroppingForDetail;
        const prefix = staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name);
        const assignedMachines = machines
          .filter((m) => m.assigned_dropping_id === staff.id)
          .sort((a, b) => {
            const storeA = stores.find((s) => s.id === a.current_store_id);
            const storeB = stores.find((s) => s.id === b.current_store_id);
            const routeA = typeof storeA?.route_order === 'number' && storeA.route_order > 0 ? storeA.route_order : 9999;
            const routeB = typeof storeB?.route_order === 'number' && storeB.route_order > 0 ? storeB.route_order : 9999;
            if (routeA !== routeB) return routeA - routeB;
            return (a.machine_number || 0) - (b.machine_number || 0);
          });

        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header Modal */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="min-w-0 pr-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {staff.full_name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>Prefix:</span>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">{prefix}</strong>
                    <button
                      type="button"
                      onClick={() => handleOpenPrefixModal(staff)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5 ml-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDroppingForDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body: Daftar Mesin & Toko Dropping */}
              <div className="p-4 overflow-y-auto space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Daftar Mesin ({assignedMachines.length}/20):
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Atur urutan rute & target kunjungan
                  </span>
                </div>

                {assignedMachines.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Petugas ini belum memiliki mesin yang ditugaskan.
                  </div>
                ) : (
                  assignedMachines.map((m) => {
                    const storeMitra = stores.find((s) => s.id === m.current_store_id);
                    const isInstalled = m.status === 'terpasang' && m.current_store_id;

                    return (
                      <div key={m.id} className="pt-3 first:pt-0 flex items-center justify-between gap-2 text-xs">
                        {/* Kolom Kiri: Kode Mesin & Lokasi Toko */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                              {displayMachineCode(m.machine_code)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isInstalled
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {isInstalled ? 'Terpasang' : 'Gudang'}
                            </span>
                          </div>

                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block mt-1">
                            {storeMitra?.name || 'Di Gudang Cabang'}
                          </span>

                          {/* Pengaturan Nomor Rute Kunjungan */}
                          {isInstalled && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {editingStoreRouteId === m.current_store_id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    autoFocus
                                    value={inputRouteOrder}
                                    placeholder="No..."
                                    onChange={(e) => setInputRouteOrder(e.target.value)}
                                    className="w-16 px-2 py-0.5 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-white outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={isSavingRouteOrder}
                                    onClick={() => handleSaveStoreRouteOrder(m.current_store_id!)}
                                    className="px-2 py-0.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer transition disabled:opacity-50"
                                  >
                                    {isSavingRouteOrder ? '...' : 'Simpan'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStoreRouteId(null)}
                                    className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStoreRouteId(m.current_store_id!);
                                    setInputRouteOrder(storeMitra?.route_order?.toString() || '');
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>
                                    {storeMitra?.route_order ? `Rute #${storeMitra.route_order}` : '+ Set Rute'}
                                  </span>
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Kolom Kanan: Toggle 1x / 2x Kunjungan */}
                        {isInstalled && (
                          <div className="shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleVisitRequirement(m)}
                              disabled={togglingMachineId === m.id}
                              title="Klik untuk mengubah target kunjungan harian"
                              className="px-3 py-1 rounded-full text-xs font-semibold border border-dashed border-slate-400 hover:border-slate-800 dark:border-slate-500 dark:hover:border-slate-200 text-slate-800 dark:text-slate-200 bg-transparent transition active:scale-95 cursor-pointer disabled:opacity-50 select-none"
                            >
                              {togglingMachineId === m.id
                                ? '...'
                                : m.daily_visit_target === 2 || m.notes?.includes('2x Kunjungan')
                                ? '2x Kunjungan'
                                : '1x Kunjungan'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL EDIT PREFIX DROPPING                                                */}
      {/* ========================================================================= */}
      {isPrefixModalOpen && selectedStaffForPrefix && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Ubah Prefix Kode Mesin
              </h3>
              <button
                type="button"
                onClick={() => setIsPrefixModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Prefix untuk {selectedStaffForPrefix.full_name}:
              </label>
              <input
                type="text"
                maxLength={10}
                placeholder="Contoh: NAUFAL"
                value={inputPrefix}
                onChange={(e) => setInputPrefix(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Hasil: {sanitizeMachinePrefix(inputPrefix) || 'PREFIX'}-01 .. {sanitizeMachinePrefix(inputPrefix) || 'PREFIX'}-20.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPrefixModalOpen(false)}
                className="w-1/2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingPrefix}
                onClick={handleSavePrefix}
                className="w-1/2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingPrefix ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL SUMMARY LENGKAP DETAIL TUGAS LOGISTIK                               */}
      {/* ========================================================================= */}
      <BottomSheetModal
        item={selectedTaskForSummary}
        onClose={() => setSelectedTaskForSummary(null)}
      >
        {(task, close) => {
          const isReloc = task.task_type === 'relokasi_mesin';
          const isCompleted = task.status === 'completed';
          const isKendala = task.status === 'kendala';
          const isInProgress = task.status === 'in_progress';

          const teamInfo = task.notes?.match(/\[Tim Logistik: ([^\]]+)\]/);
          const assignedText = teamInfo ? teamInfo[1] : (task.driver?.full_name || 'Petugas Lapangan');

          return (
            <div className="space-y-4">
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isCompleted
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                        : isKendala
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        : isInProgress
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isKendala ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {isReloc ? 'Summary Relokasi Mesin' : 'Summary Tugas Logistik'}
                    </h3>
                    <span
                      className={`text-[11px] font-bold ${
                        isCompleted
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isKendala
                          ? 'text-rose-600 dark:text-rose-400'
                          : isInProgress
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {isCompleted
                        ? 'Status: Tugas Berhasil Selesai'
                        : isKendala
                        ? 'Status: Terdapat Kendala di Lapangan'
                        : isInProgress
                        ? 'Status: Sedang Diangkut / Dalam Pengiriman'
                        : 'Status: Ditugaskan ke Petugas'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rute & Info Tugas */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Toko Asal / Pengambilan:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm block">
                    {task.store?.name || 'Toko Asal'}
                  </span>
                  {task.store?.address && (
                    <span className="text-[11px] text-slate-500 block">{task.store.address}</span>
                  )}
                </div>

                {task.target_store && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-indigo-500 block font-semibold">Toko Tujuan / Pemasangan:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block">
                      {task.target_store.name}
                    </span>
                    {task.target_store.address && (
                      <span className="text-[11px] text-slate-500 block">{task.target_store.address}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Detail Petugas & Mesin */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Unit Mesin:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm mt-0.5 block">
                    {task.machine?.machine_code ? displayMachineCode(task.machine.machine_code) : '-'}
                  </span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">Petugas Lapangan:</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                    {assignedText}
                  </span>
                </div>
              </div>

              {/* Catatan / Keterangan Kendala */}
              {task.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Catatan Tugas:
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {task.notes}
                  </p>
                </div>
              )}
            </div>
          );
        }}
      </BottomSheetModal>
    </div>
  );
};
