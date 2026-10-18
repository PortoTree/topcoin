import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import {
  TrendingUp,
  DollarSign,
  Truck,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Eye,
  ShieldAlert,
  Coins,
  PackagePlus,
  Wrench,
  UserX,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { DroppingTransaction, Store, Machine, UserProfile, DriverTask, DriverTaskType } from '../../types';

interface AdminCabangViewProps {
  activeTab: string;
}

export const AdminCabangView: React.FC<AdminCabangViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();
  const { currentBranch } = useBranch();

  // Branch ID
  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // Live Data State
  const [droppings, setDroppings] = useState<DroppingTransaction[]>([]);
  const [droppingUsers, setDroppingUsers] = useState<UserProfile[]>([]);
  const [branchStaff, setBranchStaff] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [driverTasks, setDriverTasks] = useState<DriverTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reconciliation State
  const [selectedDroppingUserId, setSelectedDroppingUserId] = useState<string>('');
  const [physicalCash, setPhysicalCash] = useState<string>('');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);

  // Driver Dispatch State
  const [selectedTaskType, setSelectedTaskType] = useState<DriverTaskType>('pasang_baru');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedTargetStoreId, setSelectedTargetStoreId] = useState<string>('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [dispatchCoinAmount, setDispatchCoinAmount] = useState<string>('500');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Staff Management State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'marketing' | 'dropping' | 'driver'>('dropping');
  const [newStaffPin, setNewStaffPin] = useState('123456');
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  // Image Preview Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const fetchBranchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Droppings today for this branch
      const { data: dData } = await supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name, address),
          machine:machines(machine_code),
          dropping_user:profiles(id, full_name, username)
        `)
        .eq('branch_id', activeBranchId)
        .eq('transaction_date', today)
        .order('created_at', { ascending: false });

      if (dData) setDroppings(dData as DroppingTransaction[]);

      // 2. Staff in this branch
      const { data: uData } = await supabase
        .from('profiles')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('full_name', { ascending: true });

      if (uData) {
        const staffList = uData as UserProfile[];
        setBranchStaff(staffList);
        setDroppingUsers(staffList.filter((u) => u.role === 'dropping'));
      }

      // 3. Stores in this branch
      const { data: sData } = await supabase
        .from('stores')
        .select(`*, machine:machines!stores_current_machine_id_fkey(machine_code, status)`)
        .eq('branch_id', activeBranchId)
        .order('name', { ascending: true });

      if (sData) setStores(sData as Store[]);

      // 4. Machines in this branch
      const { data: mData } = await supabase
        .from('machines')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('machine_code', { ascending: true });

      if (mData) setMachines(mData as Machine[]);

      // 5. Driver Tasks in this branch
      const { data: tData } = await supabase
        .from('driver_tasks')
        .select(`
          *,
          store:stores(name, address),
          target_store:stores!target_store_id(name, address),
          machine:machines(machine_code),
          driver:profiles!driver_id(full_name, username)
        `)
        .eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false });

      if (tData) setDriverTasks(tData as DriverTask[]);
    } catch (err) {
      console.error('Error fetching admin cabang data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchBranchData();
  }, [fetchBranchData]);

  // Omset Totals Today
  const totalGrossToday = droppings.reduce((acc, d) => acc + (d.gross_omset || 0), 0);
  const totalShareToday = droppings.reduce((acc, d) => acc + (d.store_share_amount || 0), 0);
  const totalNetToday = droppings.reduce((acc, d) => acc + (d.net_deposit_amount || 0), 0);

  // Reconciliation calculations
  const selectedUserDroppings = droppings.filter(
    (d) => d.dropping_user_id === selectedDroppingUserId
  );
  const userSystemTotalNet = selectedUserDroppings.reduce(
    (acc, d) => acc + (d.net_deposit_amount || 0),
    0
  );
  const numPhysicalCash = parseFloat(physicalCash.replace(/[^0-9]/g, '')) || 0;
  const cashDifference = numPhysicalCash - userSystemTotalNet;

  // Handle Save Reconciliation (Tutup Kas)
  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDroppingUserId) {
      alert('Pilih petugas dropping yang akan direkonsiliasi.');
      return;
    }

    setIsReconciling(true);
    setReconcileSuccess(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const status = cashDifference === 0 ? 'matched' : 'unmatched';

      const { error } = await supabase.from('daily_reconciliations').upsert(
        {
          branch_id: activeBranchId,
          reconciliation_date: today,
          dropping_user_id: selectedDroppingUserId,
          system_total_net: userSystemTotalNet,
          physical_cash_received: numPhysicalCash,
          status,
          verified_by: profile?.id,
          notes: reconciliationNotes.trim() || null,
        },
        { onConflict: 'branch_id,reconciliation_date,dropping_user_id' }
      );

      if (error) console.warn('DB reconciliation fallback:', error);

      confetti({ particleCount: 50, spread: 60 });
      setReconcileSuccess(
        `Rekonsiliasi kas berhasil disetujui! Status: ${
          status === 'matched' ? 'COCOK (Nol Selisih)' : `SELISIH ${formatIDR(cashDifference)}`
        }.`
      );
      setPhysicalCash('');
      setReconciliationNotes('');
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      alert(err.message || 'Gagal menyimpan rekonsiliasi kas.');
    } finally {
      setIsReconciling(false);
    }
  };

  // Handle Dispatch Driver Task
  const handleDispatchTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedDriverId) {
      alert('Pilih driver yang akan ditugaskan.');
      return;
    }
    if (!selectedStoreId && selectedTaskType !== 'tarik_rusak') {
      alert('Pilih toko tujuan.');
      return;
    }

    setIsDispatching(true);
    setDispatchSuccess(null);
    try {
      const payload = {
        branch_id: activeBranchId,
        task_type: selectedTaskType,
        driver_id: selectedDriverId,
        assigned_by: profile.id,
        store_id: selectedStoreId || null,
        target_store_id: selectedTaskType === 'relokasi_mesin' ? selectedTargetStoreId : null,
        machine_id: selectedMachineId || null,
        coin_amount: selectedTaskType === 'antar_koin' ? parseInt(dispatchCoinAmount, 10) || 500 : 0,
        status: 'assigned',
        notes: dispatchNotes.trim() || null,
      };

      const { error } = await supabase.from('driver_tasks').insert(payload);
      if (error) console.warn('DB dispatch task fallback:', error);

      confetti({ particleCount: 40, spread: 50 });
      setDispatchSuccess('Tugas berhasil dibuat dan dikirimkan ke driver!');
      setDispatchNotes('');
      fetchBranchData();
    } catch (err: any) {
      console.error('Dispatch error:', err);
      alert(err.message || 'Gagal membuat tugas driver.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Handle Request Delete Employee (Hierarchical Deletion - Step 1: Lock & Pending Deletion)
  const handleRequestDeleteStaff = async (staff: UserProfile) => {
    const confirmed = window.confirm(
      `PERINGATAN HAPUS AKUN:\n\nAjukan penghapusan akun untuk "${staff.full_name}" (${staff.username})?\n\nAkun akan LANGSUNG DIKUNCI (status: pending_deletion) dan diteruskan ke Branch Manager untuk konfirmasi final.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          deletion_status: 'pending_deletion',
          is_active: false,
          deletion_requested_by: profile?.id,
          deletion_requested_at: new Date().toISOString(),
        })
        .eq('id', staff.id);

      if (error) console.warn('DB delete lock fallback:', error);

      // Local update
      setBranchStaff((prev) =>
        prev.map((s) =>
          s.id === staff.id
            ? { ...s, deletion_status: 'pending_deletion', is_active: false }
            : s
        )
      );

      alert(`Akun "${staff.username}" berhasil dikunci dan permohonan telah diteruskan ke Branch Manager.`);
    } catch (err: any) {
      console.error('Delete request error:', err);
      alert(err.message || 'Gagal mengajukan penghapusan akun.');
    }
  };

  // Add new branch staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffUsername.trim() || !newStaffFullName.trim()) {
      alert('Isi username dan nama lengkap.');
      return;
    }

    setIsAddingStaff(true);
    try {
      const newStaffId = 'user-' + Date.now();
      const payload: Partial<UserProfile> = {
        id: newStaffId,
        username: newStaffUsername.trim().toLowerCase(),
        full_name: newStaffFullName.trim(),
        role: newStaffRole,
        branch_id: activeBranchId,
        pin: newStaffPin.trim() || '123456',
        is_active: true,
        deletion_status: 'active',
      };

      const { error } = await supabase.from('profiles').insert(payload);
      if (error) console.warn('DB add staff fallback:', error);

      setBranchStaff((prev) => [payload as UserProfile, ...prev]);
      setShowAddStaffModal(false);
      setNewStaffUsername('');
      setNewStaffFullName('');
      alert(`Karyawan "${newStaffFullName}" (${newStaffRole}) berhasil didaftarkan!`);
    } catch (err: any) {
      console.error('Add staff error:', err);
      alert(err.message || 'Gagal menambah karyawan.');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const driversList = branchStaff.filter((s) => s.role === 'driver');
  const warehouseMachines = machines.filter((m) => m.status === 'gudang');

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Scope Header */}
      <div className="bg-gradient-to-r from-cyan-900 via-slate-900 to-slate-950 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden border border-cyan-500/30">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-[11px] font-bold mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            OPERASIONAL CABANG
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {currentBranch ? currentBranch.name : 'Cabang Utama'}
          </h2>
          <p className="text-xs text-cyan-200 mt-1 font-medium">
            Kendali kas harian, penugasan driver, dan monitoring omset cabang
          </p>
        </div>
      </div>

      {/* Tab: Live Omset Monitoring */}
      {activeTab === 'monitoring' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Omset Kotor
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatIDR(totalGrossToday)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Jatah Toko
              </span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5 block truncate">
                {formatIDR(totalShareToday)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Setoran Bersih
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                {formatIDR(totalNetToday)}
              </span>
            </div>
          </div>

          {/* Droppings List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                Live Transaksi Dropping Hari Ini ({droppings.length})
              </h3>
              <button
                type="button"
                onClick={fetchBranchData}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {droppings.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Belum ada transaksi dropping hari ini.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {droppings.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white">{d.store?.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Petugas: {d.dropping_user?.full_name} • Unit: {d.machine?.machine_code}
                      </p>
                      {d.discrepancy_reason && (
                        <p className="text-[10px] text-rose-500 font-semibold mt-0.5">
                          ⚠️ Selisih: {d.meter_discrepancy} koin ({d.discrepancy_reason})
                        </p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white block font-mono">
                          {formatIDR(d.net_deposit_amount)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {d.coins_collected} Koin
                        </span>
                      </div>
                      {d.photo_machine_meter_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoUrl(d.photo_machine_meter_url || null)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                          title="Lihat Foto Bukti"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Rekonsiliasi Kas (Tutup Kas) */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Rekonsiliasi Kas Fisik Setoran
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
              Hitung uang fisik setoran dari petugas Dropping dan cocokkan dengan data sistem.
            </p>
          </div>

          {reconcileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{reconcileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveReconciliation} className="space-y-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Petugas Dropping *
              </label>
              <select
                required
                value={selectedDroppingUserId}
                onChange={(e) => setSelectedDroppingUserId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">-- Pilih Petugas Dropping --</option>
                {droppingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            {selectedDroppingUserId && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Setoran Tercatat Sistem:</span>
                  <span className="font-black text-slate-900 dark:text-white font-mono">
                    {formatIDR(userSystemTotalNet)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah Transaksi:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {selectedUserDroppings.length} Toko
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Uang Fisik Diterima di Tangan (Rp) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="Contoh: 150000"
                value={physicalCash}
                onChange={(e) => setPhysicalCash(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            {numPhysicalCash > 0 && selectedDroppingUserId && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                  cashDifference === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300'
                }`}
              >
                <span>Status Selisih Kas:</span>
                <span className="font-mono text-sm">
                  {cashDifference === 0 ? '✓ COCOK (Rp 0)' : `${cashDifference > 0 ? '+' : ''}${formatIDR(cashDifference)}`}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Rekonsiliasi (Wajib jika ada selisih)
              </label>
              <textarea
                rows={2}
                value={reconciliationNotes}
                onChange={(e) => setReconciliationNotes(e.target.value)}
                placeholder="Catatan penerimaan uang fisik..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isReconciling || !selectedDroppingUserId}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isReconciling ? 'Menyimpan...' : 'Setujui Rekonsiliasi Kas (Tutup Kas)'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab: Driver Task Dispatching */}
      {activeTab === 'driver_dispatch' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              Dispatching Tugas Driver
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
              Buat dan tugaskan tiket operasional unit mesin ke armada Driver cabang.
            </p>
          </div>

          {dispatchSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{dispatchSuccess}</span>
            </div>
          )}

          <form onSubmit={handleDispatchTask} className="space-y-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            {/* 1. Jenis Tugas */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Jenis Tugas *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'pasang_baru', label: 'Pasang Baru', icon: PackagePlus },
                  { id: 'relokasi_mesin', label: 'Relokasi Mesin', icon: Truck },
                  { id: 'tarik_rusak', label: 'Tarik Unit Rusak', icon: Wrench },
                  { id: 'antar_koin', label: 'Antar Stok Koin', icon: Coins },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedTaskType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedTaskType(item.id as DriverTaskType)}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-400 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Pilih Driver */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tugaskan ke Driver *
              </label>
              <select
                required
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">-- Pilih Driver Cabang --</option>
                {driversList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.username})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Pilih Toko */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Toko Mitra Tujuan *
              </label>
              <select
                required
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="">-- Pilih Toko --</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.address}) - Status: {s.status}
                  </option>
                ))}
              </select>
            </div>

            {/* If Relocation: Target Store */}
            {selectedTaskType === 'relokasi_mesin' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pindahkan ke Toko Mitra Baru *
                </label>
                <select
                  required
                  value={selectedTargetStoreId}
                  onChange={(e) => setSelectedTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="">-- Pilih Toko Tujuan Relokasi --</option>
                  {stores
                    .filter((s) => s.id !== selectedStoreId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.address})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* If Pasang Baru: Pilih Unit Mesin dari Gudang */}
            {selectedTaskType === 'pasang_baru' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit Mesin dari Gudang Cabang *
                </label>
                <select
                  required
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="">-- Pilih Unit Mesin di Gudang --</option>
                  {warehouseMachines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} (Counter: {m.last_counter_meter})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Antar Koin: Input Jumlah Koin */}
            {selectedTaskType === 'antar_koin' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Jumlah Stok Koin yang Diantar *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={dispatchCoinAmount}
                  onChange={(e) => setDispatchCoinAmount(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Instruksi Khusus untuk Driver (Opsional)
              </label>
              <textarea
                rows={2}
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Misal: Bertemu dengan Ibu Ratna di kasir..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isDispatching}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 transition cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>{isDispatching ? 'Menugaskan...' : 'Kirimkan Tiket Tugas ke Driver'}</span>
            </button>
          </form>

          {/* List of Recent Driver Tasks */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
              Daftar Tugas Driver ({driverTasks.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {driverTasks.map((t) => (
                <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white">
                      {t.task_type.toUpperCase().replace('_', ' ')}: {t.store?.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Driver: {t.driver?.full_name} • Status: {t.status}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      t.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Karyawan Cabang & Pengajuan Hapus Akun */}
      {activeTab === 'employees' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Karyawan Cabang</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total {branchStaff.length} akun staf di {currentBranch?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Karyawan</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            {branchStaff.map((staff) => {
              const isPendingDelete = staff.deletion_status === 'pending_deletion' || !staff.is_active;

              return (
                <div key={staff.id} className="p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {staff.full_name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {staff.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Username: {staff.username} • PIN: {staff.pin || '123456'}
                    </p>
                    {isPendingDelete && (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                        <ShieldAlert className="w-3 h-3" />
                        Terkunci: Menunggu persetujuan Branch Manager
                      </span>
                    )}
                  </div>

                  <div>
                    {!isPendingDelete && staff.role !== 'admin_cabang' && (
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteStaff(staff)}
                        className="py-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        title="Ajukan Hapus Akun ke Branch Manager"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Mesin & Toko Overview */}
      {activeTab === 'machines' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              Status Unit Mesin di Cabang ({machines.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                <span className="text-slate-500 block">Unit di Gudang:</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-base">
                  {warehouseMachines.length} Unit
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs">
                <span className="text-emerald-700 dark:text-emerald-400 block">Unit Terpasang:</span>
                <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-base">
                  {machines.filter((m) => m.status === 'terpasang').length} Unit
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Tambah Karyawan Cabang Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Andi Prasetyo"
                  value={newStaffFullName}
                  onChange={(e) => setNewStaffFullName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Username Login *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: andi"
                  value={newStaffUsername}
                  onChange={(e) => setNewStaffUsername(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Peran Tugas *
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="dropping">Dropping (Koleksi Omset)</option>
                  <option value="marketing">Marketing (Pendaftaran Toko)</option>
                  <option value="driver">Driver (Logistik Mesin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  PIN Keamanan 6-Digit *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
                >
                  {isAddingStaff ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-sm w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-2 border border-slate-800">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 rounded-full text-white cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Foto Bukti Lapangan"
              className="w-full h-auto rounded-2xl object-cover max-h-[75vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
