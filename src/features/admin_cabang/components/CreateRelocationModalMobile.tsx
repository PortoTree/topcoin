import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { BottomSheetModal } from '../../../components/BottomSheetModal';
import confetti from 'canvas-confetti';
import type { Store, Machine, UserProfile } from '../../../types';
import {
  Truck,
  Users,
  X,
  Search,
  Check,
  Plus,
  Trash2,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  MapPin,
} from 'lucide-react';

interface RelocationItem {
  id: string;
  originStoreId: string;
  originStoreName: string;
  originStoreAddress: string;
  machineId: string;
  machineCode: string;
  targetStoreId: string;
  targetStoreName: string;
  targetStoreAddress: string;
}

interface CreateRelocationModalMobileProps {
  branchId: string;
  branchName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRelocationModalMobile: React.FC<CreateRelocationModalMobileProps> = ({
  branchId,
  branchName,
  onClose,
  onSuccess,
}) => {
  const { profile, updateStaffRole } = useAuth();

  // Data State
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [branchStaff, setBranchStaff] = useState<UserProfile[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Form State
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [relocationItems, setRelocationItems] = useState<RelocationItem[]>([
    {
      id: 'reloc-' + Date.now(),
      originStoreId: '',
      originStoreName: '',
      originStoreAddress: '',
      machineId: '',
      machineCode: '',
      targetStoreId: '',
      targetStoreName: '',
      targetStoreAddress: '',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sub-Picker Modals
  const [showStaffPicker, setShowStaffPicker] = useState<boolean>(false);
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [storePicker, setStorePicker] = useState<{
    type: 'origin' | 'target';
    itemIndex: number;
  } | null>(null);
  const [storeSearch, setStoreSearch] = useState<string>('');

  // Fetch branch data
  const fetchData = useCallback(async () => {
    if (!branchId) return;
    setIsLoadingData(true);
    try {
      const [storesRes, machinesRes, staffRes] = await Promise.all([
        supabase
          .from('stores')
          .select('*, machine:machines!stores_current_machine_id_fkey(id, machine_code)')
          .eq('branch_id', branchId)
          .order('name'),
        supabase
          .from('machines')
          .select('*')
          .eq('branch_id', branchId)
          .order('machine_code'),
        supabase
          .from('profiles')
          .select('*')
          .eq('branch_id', branchId)
          .order('full_name'),
      ]);

      if (storesRes.data) setStores(storesRes.data as Store[]);
      if (machinesRes.data) setMachines(machinesRes.data as Machine[]);
      if (staffRes.data) setBranchStaff(staffRes.data as UserProfile[]);
    } catch (err) {
      console.error('Error fetching data for relocation modal:', err);
      toast.error('Gagal memuat data toko & petugas cabang.');
    } finally {
      setIsLoadingData(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Operational staff filter
  const assignableStaffList = useMemo(() => {
    return branchStaff.filter(
      (s) => s.role !== 'owner' && s.role !== 'branch_manager'
    );
  }, [branchStaff]);

  const filteredStaffList = useMemo(() => {
    if (!staffSearch.trim()) return assignableStaffList;
    const q = staffSearch.toLowerCase();
    return assignableStaffList.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
    );
  }, [assignableStaffList, staffSearch]);

  // Options for machine origin
  const originMachineOptions = useMemo(() => {
    const list: {
      storeId: string;
      storeName: string;
      storeAddress?: string;
      machineId: string;
      machineCode: string;
    }[] = [];

    const addedStoreIds = new Set<string>();

    stores.forEach((st) => {
      const mach =
        machines.find((m) => m.id === st.current_machine_id || m.current_store_id === st.id) ||
        st.machine;
      if (mach) {
        addedStoreIds.add(st.id);
        list.push({
          storeId: st.id,
          storeName: st.name,
          storeAddress: st.address,
          machineId: (mach as any).id || st.current_machine_id || '',
          machineCode: (mach as any).machine_code || 'MSN-UNKNOWN',
        });
      }
    });

    stores.forEach((st) => {
      if (!addedStoreIds.has(st.id)) {
        list.push({
          storeId: st.id,
          storeName: st.name,
          storeAddress: st.address,
          machineId: '',
          machineCode: '(Tanpa Unit Khusus)',
        });
      }
    });

    return list;
  }, [stores, machines]);

  const filteredOriginList = useMemo(() => {
    if (!storeSearch.trim()) return originMachineOptions;
    const q = storeSearch.toLowerCase();
    return originMachineOptions.filter(
      (item) =>
        item.storeName.toLowerCase().includes(q) ||
        item.machineCode.toLowerCase().includes(q) ||
        (item.storeAddress && item.storeAddress.toLowerCase().includes(q))
    );
  }, [originMachineOptions, storeSearch]);

  const filteredTargetList = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(
      (st) =>
        st.name.toLowerCase().includes(q) ||
        (st.address && st.address.toLowerCase().includes(q))
    );
  }, [stores, storeSearch]);

  const toggleOfficerSelection = (officerId: string) => {
    setSelectedOfficerIds((prev) =>
      prev.includes(officerId) ? prev.filter((id) => id !== officerId) : [...prev, officerId]
    );
  };

  const handleAddRelocationItem = () => {
    setRelocationItems((prev) => [
      ...prev,
      {
        id: 'reloc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        originStoreId: '',
        originStoreName: '',
        originStoreAddress: '',
        machineId: '',
        machineCode: '',
        targetStoreId: '',
        targetStoreName: '',
        targetStoreAddress: '',
      },
    ]);
  };

  const handleRemoveRelocationItem = (index: number) => {
    if (relocationItems.length <= 1) {
      toast.warning('Minimal harus ada 1 unit relokasi mesin.');
      return;
    }
    setRelocationItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectOrigin = (
    storeId: string,
    storeName: string,
    storeAddress: string,
    machineId: string,
    machineCode: string,
    itemIndex: number
  ) => {
    setRelocationItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          originStoreId: storeId,
          originStoreName: storeName,
          originStoreAddress: storeAddress,
          machineId: machineId,
          machineCode: machineCode,
        };
      })
    );
    setStorePicker(null);
    setStoreSearch('');
  };

  const handleSelectTarget = (
    storeId: string,
    storeName: string,
    storeAddress: string,
    itemIndex: number
  ) => {
    setRelocationItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== itemIndex) return item;
        return {
          ...item,
          targetStoreId: storeId,
          targetStoreName: storeName,
          targetStoreAddress: storeAddress,
        };
      })
    );
    setStorePicker(null);
    setStoreSearch('');
  };

  // Submit Tasks
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isSubmitting) return;

    if (selectedOfficerIds.length === 0) {
      toast.warning('Pilih minimal 1 petugas logistik yang akan ditugaskan.');
      return;
    }

    const incomplete = relocationItems.some((item) => !item.originStoreId || !item.targetStoreId);
    if (incomplete) {
      toast.warning('Lengkapi lokasi asal (pindah dari) dan tujuan (dipindah ke) untuk semua unit relokasi.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Assign role 'logistik' jika belum logistik
      const switchedStaffNames: { name: string; oldRole: string }[] = [];
      for (const officerId of selectedOfficerIds) {
        const staff = branchStaff.find((s) => s.id === officerId);
        if (staff) {
          const isAlreadyLogistik =
            staff.role === 'logistik' ||
            staff.role === 'driver' ||
            (staff.role === 'admin_cabang' && staff.assigned_task === 'logistik');
          if (!isAlreadyLogistik) {
            switchedStaffNames.push({
              name: staff.full_name,
              oldRole: (staff.role === 'admin_cabang' ? staff.assigned_task : staff.role)?.toUpperCase() || 'MARKETING',
            });
            if (staff.role === 'admin_cabang' || staff.role === 'admin') {
              await updateStaffRole(officerId, 'admin_cabang', 'logistik');
            } else {
              await updateStaffRole(officerId, 'logistik', null);
            }
          }
        }
      }

      // Names of team members
      const teamNames = branchStaff
        .filter((s) => selectedOfficerIds.includes(s.id))
        .map((s) => s.full_name);

      const teamTag = `[Tim Logistik: ${teamNames.join(', ')}]`;

      const payloads: any[] = [];
      for (const item of relocationItems) {
        payloads.push({
          branch_id: branchId,
          task_type: 'relokasi_mesin',
          driver_id: selectedOfficerIds[0],
          officer_ids: selectedOfficerIds,
          assigned_by: profile.id,
          store_id: item.originStoreId,
          target_store_id: item.targetStoreId,
          machine_id: item.machineId || null,
          coin_amount: 0,
          status: 'assigned',
          notes: teamTag,
        });
      }

      const { error } = await supabase.from('driver_tasks').insert(payloads);
      if (error) throw error;

      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {
        // ignore
      }

      toast.success(`Tugas relokasi (${relocationItems.length} unit mesin) berhasil dibuat!`);

      if (switchedStaffNames.length > 0) {
        switchedStaffNames.forEach((item) => {
          toast.info(`Peran "${item.name}" otomatis dialihkan dari ${item.oldRole} menjadi LOGISTIK.`);
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Dispatch error:', err);
      toast.error(err.message || 'Gagal menerbitkan tugas relokasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <BottomSheetModal item={true} onClose={onClose}>
        {(_, close) => (
          <form onSubmit={handleDispatch} className="space-y-4">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Relokasi Mesin
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Jadwalkan pemindahan mesin di {branchName || 'Cabang'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={isLoadingData}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer active:scale-90"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Pilih Petugas Logistik */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Pilih Petugas Logistik <span className="text-rose-500">*</span>
              </label>

              {selectedOfficerIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {selectedOfficerIds.map((id) => {
                    const staff = branchStaff.find((s) => s.id === id);
                    if (!staff) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xs animate-in zoom-in-95"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">
                          {staff.full_name.charAt(0)}
                        </span>
                        <span>{staff.full_name}</span>
                        <button
                          type="button"
                          onClick={() => toggleOfficerSelection(id)}
                          className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/80 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Belum ada staf logistik dipilih. Klik tombol di bawah untuk memilih tim.</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowStaffPicker(true);
                  setStaffSearch('');
                }}
                className="w-full py-3 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 shadow-2xs"
              >
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  {selectedOfficerIds.length > 0
                    ? `Ubah / Tambah Petugas (${selectedOfficerIds.length} Terpilih)`
                    : 'Pilih Petugas'}
                </span>
              </button>
            </div>

            {/* 2. Pilih Rute Relokasi */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Pilih Rute Relokasi
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {relocationItems.length} Unit Mesin
                </span>
              </div>

              {/* List Kartu Rute */}
              <div className="space-y-3">
                {relocationItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-2 relative"
                  >
                    {relocationItems.length > 1 && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                          Unit #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRelocationItem(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
                      {/* Box Pindah Dari */}
                      <div
                        onClick={() => {
                          setStorePicker({ type: 'origin', itemIndex: idx });
                          setStoreSearch('');
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition active:scale-98 ${
                          item.originStoreId
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 block tracking-wider mb-1">
                          Pindah Dari
                        </span>
                        {item.originStoreId ? (
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {item.originStoreName}
                            </span>
                            {item.machineCode && item.machineCode !== '(Tanpa Unit Khusus)' && (
                              <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold block truncate">
                                {item.machineCode}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                            <Search className="w-3 h-3" /> Pilih toko &amp; mesin...
                          </span>
                        )}
                      </div>

                      {/* Panah Tengah */}
                      <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>

                      {/* Box Dipindah Ke */}
                      <div
                        onClick={() => {
                          setStorePicker({ type: 'target', itemIndex: idx });
                          setStoreSearch('');
                        }}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition active:scale-98 ${
                          item.targetStoreId
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 block tracking-wider mb-1">
                          Dipindah Ke
                        </span>
                        {item.targetStoreId ? (
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {item.targetStoreName}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                              {item.targetStoreAddress || 'Alamat toko'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
                            <Search className="w-3 h-3" /> Pilih toko tujuan...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tombol Tambah Rute Lain */}
              <button
                type="button"
                onClick={handleAddRelocationItem}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700/80 bg-indigo-50/30 dark:bg-indigo-950/10 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition cursor-pointer active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah rute lain</span>
              </button>
            </div>

            {/* Tombol Aksi Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || selectedOfficerIds.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-98 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menerbitkan Tugas...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Kirim ke petugas logistik</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </BottomSheetModal>

      {/* SUB-MODAL 1: PICKER PETUGAS */}
      {showStaffPicker && (
        <BottomSheetModal item={true} onClose={() => setShowStaffPicker(false)}>
          {(_, close) => (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Pilih Petugas Logistik
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bisa memilih lebih dari 1 staf untuk penugasan tim
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Searchbox */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Cari nama atau username staf..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Staff List */}
              <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5">
                {filteredStaffList.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Tidak ditemukan staf dengan kata kunci &quot;{staffSearch}&quot;.
                  </p>
                ) : (
                  filteredStaffList.map((st) => {
                    const isSelected = selectedOfficerIds.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleOfficerSelection(st.id)}
                        className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between active:scale-98 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                            {st.full_name.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                              {st.full_name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                              @{st.username} • {st.role.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={close}
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md cursor-pointer active:scale-98"
              >
                Selesai Memilih ({selectedOfficerIds.length} Terpilih)
              </button>
            </div>
          )}
        </BottomSheetModal>
      )}

      {/* SUB-MODAL 2: PICKER TOKO (ORIGIN ATAU TARGET) */}
      {storePicker && (
        <BottomSheetModal item={storePicker} onClose={() => setStorePicker(null)}>
          {(_, close) => {
            const isOrigin = storePicker.type === 'origin';
            const currentItem = relocationItems[storePicker.itemIndex];

            return (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {isOrigin ? 'Pilih Toko & Mesin Asal' : 'Pilih Toko Tujuan Relokasi'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isOrigin
                        ? 'Pilih unit mesin beserta toko asalnya yang akan ditarik/dipindah'
                        : 'Pilih lokasi toko mitra penerima penempatan mesin'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Searchbox */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder={
                      isOrigin ? 'Cari toko atau kode mesin...' : 'Cari nama toko tujuan...'
                    }
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* List Toko */}
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-0.5">
                  {isOrigin ? (
                    filteredOriginList.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Tidak ditemukan toko atau mesin dengan kata kunci &quot;{storeSearch}&quot;.
                      </p>
                    ) : (
                      filteredOriginList.map((item, idx) => {
                        const isSelected =
                          currentItem?.originStoreId === item.storeId &&
                          currentItem?.machineId === item.machineId;

                        return (
                          <button
                            key={`${item.storeId}-${item.machineId}-${idx}`}
                            type="button"
                            onClick={() =>
                              handleSelectOrigin(
                                item.storeId,
                                item.storeName,
                                item.storeAddress || '',
                                item.machineId,
                                item.machineCode,
                                storePicker.itemIndex
                              )
                            }
                            className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between active:scale-98 ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {item.machineCode && item.machineCode !== '(Tanpa Unit Khusus)' ? (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                    {item.machineCode}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Tanpa Mesin
                                  </span>
                                )}
                                <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                  {item.storeName}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                {item.storeAddress || 'Alamat belum diinput'}
                              </p>
                            </div>

                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </button>
                        );
                      })
                    )
                  ) : filteredTargetList.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Tidak ditemukan toko tujuan dengan kata kunci &quot;{storeSearch}&quot;.
                    </p>
                  ) : (
                    filteredTargetList.map((st) => {
                      const isSelected = currentItem?.targetStoreId === st.id;

                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() =>
                            handleSelectTarget(st.id, st.name, st.address || '', storePicker.itemIndex)
                          }
                          className={`w-full p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between active:scale-98 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate mb-0.5">
                              {st.name}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              {st.address || 'Alamat belum diinput'}
                            </p>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          }}
        </BottomSheetModal>
      )}
    </>
  );
};
