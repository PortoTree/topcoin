import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import {
  Cpu,
  ArrowRightLeft,
  Plus,
  Edit2,
  X,
  Warehouse,
  Search,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type { Machine, UserProfile, Store } from '../../../types';
import {
  formatMachineCode,
  displayMachineCode,
  sanitizeMachinePrefix,
  getNextAvailableMachineNumber,
  recodeMachinesForDropping,
  validateNewMachineInput,
} from '../../../lib/machineCodeLogic';

interface MachineManagerMobileProps {
  branchId: string;
  machines: Machine[];
  droppingStaff: UserProfile[];
  stores: Store[];
  onRefresh: () => Promise<void> | void;
}

export const MachineManagerMobile: React.FC<MachineManagerMobileProps> = ({
  branchId,
  machines,
  droppingStaff,
  stores,
  onRefresh,
}) => {
  // Sub-Tab Switcher: 'dropping' (Petugas Dropping) vs 'all_machines' (Semua Mesin)
  const [activeSubTab, setActiveSubTab] = useState<'dropping' | 'all_machines'>('dropping');

  // State Filter & Pencarian
  const [selectedDroppingFilter, setSelectedDroppingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // State Modal Fullscreen Detail Dropping (Info & List Mesin)
  const [selectedDroppingForDetail, setSelectedDroppingForDetail] = useState<UserProfile | null>(null);

  // State Modal Setting Prefix Dropping
  const [isPrefixModalOpen, setIsPrefixModalOpen] = useState(false);
  const [selectedStaffForPrefix, setSelectedStaffForPrefix] = useState<UserProfile | null>(null);
  const [inputPrefix, setInputPrefix] = useState('');
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);

  // State Modal Tukar / Mutasi Mesin
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedMachineForTransfer, setSelectedMachineForTransfer] = useState<Machine | null>(null);
  const [targetDroppingId, setTargetDroppingId] = useState<string>('');
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);

  // State Modal Tambah Mesin Satuan
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [addDroppingId, setAddDroppingId] = useState<string>('');
  const [addMachineNumber, setAddMachineNumber] = useState<number | ''>('');
  const [addStoreId, setAddStoreId] = useState<string>('');
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // State loading toggle kunjungan mesin
  const [togglingMachineId, setTogglingMachineId] = useState<string | null>(null);

  // State ubah nomor rute toko
  const [editingStoreRouteId, setEditingStoreRouteId] = useState<string | null>(null);
  const [inputRouteOrder, setInputRouteOrder] = useState<string>('');
  const [isSavingRouteOrder, setIsSavingRouteOrder] = useState<boolean>(false);

  // Filter mesin berdasarkan dropping & pencarian
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      // Filter Dropping
      if (selectedDroppingFilter === 'unassigned') {
        if (m.assigned_dropping_id) return false;
      } else if (selectedDroppingFilter !== 'all') {
        if (m.assigned_dropping_id !== selectedDroppingFilter) return false;
      }

      // Filter Pencarian (kode mesin / nama toko)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = m.machine_code.toLowerCase().includes(q);
        const storeMatch = m.store?.name.toLowerCase().includes(q);
        return codeMatch || storeMatch;
      }

      return true;
    });
  }, [machines, selectedDroppingFilter, searchQuery]);

  // Statistik Ringkasan
  const totalCount = machines.length;

  // Buka Modal Edit Prefix
  const handleOpenPrefixModal = (staff: UserProfile) => {
    setSelectedStaffForPrefix(staff);
    setInputPrefix(staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name));
    setIsPrefixModalOpen(true);
  };

  // Simpan Prefix Dropping & Recode Mesin yang sudah dipegang
  const handleSavePrefix = async () => {
    if (!selectedStaffForPrefix) return;
    const cleanPrefix = sanitizeMachinePrefix(inputPrefix);
    if (!cleanPrefix) {
      toast.error('Prefix tidak boleh kosong.');
      return;
    }

    setIsSavingPrefix(true);
    try {
      // 1. Update machine_prefix pada tabel profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ machine_prefix: cleanPrefix })
        .eq('id', selectedStaffForPrefix.id);

      if (profileErr) throw profileErr;

      // 2. Recode semua mesin milik dropping ini di database
      const staffMachines = machines.filter((m) => m.assigned_dropping_id === selectedStaffForPrefix.id);
      if (staffMachines.length > 0) {
        const updatedMachines = recodeMachinesForDropping(staffMachines, cleanPrefix);

        for (const item of updatedMachines) {
          await supabase
            .from('machines')
            .update({
              machine_code: item.machine_code,
              machine_number: item.machine_number,
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

  // Buka Modal Transfer / Tukar Mesin
  const handleOpenTransferModal = (m: Machine) => {
    setSelectedMachineForTransfer(m);
    setTargetDroppingId(m.assigned_dropping_id || '');
    setIsTransferModalOpen(true);
  };

  // Eksekusi Transfer / Tukar Dropping
  const handleSaveTransfer = async () => {
    if (!selectedMachineForTransfer) return;

    setIsSavingTransfer(true);
    try {
      if (!targetDroppingId) {
        // Pindah ke Gudang (lepas assignment & lepas dari toko jika ada)
        const previousStoreId = selectedMachineForTransfer.current_store_id;

        const { error } = await supabase
          .from('machines')
          .update({
            assigned_dropping_id: null,
            status: 'gudang',
            current_store_id: null,
          })
          .eq('id', selectedMachineForTransfer.id);

        if (error) throw error;

        // Sinkronkan tabel stores jika mesin sebelumnya terpasang di toko
        if (previousStoreId) {
          await supabase
            .from('stores')
            .update({ current_machine_id: null })
            .eq('id', previousStoreId);
        }

        toast.success(`Mesin ${displayMachineCode(selectedMachineForTransfer.machine_code)} dikembalikan ke Gudang.`);
      } else {
        // Pindah ke Dropping Lain
        const targetStaff = droppingStaff.find((s) => s.id === targetDroppingId);
        if (!targetStaff) throw new Error('Dropping tujuan tidak ditemukan');

        const targetPrefix = targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name);
        const targetMachines = machines.filter((m) => m.assigned_dropping_id === targetDroppingId);

        if (targetMachines.length >= 20) {
          toast.error(`${targetStaff.full_name} sudah memegang batas maksimal 20 unit mesin.`);
          setIsSavingTransfer(false);
          return;
        }

        const existingNumbers = targetMachines
          .map((m) => m.machine_number)
          .filter((n): n is number => typeof n === 'number' && n > 0);

        // Cari nomor slot kosong berikutnya di rute dropping tujuan
        const nextNum = getNextAvailableMachineNumber(existingNumbers);
        const newMachineCode = formatMachineCode(targetPrefix, nextNum);

        const { error } = await supabase
          .from('machines')
          .update({
            assigned_dropping_id: targetDroppingId,
            machine_number: nextNum,
            machine_code: newMachineCode,
          })
          .eq('id', selectedMachineForTransfer.id);

        if (error) throw error;
        toast.success(`Mesin berhasil ditransfer ke ${targetStaff.full_name} sebagai ${newMachineCode}!`);
      }

      setIsTransferModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error('Error transferring machine:', err);
      toast.error('Gagal memindahkan mesin: ' + err.message);
    } finally {
      setIsSavingTransfer(false);
    }
  };

  // Buka Modal Tambah 1 Mesin
  const handleOpenAddMachine = () => {
    setAddDroppingId(''); // Default: Tanpa Dropping (Simpan di Gudang)
    setAddMachineNumber(''); // Dibiarkan kosong agar placeholder tampil
    setAddStoreId('');
    setIsAddMachineModalOpen(true);
  };

  // Simpan Tambah 1 Mesin
  const handleSaveAddMachine = async () => {
    if (addMachineNumber === '' || typeof addMachineNumber !== 'number' || isNaN(addMachineNumber)) {
      toast.error('Silakan masukkan nomor mesin antara 1 sampai 20.');
      return;
    }

    const targetStaff = droppingStaff.find((s) => s.id === addDroppingId);
    const prefix = targetStaff
      ? targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name)
      : 'MESIN';

    const numToSave = addMachineNumber;

    // 1. Validasi Input, Duplikasi Kode, dan Kuota 20 Unit
    const validation = validateNewMachineInput({
      machineNumber: numToSave,
      prefix,
      existingMachines: machines,
      targetDroppingId: addDroppingId || null,
      targetDroppingName: targetStaff?.full_name,
      maxUnitsPerDropping: 20,
    });

    if (!validation.isValid) {
      toast.error(validation.error || 'Input mesin tidak valid.');
      return;
    }

    const finalCode = formatMachineCode(prefix, numToSave);

    setIsSavingAdd(true);
    try {
      // 2. Insert Mesin Baru ke Database Supabase
      const { data: newMachine, error: machineErr } = await supabase
        .from('machines')
        .insert({
          branch_id: branchId,
          machine_code: finalCode,
          machine_number: numToSave,
          assigned_dropping_id: addDroppingId || null,
          current_store_id: addStoreId || null,
          status: addStoreId ? 'terpasang' : 'gudang',
          last_counter_meter: 0,
        })
        .select()
        .single();

      if (machineErr) throw machineErr;

      // 3. Sinkronisasi Dua Arah dengan Toko Mitra (stores table)
      if (addStoreId && newMachine?.id) {
        // Jika ada mesin lama yang sebelumnya terpasang di toko ini, lepaskan ke gudang
        const existingStoreMachine = machines.find((m) => m.current_store_id === addStoreId && m.id !== newMachine.id);
        if (existingStoreMachine) {
          await supabase
            .from('machines')
            .update({ current_store_id: null, status: 'gudang' })
            .eq('id', existingStoreMachine.id);
        }

        // Update stores: set current_machine_id ke mesin baru agar terbaca di DroppingView & KurirView
        const { error: storeErr } = await supabase
          .from('stores')
          .update({
            current_machine_id: newMachine.id,
            status: 'terpasang',
          })
          .eq('id', addStoreId);

        if (storeErr) {
          console.warn('Gagal sinkronisasi data toko:', storeErr);
        }
      }

      toast.success(`Mesin ${finalCode} berhasil ditambahkan!`);
      setIsAddMachineModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error('Error adding machine:', err);
      toast.error('Gagal menambah mesin: ' + err.message);
    } finally {
      setIsSavingAdd(false);
    }
  };

  // Toggle 1x / 2x Kunjungan untuk Mesin yang terpasang
  const handleToggleVisitRequirement = async (m: Machine) => {
    if (togglingMachineId) return;

    const isCurrentlyTwoVisits = m.daily_visit_target === 2 || m.notes?.includes('2x Kunjungan');
    const newTarget = isCurrentlyTwoVisits ? 1 : 2;

    // Bersihkan atau tambahkan catatan 2x Kunjungan pada notes mesin
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
        // Fallback jika kolom daily_visit_target belum dibuat di database Supabase: update notes saja
        const { error: fallbackErr } = await supabase
          .from('machines')
          .update({
            notes: updatedNotes || null,
          })
          .eq('id', m.id);

        if (fallbackErr) throw fallbackErr;
      }

      toast.success(`Mesin ${displayMachineCode(m.machine_code)} diatur ke ${newTarget}x Kunjungan`);
      await onRefresh();
    } catch (err: any) {
      console.error('Error toggling visit requirement:', err);
      toast.error('Gagal memperbarui pengaturan kunjungan: ' + err.message);
    } finally {
      setTogglingMachineId(null);
    }
  };

  // Simpan Nomor Rute Toko Langsung
  const handleSaveStoreRouteOrder = async (storeId: string) => {
    const parsedNum = parseInt(inputRouteOrder, 10);
    const newRouteOrder = isNaN(parsedNum) || parsedNum <= 0 ? null : parsedNum;

    setIsSavingRouteOrder(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ route_order: newRouteOrder })
        .eq('id', storeId);

      if (error) throw error;

      toast.success(newRouteOrder ? `Rute toko diatur ke urutan #${newRouteOrder}` : 'Nomor rute toko dihapus');
      setEditingStoreRouteId(null);
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
            <Cpu className="w-5 h-5 text-indigo-500" />
            Kelola Mesin ({totalCount}).
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola seluruh mesin untuk setiap dropping.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddMachine}
          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Navigasi Tab: Petugas Dropping vs Semua Mesin */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveSubTab('dropping')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeSubTab === 'dropping'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
        >
          Petugas Dropping ({droppingStaff.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('all_machines')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeSubTab === 'all_machines'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
        >
          Semua Mesin ({machines.length})
        </button>
      </div>

      {/* KONTEN TAB 1: DAFTAR PETUGAS DROPPING */}
      {activeSubTab === 'dropping' && (
        <div className="space-y-1 pt-1">
          {droppingStaff.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
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

                    {/* [Unit: total yang di pegang]   [tombol edit] */}
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

      {/* KONTEN TAB 2: SEMUA MESIN */}
      {activeSubTab === 'all_machines' && (
        <div className="space-y-3">
          {/* Filter Horizontal Tab & Search Mesin */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari kode mesin atau toko..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
              />
            </div>

            {/* Filter Tab Chips per Dropping */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedDroppingFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${selectedDroppingFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
              >
                Semua Mesin ({machines.length})
              </button>
              {droppingStaff.map((staff) => {
                const prefix = staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name);
                const count = machines.filter((m) => m.assigned_dropping_id === staff.id).length;
                const isSelected = selectedDroppingFilter === staff.id;

                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedDroppingFilter(staff.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                      }`}
                  >
                    <span>{staff.full_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {prefix} ({count})
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedDroppingFilter('unassigned')}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${selectedDroppingFilter === 'unassigned'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
              >
                Gudang ({machines.filter((m) => !m.assigned_dropping_id).length})
              </button>
            </div>
          </div>

          {/* Daftar Kartu Mesin */}
          <div className="space-y-2.5">
            {filteredMachines.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                Tidak ada mesin yang cocok dengan kriteria filter.
              </div>
            ) : (
              filteredMachines.map((m) => {
                const assignedStaff = droppingStaff.find((s) => s.id === m.assigned_dropping_id);
                const isInstalled = m.status === 'terpasang' && m.current_store_id;

                return (
                  <div
                    key={m.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-2.5 transition"
                  >
                    {/* Baris 1: Kode Mesin [PAMPAM-01] & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 tracking-wider">
                          {displayMachineCode(m.machine_code)}
                        </span>
                        {typeof m.machine_number === 'number' && (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            No. #{String(m.machine_number).padStart(2, '0')}
                          </span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isInstalled
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                      >
                        {isInstalled ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Terpasang
                          </>
                        ) : (
                          <>
                            <Warehouse className="w-3 h-3 text-slate-400" />
                            Gudang
                          </>
                        )}
                      </span>
                    </div>

                    {/* Baris 2: Toko Mitra & Odometer */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Lokasi Toko:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                          {m.store?.name || 'Di Gudang Cabang'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Meter Fisik Terakhir:</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white block mt-0.5">
                          {(m.last_counter_meter || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Baris 3: Pemegang Dropping & Tombol Pindah */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-400 font-medium">Dropping:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {assignedStaff?.full_name || 'Belum Ditugaskan'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenTransferModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Tukar / Pindah</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SETTING PREFIX KODE MESIN DROPPING                               */}
      {/* ========================================================================= */}
      {isPrefixModalOpen && selectedStaffForPrefix && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Atur Prefix Kode Dropping
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Untuk {selectedStaffForPrefix.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPrefixModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama pada setiap Kode Mesin.
                </label>
                <input
                  type="text"
                  placeholder="Masukkan prefix..."
                  value={inputPrefix}
                  onChange={(e) => setInputPrefix(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                />
              </div>

              {/* Live Preview Format Kode Mesin (HANYA 1 CONTOH, TANPA KURUNG SIKU) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                  Contoh Kode Mesin:
                </span>
                <span className="font-mono font-black text-base text-indigo-600 dark:text-indigo-400 block tracking-wider">
                  {formatMachineCode(inputPrefix, 1)}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Mengubah prefix ini otomatis memperbarui seluruh kode mesin staf ini.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPrefixModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePrefix}
                disabled={isSavingPrefix}
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingPrefix ? 'Menyimpan...' : 'Simpan Prefix'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: TRANSFER / TUKAR DROPPING PEMEGANG MESIN                        */}
      {/* ========================================================================= */}
      {isTransferModalOpen && selectedMachineForTransfer && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Tukar / Pindahkan Mesin
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unit saat ini: <strong className="font-mono text-slate-900 dark:text-white">{displayMachineCode(selectedMachineForTransfer.machine_code)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pindahkan ke Personil Dropping:
                </label>
                <select
                  value={targetDroppingId}
                  onChange={(e) => setTargetDroppingId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                >
                  <option value="">-- Kembalikan ke Gudang (Tanpa Dropping) --</option>
                  {droppingStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} (Prefix: {staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Hasil Pindah */}
              {targetDroppingId ? (
                (() => {
                  const targetStaff = droppingStaff.find((s) => s.id === targetDroppingId);
                  const prefix = targetStaff?.machine_prefix || sanitizeMachinePrefix(targetStaff?.username || targetStaff?.full_name);
                  const targetMachines = machines.filter((m) => m.assigned_dropping_id === targetDroppingId);
                  const nextNum = getNextAvailableMachineNumber(targetMachines.map((m) => m.machine_number || 0));

                  return (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                        Hasil Kode Mesin Baru:
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-900 dark:text-emerald-200 block">
                        {formatMachineCode(prefix, nextNum)}
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Mesin akan otomatis menempati slot nomor kosong pada rute {targetStaff?.full_name}.
                      </p>
                    </div>
                  );
                })()
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs">
                  Mesin akan dilepas dari penugasan dropping dan disimpan sebagai stok gudang cabang.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTransfer}
                disabled={isSavingTransfer}
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingTransfer ? 'Menyimpan...' : 'Simpan Mutasi'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TAMBAH 1 UNIT MESIN MANUAL                                       */}
      {/* ========================================================================= */}
      {isAddMachineModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Tambah Unit Mesin
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Registrasi nomor mesin dengan format standar
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMachineModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dropping Pemegang:
                </label>
                <select
                  value={addDroppingId}
                  onChange={(e) => setAddDroppingId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                >
                  <option value="">-- Simpan di Gudang (Tanpa Dropping) --</option>
                  {droppingStaff.map((staff) => {
                    const heldCount = machines.filter((m) => m.assigned_dropping_id === staff.id).length;
                    const prefix = staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name);
                    const isFull = heldCount >= 20;
                    return (
                      <option key={staff.id} value={staff.id} disabled={isFull}>
                        {staff.full_name} ({prefix} • {heldCount}/20 Unit{isFull ? ' - PENUH' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Mesin (01 - 20):
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Ketik nomor (1 - 20)..."
                  value={addMachineNumber}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setAddMachineNumber('');
                      return;
                    }
                    const val = parseInt(raw, 10);
                    if (!isNaN(val)) {
                      setAddMachineNumber(val);
                    }
                  }}
                  onBlur={() => {
                    if (typeof addMachineNumber === 'number') {
                      if (addMachineNumber < 1) setAddMachineNumber(1);
                      else if (addMachineNumber > 20) setAddMachineNumber(20);
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                />
              </div>

              {/* Preview Hasil Kode (BERSIH TANPA KURUNG SIKU) */}
              {(() => {
                const targetStaff = droppingStaff.find((s) => s.id === addDroppingId);
                const prefix = targetStaff
                  ? targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name)
                  : 'MESIN';
                const hasNum = typeof addMachineNumber === 'number' && !isNaN(addMachineNumber);
                const code = hasNum ? formatMachineCode(prefix, addMachineNumber) : `${prefix}-..`;
                const isExisting = hasNum && machines.some(
                  (m) => displayMachineCode(m.machine_code).toUpperCase() === code.toUpperCase()
                );

                return (
                  <div className={`p-3 rounded-xl border ${isExisting
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80'
                    }`}>
                    <span className={`text-[10px] uppercase font-bold block ${isExisting ? 'text-rose-700 dark:text-rose-400' : 'text-indigo-700 dark:text-indigo-400'
                      }`}>
                      {isExisting ? 'Kode Mesin Sudah Terpakai:' : 'Kode Mesin yang Dibuat:'}
                    </span>
                    <span className={`font-mono font-black text-base block mt-0.5 ${isExisting ? 'text-rose-900 dark:text-rose-200' : 'text-indigo-900 dark:text-indigo-200'
                      }`}>
                      {code}
                    </span>
                    {isExisting && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 font-medium">
                        Nomor ini sudah ada di cabang. Pilih nomor lain antara 01 - 20.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pasang Langsung ke Toko Mitra (Opsional):
                </label>
                <select
                  value={addStoreId}
                  onChange={(e) => setAddStoreId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                >
                  <option value="">-- Belum Dipasang (Simpan Gudang) --</option>
                  {stores.map((s) => {
                    const occupiedMachine = machines.find((m) => m.current_store_id === s.id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} {occupiedMachine ? `(Saat ini: ${displayMachineCode(occupiedMachine.machine_code)})` : '(Belum ada mesin)'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddMachineModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAddMachine}
                disabled={isSavingAdd}
                className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingAdd ? 'Menyimpan...' : 'Simpan Mesin'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DETAIL FULL SCREEN PETUGAS DROPPING & LIST KODE MESIN            */}
      {/* ========================================================================= */}
      {selectedDroppingForDetail && (() => {
        const activeStaff = droppingStaff.find((s) => s.id === selectedDroppingForDetail.id) || selectedDroppingForDetail;
        const prefix = activeStaff.machine_prefix || sanitizeMachinePrefix(activeStaff.username || activeStaff.full_name);
        const assignedMachines = machines
          .filter((m) => m.assigned_dropping_id === activeStaff.id)
          .sort((a, b) => {
            const numA = a.machine_number ?? 999;
            const numB = b.machine_number ?? 999;
            if (numA !== numB) return numA - numB;
            return a.machine_code.localeCompare(b.machine_code);
          });

        return createPortal(
          <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Header Fixed At Top */}
            <div className="sticky top-0 z-10 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="min-w-0 pr-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Detail Petugas Dropping
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                  {activeStaff.full_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDroppingForDetail(null)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer shrink-0"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Card Prefix & Tombol Edit Prefix */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                      Prefix Kode Mesin
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-black text-lg text-indigo-600 dark:text-indigo-400">
                        {prefix}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenPrefixModal(activeStaff)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-center transition active:scale-90 cursor-pointer shadow-2xs"
                        title="Edit Prefix"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
                      Total Dipegang
                    </span>
                    <span className="font-mono font-black text-base text-slate-900 dark:text-white block mt-0.5">
                      {assignedMachines.length} <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Unit</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Section: List Kode Mesin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Daftar Kode Mesin ({assignedMachines.length})
                  </h4>
                </div>

                {assignedMachines.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <Cpu className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Belum ada mesin yang dipegang
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Petugas ini belum ditugaskan mesin apapun di cabang ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedMachines.map((m) => {
                      const isInstalled = !!m.current_store_id;
                      const storeObj = stores.find((s) => s.id === m.current_store_id);
                      const storeName = m.store?.name || storeObj?.name;
                      const routeOrder = storeObj?.route_order;
                      const isEditingRoute = editingStoreRouteId === m.current_store_id;

                      return (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-900 dark:text-white tracking-wide">
                                {displayMachineCode(m.machine_code)}
                              </span>
                              {isInstalled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (m.current_store_id) {
                                      setEditingStoreRouteId(m.current_store_id);
                                      setInputRouteOrder(routeOrder ? String(routeOrder) : '');
                                    }
                                  }}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-mono hover:bg-indigo-100 transition cursor-pointer"
                                  title="Klik untuk ubah urutan rute"
                                >
                                  {routeOrder ? `Rute #${routeOrder}` : '+ Set Rute'}
                                </button>
                              )}
                            </div>

                            <div className="text-xs">
                              {isInstalled ? (
                                <div className="text-slate-600 dark:text-slate-300 truncate">
                                  Toko Mitra: <strong className="font-bold text-slate-900 dark:text-white">{storeName || 'Toko Mitra'}</strong>
                                </div>
                              ) : (
                                <div className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                                  Tersimpan di gudang (belum dipasang ke toko)
                                </div>
                              )}
                            </div>

                            {/* Quick Inline Edit Rute */}
                            {isEditingRoute && m.current_store_id && (
                              <div className="pt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Urutan Rute:</span>
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
                            )}
                          </div>

                          {isInstalled && (
                            <div className="shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleVisitRequirement(m)}
                                disabled={togglingMachineId === m.id}
                                title="Klik untuk mengubah jumlah kunjungan"
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
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};
