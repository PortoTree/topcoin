import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  DollarSign,
  Cpu,
  Sliders,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  MoveRight,
  Eye,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { DroppingTransaction, Store, Machine, UserProfile } from '../../types';
import { toast } from '../../context/ToastContext';

interface AdminViewProps {
  activeTab: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ activeTab }) => {
  // Live Omset Data
  const [droppings, setDroppings] = useState<DroppingTransaction[]>([]);
  const [droppingUsers, setDroppingUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reconciliation State
  const [selectedDroppingUserId, setSelectedDroppingUserId] = useState<string>('');
  const [physicalCash, setPhysicalCash] = useState<string>('');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);

  // Machine Relocation State
  const [selectedMachineToMove, setSelectedMachineToMove] = useState<string>('');
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  const [relocationReason, setRelocationReason] = useState<string>('');
  const [isRelocating, setIsRelocating] = useState(false);

  // App Settings State
  const [showPeerRecap, setShowPeerRecap] = useState<boolean>(false);
  const [showPastHistory, setShowPastHistory] = useState<boolean>(true);
  const [resetHour, setResetHour] = useState<number>(7);
  const [resetMinute, setResetMinute] = useState<number>(0);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch Today Droppings with realtime joins
      const { data: dData } = await supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name, address),
          machine:machines(machine_code),
          dropping_user:profiles(id, full_name, username)
        `)
        .eq('transaction_date', today)
        .order('created_at', { ascending: false });

      if (dData) setDroppings(dData as DroppingTransaction[]);

      // 2. Fetch Dropping personnel
      const { data: uData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'dropping');

      if (uData) setDroppingUsers(uData as UserProfile[]);

      // 3. Fetch Stores
      const { data: sData } = await supabase
        .from('stores')
        .select(`*, machine:machines(machine_code)`)
        .order('name', { ascending: true });

      if (sData) setStores(sData as Store[]);

      // 4. Fetch Machines
      const { data: mData } = await supabase
        .from('machines')
        .select('*')
        .order('machine_code', { ascending: true });

      if (mData) setMachines(mData as Machine[]);

      // 5. Fetch Settings
      const { data: setts } = await supabase.from('app_settings').select('*');
      if (setts) {
        setts.forEach((s) => {
          if (s.key === 'privacy_show_peer_recap') setShowPeerRecap(s.value?.enabled ?? false);
          if (s.key === 'privacy_show_past_history') setShowPastHistory(s.value?.enabled ?? true);
          if (s.key === 'system_reset_time') {
            setResetHour(s.value?.reset_hour ?? 0);
            setResetMinute(s.value?.reset_minute ?? 0);
          }
        });
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    // Setup Supabase Realtime Subscription for live updates
    const channel = supabase
      .channel('admin-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'droppings' },
        () => {
          fetchAdminData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Omset totals
  const totalGrossToday = droppings.reduce((acc, d) => acc + Number(d.gross_omset), 0);
  const totalCutToday = droppings.reduce((acc, d) => acc + Number(d.store_cut_amount), 0);
  const totalNetToday = droppings.reduce((acc, d) => acc + Number(d.net_deposit_amount), 0);

  // Reconciliation calculations
  const selectedUserDroppings = droppings.filter(
    (d) => d.dropping_user_id === selectedDroppingUserId
  );
  const userSystemTotalNet = selectedUserDroppings.reduce(
    (acc, d) => acc + Number(d.net_deposit_amount),
    0
  );
  const numPhysicalCash = parseFloat(physicalCash.replace(/[^0-9]/g, '')) || 0;
  const cashDifference = numPhysicalCash - userSystemTotalNet;

  // Handle Save Reconciliation
  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDroppingUserId) {
      toast.warning('Pilih petugas dropping yang akan ditutup bukunya.');
      return;
    }

    setIsReconciling(true);
    setReconcileSuccess(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const status = cashDifference === 0 ? 'matched' : 'unmatched';

      const { error } = await supabase.from('daily_reconciliations').upsert(
        {
          reconciliation_date: today,
          dropping_user_id: selectedDroppingUserId,
          system_total_net: userSystemTotalNet,
          physical_cash_received: numPhysicalCash,
          status,
          notes: reconciliationNotes.trim() || null,
        },
        { onConflict: 'reconciliation_date,dropping_user_id' }
      );

      if (error) throw error;

      const successMsg = `Rekonsiliasi tersimpan! Status: ${
        status === 'matched' ? 'COCOK (Match 100%)' : 'UNMATCH (Ada Selisih)'
      }`;
      setReconcileSuccess(successMsg);
      toast.success(successMsg);
      setPhysicalCash('');
      setReconciliationNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan rekonsiliasi kas.');
    } finally {
      setIsReconciling(false);
    }
  };

  // Handle Machine Relocation
  const handleRelocateMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineToMove || !targetStoreId) {
      toast.warning('Pilih mesin dan toko tujuan relokasi.');
      return;
    }

    setIsRelocating(true);
    try {
      const machine = machines.find((m) => m.id === selectedMachineToMove);
      const fromStoreId = machine?.current_store_id || null;

      // 1. Insert history log
      await supabase.from('machine_relocations').insert({
        machine_id: selectedMachineToMove,
        from_store_id: fromStoreId,
        to_store_id: targetStoreId,
        reason: relocationReason.trim() || 'Relokasi performa toko',
      });

      // 2. Update previous store machine if any
      if (fromStoreId) {
        await supabase
          .from('stores')
          .update({ current_machine_id: null })
          .eq('id', fromStoreId);
      }

      // 3. Update target store
      await supabase
        .from('stores')
        .update({ current_machine_id: selectedMachineToMove, status: 'terkirim' })
        .eq('id', targetStoreId);

      // 4. Update machine
      await supabase
        .from('machines')
        .update({ current_store_id: targetStoreId, status: 'terpasang' })
        .eq('id', selectedMachineToMove);

      toast.success('Mesin berhasil dipindahkan ke toko baru!');
      setSelectedMachineToMove('');
      setTargetStoreId('');
      setRelocationReason('');
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal merelokasi mesin.');
    } finally {
      setIsRelocating(false);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.from('app_settings').upsert([
        {
          key: 'privacy_show_peer_recap',
          value: { enabled: showPeerRecap },
          description: 'Izinkan petugas dropping melihat rekap total rekan lainnya',
        },
        {
          key: 'privacy_show_past_history',
          value: { enabled: showPastHistory },
          description: 'Izinkan petugas dropping melihat histori transaksi hari-hari lalu',
        },
        {
          key: 'system_reset_time',
          value: { reset_hour: Number(resetHour), reset_minute: Number(resetMinute) },
          description: 'Jam reset harian untuk sesi login dan absen seluruh akun',
        },
      ]);
      toast.success('Pengaturan privasi dan jam reset berhasil diperbarui!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Tab 1: Live Monitoring */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Live Monitoring Omset Hari Ini
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Realtime stream dari seluruh tim lapangan</p>
            </div>
            <button
              onClick={fetchAdminData}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Grand Total Cards */}
          <div className="grid grid-cols-1 gap-2.5">
            <div className="bg-gradient-to-br from-indigo-50 via-white to-slate-50 dark:from-indigo-900/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-4 shadow-sm">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Total Omset Kotor (100%)</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">
                {formatIDR(totalGrossToday)}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">Bagi Hasil Toko (10%)</span>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 font-mono">
                    {formatIDR(totalCutToday)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Setoran Bersih (90%)</span>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 font-mono">
                    {formatIDR(totalNetToday)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Per Personil Dropping Breakdown */}
          <div className="space-y-2 pt-1">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Rekap Per Petugas Dropping ({droppingUsers.length} Personil)
            </h3>
            <div className="space-y-2">
              {droppingUsers.map((u) => {
                const userDrops = droppings.filter((d) => d.dropping_user_id === u.id);
                const userGross = userDrops.reduce((acc, d) => acc + Number(d.gross_omset), 0);
                const userNet = userDrops.reduce((acc, d) => acc + Number(d.net_deposit_amount), 0);

                return (
                  <div
                    key={u.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-xs transition-colors"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {u.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {userDrops.length} Toko • Omset: {formatIDR(userGross)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Wajib Setor (90%):</span>
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                        {formatIDR(userNet)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Activity Feed */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Live Feed Transaksi Terkini ({droppings.length})
            </h3>
            {droppings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500 shadow-xs">
                Belum ada transaksi dropping yang masuk hari ini.
              </div>
            ) : (
              droppings.map((d) => (
                <div
                  key={d.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 text-xs shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{d.store?.name}</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Oleh: {d.dropping_user?.full_name} • Mesin: {d.machine?.machine_code}
                      </p>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">
                      +{formatIDR(Number(d.net_deposit_amount))}
                    </span>
                  </div>
                  {/* Photo thumbnail links */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    {d.photo_machine_url && (
                      <a
                        href={d.photo_machine_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Mesin
                      </a>
                    )}
                    {d.photo_machine_number_url && (
                      <a
                        href={d.photo_machine_number_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        No Seri
                      </a>
                    )}
                    {d.photo_coin_url && (
                      <a
                        href={d.photo_coin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Coin
                      </a>
                    )}
                    {d.photo_nota_url && (
                      <a
                        href={d.photo_nota_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Nota
                      </a>
                    )}
                    {d.photo_optional_url && (
                      <a
                        href={d.photo_optional_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Tambahan
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Reconciliation (Tutup Buku Kas Akhir Hari) */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Tutup Kas Fisik Harian (Rekonsiliasi)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Cocokkan uang tunai fisik yang diserahkan petugas dropping dengan setoran 90% di sistem.
            </p>
          </div>

          {reconcileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{reconcileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveReconciliation} className="space-y-4">
            {/* Personel Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Petugas Dropping *
              </label>
              <select
                required
                value={selectedDroppingUserId}
                onChange={(e) => {
                  setSelectedDroppingUserId(e.target.value);
                  setReconcileSuccess(null);
                }}
                className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              >
                <option value="">-- Pilih Petugas --</option>
                {droppingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            {selectedDroppingUserId && (
              <>
                {/* System vs Physical Comparison Card */}
                <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Setoran 90% Menurut Sistem:
                    </span>
                    <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                      {formatIDR(userSystemTotalNet)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                      Jumlah Uang Fisik yang Diterima (Rp) *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="0"
                      value={physicalCash ? Number(numPhysicalCash).toLocaleString('id-ID') : ''}
                      onChange={(e) => setPhysicalCash(e.target.value)}
                      className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono shadow-xs"
                    />
                  </div>

                  {/* Difference Result */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      cashDifference === 0
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                        : cashDifference < 0
                        ? 'bg-rose-50 dark:bg-rose-500/15 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                        : 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div>
                      <span className="text-[11px] font-bold block">
                        {cashDifference === 0
                          ? 'STATUS: COCOK (MATCH 100%)'
                          : cashDifference < 0
                          ? 'STATUS: UANG KURANG'
                          : 'STATUS: UANG LEBIH'}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {cashDifference === 0
                          ? 'Kas fisik pas dengan hitungan sistem.'
                          : 'Periksa kembali nota fisik atau setoran.'}
                      </span>
                    </div>
                    <span className="text-base font-black font-mono">
                      {formatIDR(cashDifference)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Berita Acara / Keterangan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Titipan bensin Rp 20.000, uang pas disetor..."
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs min-h-[72px] resize-y"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isReconciling || numPhysicalCash < 0}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/25 active:scale-[0.98] transition disabled:opacity-50 touch-target"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Konfirmasi Tutup Kas Petugas Ini</span>
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {/* Tab 3: Machine Relocation & Inventory */}
      {activeTab === 'machines' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Relokasi Mesin & Inventaris
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Pindahkan mesin dari toko yang kurang produktif ke toko baru.
            </p>
          </div>

          {/* Relocation Form */}
          <form
            onSubmit={handleRelocateMachine}
            className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs"
          >
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MoveRight className="w-4 h-4 text-amber-500" />
              Form Pindah Mesin
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Mesin yang Akan Dipindah *
              </label>
              <select
                required
                value={selectedMachineToMove}
                onChange={(e) => setSelectedMachineToMove(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white font-mono shadow-xs"
              >
                <option value="">-- Pilih Mesin --</option>
                {machines.map((m) => {
                  const currentStore = stores.find((s) => s.id === m.current_store_id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - Status: {m.status} (
                      {currentStore ? `Toko: ${currentStore.name}` : 'Gudang'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Toko Tujuan Baru *
              </label>
              <select
                required
                value={targetStoreId}
                onChange={(e) => setTargetStoreId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white shadow-xs"
              >
                <option value="">-- Pilih Toko Tujuan --</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.address})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alasan Perpindahan
              </label>
              <input
                type="text"
                placeholder="Contoh: Omset toko lama rendah, kontrak baru..."
                value={relocationReason}
                onChange={(e) => setRelocationReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isRelocating || !selectedMachineToMove || !targetStoreId}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50 touch-target shadow-xs"
            >
              <span>Proses Perpindahan Mesin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Machines List */}
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Daftar Seluruh Unit Mesin ({machines.length} Unit)
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {machines.map((m) => {
                const currentStore = stores.find((s) => s.id === m.current_store_id);
                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs shadow-xs transition-colors"
                  >
                    <div>
                      <span className="font-extrabold font-mono text-slate-900 dark:text-white text-sm">
                        {m.machine_code}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Lokasi: {currentStore ? currentStore.name : 'Stok Gudang'}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        m.status === 'terpasang'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                          : m.status === 'dikirim'
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                      }`}
                    >
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Privacy Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Pengaturan Privasi Lapangan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Atur batas hak lihat data oleh karyawan dropping di smartphone mereka.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-xs">
            {/* Toggle 1: Show Peer Recap */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Lihat Rekap Omset Rekan Kerja
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Bila dinonaktifkan, petugas dropping hanya dapat melihat omset mereka sendiri.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPeerRecap(!showPeerRecap)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showPeerRecap ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    showPeerRecap ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Show Past History */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Lihat Riwayat Hari-Hari Sebelumnya
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Bila dinonaktifkan, petugas hanya dapat melihat data dropping pada hari berjalan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPastHistory(!showPastHistory)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showPastHistory ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    showPastHistory ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Jam Reset Harian Input */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Jam Reset Harian Sesi Karyawan
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Di jam ini seluruh sesi akun lapangan otomatis kembali ke halaman login & absen.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Jam (00 - 23)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={resetHour}
                    onChange={(e) => setResetHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono text-center shadow-xs"
                  />
                </div>
                <span className="text-slate-900 dark:text-white font-bold pt-4">:</span>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Menit (00 - 59)</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={resetMinute}
                    onChange={(e) => setResetMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white font-mono text-center shadow-xs"
                  />
                </div>
                <div className="pt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  WIB (Pagi)
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
              className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50 touch-target shadow-md shadow-indigo-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Simpan Perubahan Pengaturan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
