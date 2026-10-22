import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { toast } from '../../context/ToastContext';
import confetti from 'canvas-confetti';
import {
  Truck,
  Plus,
  Trash2,
  ArrowRight,
  Search,
  Check,
  X,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
} from 'lucide-react';
import type { UserProfile, Store, Machine, DriverTask, UserRole } from '../../types';

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

interface LogisticsDispatchViewProps {
  branchId?: string;
  branchName?: string;
}

export const LogisticsDispatchView: React.FC<LogisticsDispatchViewProps> = ({
  branchId: propBranchId,
  branchName: propBranchName,
}) => {
  const { profile, updateStaffRole } = useAuth();
  const { currentBranch, availableBranches } = useBranch();

  const activeBranchId =
    propBranchId || currentBranch?.id || profile?.branch_id || availableBranches[0]?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const activeBranchName = propBranchName || currentBranch?.name || 'Cabang Aktif';

  const [branchStaff, setBranchStaff] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [driverTasks, setDriverTasks] = useState<DriverTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);

  // Picker Modal State (Store/Machine)
  const [pickerModal, setPickerModal] = useState<{
    type: 'origin' | 'target';
    itemIndex: number;
  } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Staff Picker Modal State
  const [showStaffPickerModal, setShowStaffPickerModal] = useState(false);
  const [staffPickerSearch, setStaffPickerSearch] = useState('');

  // Fetch branch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Staff in branch
      const { data: sData } = await supabase
        .from('profiles')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('full_name', { ascending: true });

      if (sData) setBranchStaff(sData as UserProfile[]);

      // 2. Stores in branch
      const { data: stData } = await supabase
        .from('stores')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('name', { ascending: true });

      if (stData) setStores(stData as Store[]);

      // 3. Machines in branch
      const { data: mData } = await supabase
        .from('machines')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('machine_code', { ascending: true });

      if (mData) setMachines(mData as Machine[]);

      // 4. Tasks in branch (Fix PGRST201 ambiguity with !store_id)
      const { data: tData, error: tErr } = await supabase
        .from('driver_tasks')
        .select(`
          *,
          store:stores!store_id(name, address),
          target_store:stores!target_store_id(name, address),
          machine:machines(machine_code),
          driver:profiles!driver_id(full_name, username)
        `)
        .eq('branch_id', activeBranchId)
        .order('created_at', { ascending: false });

      if (!tErr && tData) {
        setDriverTasks(tData as DriverTask[]);
      } else if (tErr) {
        console.warn('driver_tasks query error:', tErr);
      }
    } catch (err) {
      console.error('Error fetching logistics dispatch data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();

    // Realtime listener on driver_tasks
    const channel = supabase
      .channel(`logistics_dispatch_realtime_${activeBranchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_tasks' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, activeBranchId]);

  // Operational staff list available for assignment to logistik
  const assignableStaffList = useMemo(() => {
    return branchStaff.filter(
      (s) => s.role !== 'owner' && s.role !== 'branch_manager'
    );
  }, [branchStaff]);

  // List of machine/store origins
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

  // Multi-officer toggle
  const toggleOfficerSelection = (officerId: string) => {
    setSelectedOfficerIds((prev) =>
      prev.includes(officerId) ? prev.filter((id) => id !== officerId) : [...prev, officerId]
    );
  };

  // Add / Remove Relocation Item
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

  // Origin Select
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
    setPickerModal(null);
    setPickerSearch('');
  };

  // Target Select
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
    setPickerModal(null);
    setPickerSearch('');
  };

  // Dispatch Tasks
  const handleDispatchTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isDispatching) return;

    if (selectedOfficerIds.length === 0) {
      toast.warning('Pilih minimal 1 petugas logistik yang akan ditugaskan.');
      return;
    }

    const incomplete = relocationItems.some((item) => !item.originStoreId || !item.targetStoreId);
    if (incomplete) {
      toast.warning('Lengkapi lokasi asal (pindah dari) dan tujuan (dipindah ke) untuk semua unit relokasi.');
      return;
    }

    setIsDispatching(true);
    setDispatchSuccess(null);
    try {
      // 1. Assign role 'logistik' to all selected officers who don't have it yet (e.g. from marketing/dropping)
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

      // Update state branchStaff lokal agar badge role langsung ter-update di layar Admin/BM
      setBranchStaff((prev) =>
        prev.map((s) => {
          if (!selectedOfficerIds.includes(s.id)) return s;
          if (s.role === 'admin_cabang' || s.role === 'admin') {
            return { ...s, assigned_task: 'logistik' };
          }
          return { ...s, role: 'logistik', assigned_task: null };
        })
      );

      // Names of team members for logistik team tagging
      const teamNames = branchStaff
        .filter((s) => selectedOfficerIds.includes(s.id))
        .map((s) => s.full_name);

      const teamTag = `[Tim Logistik: ${teamNames.join(', ')}]`;

      const payloads: any[] = [];
      for (const item of relocationItems) {
        payloads.push({
          branch_id: activeBranchId,
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
      if (error) {
        console.error('DB dispatch task error:', error);
        throw error;
      }

      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {
        // ignore
      }

      const successMessage = `Tugas relokasi (${relocationItems.length} unit mesin) berhasil diterbitkan untuk tim (${selectedOfficerIds.length} petugas)!`;
      setDispatchSuccess(successMessage);
      toast.success(successMessage);

      // Notifikasi feedback auto-switch role jika ada petugas yang berganti peran
      if (switchedStaffNames.length > 0) {
        switchedStaffNames.forEach((item) => {
          toast.info(
            `Peran "${item.name}" otomatis dialihkan dari ${item.oldRole} menjadi LOGISTIK.`
          );
        });
      }

      // Refresh data dari database
      fetchData();

      setRelocationItems([
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
      fetchData();
    } catch (err: any) {
      console.error('Dispatch error:', err);
      toast.error(err.message || 'Gagal membuat tugas logistik.');
    } finally {
      setIsDispatching(false);
    }
  };

  const getStaffBadge = (staff: UserProfile) => {
    if (staff.role === 'logistik' || staff.role === 'driver' || staff.role === 'kurir') {
      return {
        label: 'Logistik',
        className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      };
    }
    if (staff.role === 'admin_cabang' || staff.role === 'admin') {
      return {
        label: 'Admin Cabang',
        className: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
      };
    }
    if (staff.role === 'dropping') {
      return {
        label: 'Dropping',
        className: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      };
    }
    if (staff.role === 'marketing' || staff.role === 'sales') {
      return {
        label: 'Marketing',
        className: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      };
    }
    return {
      label: staff.role,
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    };
  };

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            Relokasi Mesin
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Jadwalkan pemindahan mesin di {activeBranchName}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={isLoading}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer active:scale-95"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {dispatchSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{dispatchSuccess}</span>
        </div>
      )}

      <form onSubmit={handleDispatchTask} className="space-y-5">
        {/* 1. Pilih Petugas Logistik */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Pilih Petugas Logistik *
          </label>

          {/* Selected Staff Tags */}
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
              setShowStaffPickerModal(true);
              setStaffPickerSearch('');
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

        {/* Form Tugas Relokasi Mesin */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Pilih Rute Relokasi
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {relocationItems.length} Unit Mesin
            </span>
          </div>

          {/* Daftar Kartu Rute Relokasi */}
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
                      className="text-rose-500 hover:text-rose-600 text-[11px] font-bold flex items-center gap-1 p-0.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2.5 sm:gap-3">
                  {/* Left: PINDAH DARI */}
                  <button
                    type="button"
                    onClick={() => {
                      setPickerModal({ type: 'origin', itemIndex: idx });
                      setPickerSearch('');
                    }}
                    className={`flex-1 min-w-0 p-2.5 rounded-xl text-left transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 border ${
                      item.originStoreId
                        ? 'border-transparent'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 block mb-0.5">
                      Pindah Dari
                    </span>
                    {item.originStoreId ? (
                      <>
                        <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {item.originStoreName}
                        </div>
                        {item.machineCode && item.machineCode !== '(Tanpa Unit Khusus)' && (
                          <span className="inline-block mt-1 text-[9px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700/80">
                            {item.machineCode}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
                        <Search className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Pilih toko &amp; mesin...</span>
                      </div>
                    )}
                  </button>

                  {/* Center Arrow */}
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Right: DIPINDAH KE */}
                  <button
                    type="button"
                    onClick={() => {
                      setPickerModal({ type: 'target', itemIndex: idx });
                      setPickerSearch('');
                    }}
                    className={`flex-1 min-w-0 p-2.5 rounded-xl text-left transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 border ${
                      item.targetStoreId
                        ? 'border-transparent'
                        : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 block mb-0.5">
                      Dipindah Ke
                    </span>
                    {item.targetStoreId ? (
                      <>
                        <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {item.targetStoreName}
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block mt-0.5">
                          {item.targetStoreAddress || '-'}
                        </span>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
                        <Search className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Pilih toko tujuan...</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Tambah Rute Lain */}
          <button
            type="button"
            onClick={handleAddRelocationItem}
            className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 text-indigo-700 dark:text-indigo-400 font-extrabold text-xs flex items-center justify-center gap-2 transition hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah rute lain</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={isDispatching}
          className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 transition cursor-pointer"
        >
          <Truck className="w-4 h-4" />
          <span>{isDispatching ? 'Mengirim...' : 'Kirim ke petugas logistik'}</span>
        </button>
      </form>

      {/* List of Recent Tasks in DB (Unboxed, nempel ke body) */}
      <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="pb-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Riwayat Tugas Logistik
          </h3>
        </div>

        {driverTasks.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Truck className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-medium">Belum ada riwayat tugas logistik di {activeBranchName}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {driverTasks.map((t) => {
              const teamInfo = t.notes?.match(/\[Tim Logistik: ([^\]]+)\]/);
              const assignedText = teamInfo ? teamInfo[1] : (t.driver?.full_name || 'Petugas');

              return (
                <div
                  key={t.id}
                  className="py-3.5 flex items-start justify-between gap-3 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Toko Asal -> Toko Tujuan */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
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
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                          {t.machine.machine_code}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Petugas: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{assignedText}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Status & Jam */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                        t.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : t.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}
                    >
                      {t.status === 'in_progress' ? 'Diangkut / Kirim' : t.status === 'assigned' ? 'Ditugaskan' : 'Selesai'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      {new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Picker (Asal / Tujuan) */}
      <BottomSheetModal
        item={pickerModal}
        onClose={() => {
          setPickerModal(null);
          setPickerSearch('');
        }}
      >
        {(picker, close) => {
          const isOrigin = picker.type === 'origin';
          const currentItem = relocationItems[picker.itemIndex];
          const query = pickerSearch.toLowerCase().trim();

          const filteredOriginList = originMachineOptions.filter((item) => {
            if (!query) return true;
            return (
              item.storeName.toLowerCase().includes(query) ||
              item.machineCode.toLowerCase().includes(query) ||
              (item.storeAddress && item.storeAddress.toLowerCase().includes(query))
            );
          });

          const filteredTargetList = stores.filter((st) => {
            if (!query) return true;
            return (
              st.name.toLowerCase().includes(query) ||
              (st.address && st.address.toLowerCase().includes(query))
            );
          });

          return (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    {isOrigin ? 'Langkah 1: Titik Asal' : 'Langkah 2: Titik Tujuan'}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    {isOrigin ? 'Pilih Toko & Mesin yang Dipindah' : 'Pilih Toko Tujuan Relokasi'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {isOrigin
                      ? 'Pilih unit mesin beserta toko asalnya yang akan ditarik/dipindah'
                      : 'Pilih lokasi toko mitra penerima penempatan mesin'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Searchbox */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder={
                    isOrigin
                      ? 'Cari nama toko atau kode mesin...'
                      : 'Cari nama toko mitra tujuan...'
                  }
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 -mr-1">
                {isOrigin ? (
                  filteredOriginList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Tidak ditemukan toko atau mesin dengan kata kunci &quot;{pickerSearch}&quot;.
                    </div>
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
                              picker.itemIndex
                            )
                          }
                          className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between group active:scale-98 ${
                            isSelected
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              {item.machineCode && item.machineCode !== '(Tanpa Unit Khusus)' ? (
                                <span
                                  className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border ${
                                    isSelected
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700'
                                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                  }`}
                                >
                                  {item.machineCode}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Belum ada mesin
                                </span>
                              )}
                              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {item.storeName}
                              </h4>
                              {isSelected && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                  Terpilih
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              {item.storeAddress || 'Alamat belum diinput'}
                            </p>
                          </div>
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition border ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-transparent group-hover:text-slate-400'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </div>
                        </button>
                      );
                    })
                  )
                ) : filteredTargetList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tidak ditemukan toko mitra tujuan dengan kata kunci &quot;{pickerSearch}&quot;.
                  </div>
                ) : (
                  filteredTargetList.map((st) => {
                    const isSelected = currentItem?.targetStoreId === st.id;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          handleSelectTarget(st.id, st.name, st.address || '', picker.itemIndex)
                        }
                        className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between group active:scale-98 ${
                          isSelected
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                              {st.name}
                            </h4>
                            {isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                Terpilih
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            {st.address || 'Alamat belum diisi'}
                          </p>
                        </div>
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition border ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-transparent group-hover:text-slate-400'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          );
        }}
      </BottomSheetModal>

      {/* Modal Multi-Select Staf Logistik */}
      <BottomSheetModal
        item={showStaffPickerModal ? true : null}
        onClose={() => {
          setShowStaffPickerModal(false);
          setStaffPickerSearch('');
        }}
      >
        {(_, close) => {
          const query = staffPickerSearch.toLowerCase().trim();
          const filteredStaff = assignableStaffList.filter((s) => {
            if (!query) return true;
            return (
              s.full_name.toLowerCase().includes(query) ||
              s.username.toLowerCase().includes(query)
            );
          });

          return (
            <>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    Penugasan Bersama
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                    Pilih Petugas Logistik
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Pilih 1 atau lebih staf yang akan mengemban tugas relokasi ini bersama
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Searchbox Staf */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={staffPickerSearch}
                  onChange={(e) => setStaffPickerSearch(e.target.value)}
                  placeholder="Cari nama staf atau username..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {staffPickerSearch && (
                  <button
                    type="button"
                    onClick={() => setStaffPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Staff List */}
              <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 -mr-1">
                {filteredStaff.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tidak ditemukan staf dengan kata kunci &quot;{staffPickerSearch}&quot;.
                  </div>
                ) : (
                  filteredStaff.map((staff) => {
                    const isSelected = selectedOfficerIds.includes(staff.id);
                    const badge = getStaffBadge(staff);

                    return (
                      <div
                        key={staff.id}
                        onClick={() => toggleOfficerSelection(staff.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition cursor-pointer active:scale-98 ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs'
                            : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {staff.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                                {staff.full_name}
                              </h4>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            {isSelected && staff.role !== 'logistik' && staff.role !== 'driver' ? (
                              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold truncate flex items-center gap-1 mt-0.5">
                                <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                <span>Role {staff.role.toUpperCase()} otomatis dialihkan ke Logistik</span>
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                @{staff.username} • {staff.role === 'logistik' || staff.role === 'driver' ? 'Petugas Logistik Aktif' : `Peran: ${staff.role.toUpperCase()}`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition border ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'border-slate-300 dark:border-slate-600 bg-transparent text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Confirm */}
              <button
                type="button"
                onClick={close}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  Simpan Pilihan ({selectedOfficerIds.length} Petugas Terpilih)
                </span>
              </button>
            </>
          );
        }}
      </BottomSheetModal>
    </div>
  );
};
