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
} from 'lucide-react';
import type { Machine, UserProfile, Store } from '../../../types';
import {
  formatMachineCode,
  displayMachineCode,
  sanitizeMachinePrefix,
  getNextAvailableMachineNumber,
  recodeMachinesForDropping,
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
  const [addMachineNumber, setAddMachineNumber] = useState<number>(1);
  const [addStoreId, setAddStoreId] = useState<string>('');
  const [isSavingAdd, setIsSavingAdd] = useState(false);

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
  const installedCount = machines.filter((m) => m.status === 'terpasang').length;
  const warehouseCount = machines.filter((m) => m.status === 'gudang' || !m.assigned_dropping_id).length;

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
        // Pindah ke Gudang (lepas assignment)
        const { error } = await supabase
          .from('machines')
          .update({
            assigned_dropping_id: null,
            status: 'gudang',
            current_store_id: null,
          })
          .eq('id', selectedMachineForTransfer.id);

        if (error) throw error;
        toast.success(`Mesin ${selectedMachineForTransfer.machine_code} dikembalikan ke Gudang.`);
      } else {
        // Pindah ke Dropping Lain
        const targetStaff = droppingStaff.find((s) => s.id === targetDroppingId);
        if (!targetStaff) throw new Error('Dropping tujuan tidak ditemukan');

        const targetPrefix = targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name);
        const targetMachines = machines.filter((m) => m.assigned_dropping_id === targetDroppingId);
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
        toast.success(`Mesin berhasil ditransfer ke ${targetStaff.full_name} sebagai [${newMachineCode}]!`);
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
    const defaultStaff = droppingStaff[0];
    const staffId = defaultStaff?.id || '';
    setAddDroppingId(staffId);
    if (staffId) {
      const existing = machines.filter((m) => m.assigned_dropping_id === staffId);
      const nextNum = getNextAvailableMachineNumber(existing.map((m) => m.machine_number || 0));
      setAddMachineNumber(nextNum);
    } else {
      setAddMachineNumber(1);
    }
    setAddStoreId('');
    setIsAddMachineModalOpen(true);
  };

  // Simpan Tambah 1 Mesin
  const handleSaveAddMachine = async () => {
    const targetStaff = droppingStaff.find((s) => s.id === addDroppingId);
    const prefix = targetStaff
      ? targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name)
      : 'MESIN';
    const finalCode = formatMachineCode(prefix, addMachineNumber);

    setIsSavingAdd(true);
    try {
      const { error } = await supabase.from('machines').insert({
        branch_id: branchId,
        machine_code: finalCode,
        machine_number: addMachineNumber,
        assigned_dropping_id: addDroppingId || null,
        current_store_id: addStoreId || null,
        status: addStoreId ? 'terpasang' : 'gudang',
        last_counter_meter: 0,
      });

      if (error) throw error;
      toast.success(`Mesin [${finalCode}] berhasil ditambahkan!`);
      setIsAddMachineModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error('Error adding machine:', err);
      toast.error('Gagal menambah mesin: ' + err.message);
    } finally {
      setIsSavingAdd(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-8">
      {/* Header & Subtitle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            Kelola Mesin.
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Format nomor mesin untuk setiap dropping.
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

      {/* Ringkasan Status Unit Cabang */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Total Unit
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block font-mono">
            {totalCount}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Terpasang
          </span>
          <span className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5 block font-mono">
            {installedCount}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
            Di Gudang
          </span>
          <span className="text-xl font-black text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
            {warehouseCount}
          </span>
        </div>
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
                        Unit: <strong className="text-slate-800 dark:text-slate-200 font-bold">{staffMachines.length} yang di pegang</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleOpenPrefixModal(staff)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                        title="Edit Prefix Dropping"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                        {formatMachineCode(prefix, nextNum)} (Slot #{String(nextNum).padStart(2, '0')})
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
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
                  onChange={(e) => {
                    const sId = e.target.value;
                    setAddDroppingId(sId);
                    if (sId) {
                      const existing = machines.filter((m) => m.assigned_dropping_id === sId);
                      setAddMachineNumber(getNextAvailableMachineNumber(existing.map((m) => m.machine_number || 0)));
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                >
                  <option value="">-- Simpan di Gudang (Tanpa Dropping) --</option>
                  {droppingStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.machine_prefix || sanitizeMachinePrefix(staff.username || staff.full_name)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nomor Mesin (1 - 20):
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={addMachineNumber}
                  onChange={(e) => setAddMachineNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none focus:outline-none focus:ring-0 focus:border-slate-800 dark:focus:border-slate-300 transition-colors"
                />
              </div>

              {/* Preview Hasil Kode (BERSIH TANPA KURUNG SIKU) */}
              {(() => {
                const targetStaff = droppingStaff.find((s) => s.id === addDroppingId);
                const prefix = targetStaff
                  ? targetStaff.machine_prefix || sanitizeMachinePrefix(targetStaff.username || targetStaff.full_name)
                  : 'MESIN';
                const code = formatMachineCode(prefix, addMachineNumber);

                return (
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">
                      Kode Mesin yang Dibuat:
                    </span>
                    <span className="font-mono font-black text-base text-indigo-900 dark:text-indigo-200 block mt-0.5">
                      {code}
                    </span>
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
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address})
                    </option>
                  ))}
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
    </div>
  );
};
