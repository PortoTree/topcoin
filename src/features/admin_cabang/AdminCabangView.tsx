import React, { useState, useEffect, useCallback } from 'react';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { ActionPromptModal, type ActionPromptConfig } from '../../components/ActionPromptModal';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import {
  DollarSign,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  Eye,
  ShieldAlert,
  Coins,
  X,
  MoreVertical,
  AlertTriangle,
  Calendar,
  Trash2,
  ChevronDown,
  Check,
  TrendingUp,
  ClipboardCheck,
  Sparkles,
  Store as StoreIcon,
  Gauge,
  Camera,
  Clock,
  History,
  Search,
  Pencil,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { DroppingTransaction, Machine, UserProfile, UserRole, Store } from '../../types';
import { DriverView } from '../driver/DriverView';
import { MarketingView } from '../marketing/MarketingView';
import { DroppingView } from '../dropping/DroppingView';
import { LogisticsDispatchView } from '../logistics/LogisticsDispatchView';
import { StaffAttendanceManager } from '../attendance/components/StaffAttendanceManager';
import { MachineManagerMobile } from './components/MachineManagerMobile';
import { AddStaffModalMobile } from './components/AddStaffModalMobile';
import { EditStaffModalMobile } from './components/EditStaffModalMobile';
import { displayMachineCode } from '../../lib/machineCodeLogic';
import { compareStaff, filterStaff } from '../../lib/staffLogic';

interface AdminCabangViewProps {
  activeTab: string;
}

export const AdminCabangView: React.FC<AdminCabangViewProps> = ({ activeTab }) => {
  const { profile, updateStaffRole } = useAuth();
  const { currentBranch } = useBranch();

  // Branch ID
  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // Live Data State
  const [droppings, setDroppings] = useState<DroppingTransaction[]>([]);
  const [droppingUsers, setDroppingUsers] = useState<UserProfile[]>([]);
  const [branchStaff, setBranchStaff] = useState<UserProfile[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [branchStores, setBranchStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Reconciliation State
  const [selectedDroppingUserId, setSelectedDroppingUserId] = useState<string>('');
  const [physicalCash, setPhysicalCash] = useState<string>('');
  const [reconciliationNotes, setReconciliationNotes] = useState<string>('');
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileSuccess, setReconcileSuccess] = useState<string | null>(null);

  // Staff Management State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<UserProfile | null>(null);

  // Image Preview Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [selectedDroppingDetail, setSelectedDroppingDetail] = useState<DroppingTransaction | null>(null);
  const [storeHistoryDroppings, setStoreHistoryDroppings] = useState<DroppingTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Selected staff for Role Assignment Modal & Staff Option Modal (rendered outside list)
  const [selectedStaffForRole, setSelectedStaffForRole] = useState<UserProfile | null>(null);
  const [selectedStaffForOption, setSelectedStaffForOption] = useState<UserProfile | null>(null);
  const [actionPrompt, setActionPrompt] = useState<ActionPromptConfig | null>(null);

  const getStaffRoleInfo = (staff: UserProfile) => {
    if (staff.role === 'branch_manager') {
      return {
        label: 'Branch Manager',
        colorClass: 'text-purple-600/80 dark:text-purple-400/80',
      };
    }
    if (staff.role === 'admin_cabang' || staff.role === 'admin') {
      if (staff.assigned_task && staff.assigned_task !== 'admin_cabang') {
        const taskName =
          staff.assigned_task === 'logistik' || staff.assigned_task === 'driver'
            ? 'Logistik'
            : staff.assigned_task === 'marketing'
              ? 'Marketing'
              : 'Dropping';
        return {
          label: `Admin • ${taskName}`,
          colorClass: 'text-indigo-600/80 dark:text-indigo-400/80',
        };
      }
      return {
        label: 'Admin Cabang',
        colorClass: 'text-indigo-600/80 dark:text-indigo-400/80',
      };
    }
    if (staff.role === 'logistik' || staff.role === 'driver' || staff.role === 'kurir') {
      return {
        label: 'Logistik',
        colorClass: 'text-slate-900/70 dark:text-slate-200/70',
      };
    }
    if (staff.role === 'dropping') {
      return {
        label: 'Dropping',
        colorClass: 'text-emerald-600/80 dark:text-emerald-400/80',
      };
    }
    if (staff.role === 'marketing' || staff.role === 'sales') {
      return {
        label: 'Marketing',
        colorClass: 'text-amber-600/80 dark:text-amber-400/80',
      };
    }
    return {
      label: staff.role,
      colorClass: 'text-slate-600/80 dark:text-slate-400/80',
    };
  };

  const handleStaffAction = async (staff: UserProfile, action: 'cuti' | 'peringatan' | 'hapus') => {
    setSelectedStaffForOption(null);
    if (action === 'cuti') {
      setActionPrompt({
        type: 'prompt',
        title: 'Atur Libur / Cuti',
        subtitle: staff.full_name,
        message: `Tentukan alasan atau keterangan izin libur operasional untuk ${staff.full_name}:`,
        inputLabel: 'Keterangan Libur / Izin',
        inputPlaceholder: 'Contoh: Izin urusan keluarga, sakit 1 hari...',
        initialValue: 'Cuti Kerja',
        confirmLabel: 'Simpan Status',
        onConfirm: (reason) => {
          toast.success(`Status Libur/Cuti untuk "${staff.full_name}" berhasil dicatat: "${reason || 'Cuti Kerja'}".`);
        },
      });
    } else if (action === 'peringatan') {
      setActionPrompt({
        type: 'prompt',
        variant: 'warning',
        title: 'Surat Peringatan (SP)',
        subtitle: staff.full_name,
        message: `Catat teguran kedisiplinan atau evaluasi operasional untuk ${staff.full_name}:`,
        inputLabel: 'Catatan Teguran / Pelanggaran',
        inputPlaceholder: 'Contoh: Terlambat berturut-turut, selisih meteran...',
        initialValue: 'Teguran kedisiplinan operasional',
        confirmLabel: 'Terbitkan SP',
        onConfirm: (note) => {
          toast.warning(`Surat peringatan resmi untuk "${staff.full_name}" dicatat: ${note || 'Kedisiplinan'}`);
        },
      });
    } else if (action === 'hapus') {
      handleRequestDeleteStaff(staff);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const getDroppingStatusBadge = (d: DroppingTransaction) => {
    const isOmsetTaken = Boolean(
      d.has_omset === true ||
      (typeof d.has_omset === 'string' && d.has_omset === 'true') ||
      (typeof d.coins_collected === 'number' && d.coins_collected > 0)
    );

    const notes = d.optional_notes || '';
    const isStoreClosed = notes.includes('Toko Tutup');
    const isMinimalCoin = notes.includes('Minimal Koin');
    const hasCustomKendala = !isStoreClosed && !isMinimalCoin && Boolean(d.photo_optional_url || d.optional_notes);

    if (isOmsetTaken) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          Selesai
        </span>
      );
    }
    if (isStoreClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-slate-900 text-slate-900 dark:border-white dark:text-white bg-transparent">
          <X className="w-3 h-3" />
          Toko Tutup
        </span>
      );
    }
    if (isMinimalCoin) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-orange-500 text-orange-600 dark:text-orange-400 bg-transparent">
          <Coins className="w-3 h-3" />
          Minimal Koin (MK)
        </span>
      );
    }
    if (hasCustomKendala) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-rose-500 text-rose-600 dark:text-rose-400 bg-transparent">
          <AlertTriangle className="w-3 h-3" />
          Kendala Khusus
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
        <Clock className="w-3 h-3" />
        Kunjungan
      </span>
    );
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
        // Sync seluruh staf dengan role dropping (termasuk admin_cabang dengan tugas dropping) yang aktif
        setDroppingUsers(
          staffList.filter(
            (u) =>
              (u.role === 'dropping' || (u.role === 'admin_cabang' && u.assigned_task === 'dropping')) &&
              u.is_active !== false &&
              u.deletion_status !== 'pending_deletion'
          )
        );
      }

      // 3. Machines in this branch
      const { data: mData, error: mError } = await supabase
        .from('machines')
        .select(`
          *,
          store:stores!fk_machines_current_store(name, address)
        `)
        .eq('branch_id', activeBranchId)
        .order('machine_code', { ascending: true });

      if (mError) {
        console.error('Error fetching machines:', mError);
      }
      if (mData) setMachines(mData as Machine[]);

      // 4. Stores in this branch
      const { data: sData } = await supabase
        .from('stores')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('name', { ascending: true });

      if (sData) setBranchStores(sData as Store[]);
    } catch (err) {
      console.error('Error fetching admin cabang data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchBranchData();
  }, [fetchBranchData]);

  // Format Tanggal & Jam (WIB) persis seperti dropping
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const dateFormatted = d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dateFormatted}, ${timeFormatted} WIB`;
  };

  const handleOpenWhatsApp = (store: any) => {
    if (!store?.phone) return;
    const cleanPhone = store.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    window.open(`https://wa.me/${phoneWithCountry}`, '_blank');
  };

  // Fetch riwayat transaksi dropping toko yang sedang dibuka di modal
  useEffect(() => {
    if (!selectedDroppingDetail) {
      setStoreHistoryDroppings([]);
      return;
    }

    const storeId = selectedDroppingDetail.store_id || selectedDroppingDetail.store?.id;
    if (!storeId) {
      setStoreHistoryDroppings([selectedDroppingDetail]);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('droppings')
          .select(`
            *,
            machine:machines(machine_code),
            dropping_user:user_profiles(full_name),
            store:stores(name, address, phone)
          `)
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (isMounted) {
          if (!error && data && data.length > 0) {
            setStoreHistoryDroppings(data as DroppingTransaction[]);
          } else {
            setStoreHistoryDroppings([selectedDroppingDetail]);
          }
        }
      } catch (err) {
        console.warn('Error fetching store history in admin cabang:', err);
        if (isMounted) {
          setStoreHistoryDroppings([selectedDroppingDetail]);
        }
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [selectedDroppingDetail]);

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
      toast.warning('Pilih petugas dropping yang akan direkonsiliasi.');
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
      const successMsg = `Rekonsiliasi kas berhasil disetujui! Status: ${status === 'matched' ? 'COCOK (Nol Selisih)' : `SELISIH ${formatIDR(cashDifference)}`
        }.`;
      setReconcileSuccess(successMsg);
      toast.success(successMsg);
      setPhysicalCash('');
      setReconciliationNotes('');
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      toast.error(err.message || 'Gagal menyimpan rekonsiliasi kas.');
    } finally {
      setIsReconciling(false);
    }
  };



  // Handle Request Delete Employee (Hierarchical Deletion - Step 1: Lock & Pending Deletion)
  const handleRequestDeleteStaff = (staff: UserProfile) => {
    setActionPrompt({
      type: 'confirm',
      variant: 'danger',
      title: 'Ajukan Hapus Akun',
      subtitle: `${staff.full_name} (@${staff.username})`,
      message:
        'Akun staf ini akan langsung dikunci (status: pending_deletion) dan diteruskan ke Branch Manager untuk konfirmasi final.',
      confirmLabel: 'Ya, Ajukan Hapus',
      cancelLabel: 'Batal',
      onConfirm: async () => {
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

          toast.success(`Akun "${staff.username}" berhasil dikunci dan permohonan diteruskan ke Branch Manager.`);
        } catch (err: any) {
          console.error('Delete request error:', err);
          toast.error(err.message || 'Gagal mengajukan penghapusan akun.');
        }
      },
    });
  };

  // Reassign staff role / duty (Dropping, Marketing, Driver/Logistik)
  const handleChangeStaffRole = async (staff: UserProfile, newRole: UserRole) => {
    if (staff.role === newRole) return;
    const oldRoleName = staff.role.toUpperCase();
    try {
      const res = await updateStaffRole(staff.id, newRole, null);
      if (res.success) {
        setBranchStaff((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, role: newRole, assigned_task: null } : s))
        );
        toast.success(`Role ${staff.full_name} berhasil dialihkan dari ${oldRoleName} menjadi ${newRole.toUpperCase()}. Layout aplikasi staf otomatis berganti.`);
      } else {
        toast.error(res.message || 'Gagal mengubah tugas staf.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat mengubah tugas.');
    }
  };

  // Reassign Admin Cabang Task / Pengelola
  const handleChangeAdminTask = async (staff: UserProfile, selectedValue: string) => {
    const isPengelola = selectedValue === 'admin_cabang';
    const newTask = isPengelola ? null : (selectedValue as 'logistik' | 'marketing' | 'dropping' | 'driver');
    const label = isPengelola ? 'Pengelola' : selectedValue.toUpperCase();

    try {
      const res = await updateStaffRole(staff.id, 'admin_cabang', newTask);
      if (res.success) {
        setBranchStaff((prev) =>
          prev.map((s) => (s.id === staff.id ? { ...s, assigned_task: newTask } : s))
        );
        toast.success(`Penugasan ${staff.full_name} kini menjadi ${label}. Tab tugas akan otomatis menyesuaikan.`);
      } else {
        toast.error(res.message || 'Gagal mengubah penugasan admin.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat mengubah penugasan admin.');
    }
  };

  // Khusus Tab Tugas Lapangan Aktif: Render langsung tampilan tugas penuh tanpa padding ganda & banner redundan
  if (activeTab === 'admin_task' && profile?.assigned_task) {
    if (profile.assigned_task === 'logistik' || profile.assigned_task === 'driver') {
      return <DriverView activeTab="driver_tasks" />;
    }
    if (profile.assigned_task === 'marketing') {
      return <MarketingView activeTab="new_store" />;
    }
    if (profile.assigned_task === 'dropping') {
      return <DroppingView activeTab="store_visits" />;
    }
  }

  // Khusus Tab Tugas Logistik: Render langsung tanpa pembungkus p-4 max-w-lg agar halaman melebar penuh
  if (activeTab === 'driver_dispatch') {
    return (
      <div className="pb-24 w-full">
        <LogisticsDispatchView branchId={activeBranchId} branchName={currentBranch?.name} />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
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

          {/* Live Dropping List (Nempel ke body, tanpa kontainer card) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                Laporan Dropping {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
              </h3>
              <button
                type="button"
                onClick={fetchBranchData}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                title="Segarkan data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {droppings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Belum ada laporan dropping hari ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 -mx-4 border-y border-slate-200 dark:border-slate-800">
                {droppings.map((d) => {
                  const prevMeter = d.previous_counter_meter ?? 0;
                  const lastMeter =
                    d.actual_physical_meter ??
                    d.calculated_new_meter ??
                    (prevMeter + (d.coins_collected || 0));
                  const meterDiff = lastMeter - prevMeter;
                  const diffSign = meterDiff > 0 ? '+' : '';

                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDroppingDetail(d)}
                      className="px-4 py-3 space-y-1.5 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 active:bg-slate-200/50 dark:active:bg-slate-800/80 transition cursor-pointer select-none"
                    >
                      {/* Baris 1: [nomor mesin] + [waktu] (kiri) & [status] (kanan) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tracking-wide">
                            {displayMachineCode(d.machine?.machine_code)}
                          </span>
                          {d.created_at && (
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              {new Date(d.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                          )}
                        </div>
                        {getDroppingStatusBadge(d)}
                      </div>

                      {/* Baris 2: [nama toko] (kiri) & [meter sebelum - meter terakhir=selisih] (kanan) */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {d.store?.name || 'Toko Mitra'}
                          </h4>
                        </div>
                        <div className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 flex-shrink-0">
                          <Gauge className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <span>
                            {prevMeter} - {lastMeter} ={' '}
                            <strong
                              className={
                                meterDiff > 0
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : meterDiff === 0
                                    ? 'text-black/40 dark:text-white/40 font-bold'
                                    : 'text-rose-600 dark:text-rose-400 font-bold'
                              }
                            >
                              {diffSign}
                              {meterDiff}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Baris 3: [omset bersih] (rata kanan) */}
                      <div className="flex items-center justify-end">
                        <span
                          className={`font-mono font-black text-sm ${(d.net_deposit_amount || 0) > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-black/40 dark:text-white/40'
                            }`}
                        >
                          {formatIDR(d.net_deposit_amount || 0)}
                        </span>
                      </div>

                      {d.discrepancy_reason && (
                        <div className="text-[10px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 mt-1">
                          ⚠️ Selisih: {d.meter_discrepancy} koin ({d.discrepancy_reason})
                        </div>
                      )}
                    </div>
                  );
                })}
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
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${cashDifference === 0
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
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white min-h-[72px] resize-y"
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

      {/* Tab: Tugas Pengelola Cabang (Jika Admin tidak memiliki penugasan khusus lapangan) */}
      {activeTab === 'admin_task' && !profile?.assigned_task && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-gradient-to-br from-indigo-500/10 via-white to-purple-500/10 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/30 border border-indigo-200/70 dark:border-indigo-800/60 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Peran Operasional
                </span>
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  Pengelola Cabang
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
              Anda bertugas memonitor operasional harian cabang {currentBranch?.name || 'ini'}, mengelola jadwal staf, serta rekonsiliasi kas.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Total Karyawan</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">{branchStaff.length} Orang</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">Total Mesin</span>
                <span className="font-extrabold text-slate-900 dark:text-white text-sm">{machines.length} Unit</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Omset (Placeholder Modern dengan Quick Metrics) */}
      {activeTab === 'omset' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Analisis Omset</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ringkasan performa omset cabang {currentBranch?.name}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Sparkles className="w-3 h-3" />
              Segera Hadir
            </span>
          </div>

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

          {/* Modern Placeholder Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Grafik & Visualisasi Omset
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Modul analitik grafik omset harian, tren perputaran koin, dan performa per toko sedang dalam tahap pengembangan.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Jadwal (Karyawan Cabang & Pengajuan Hapus Akun) */}
      {(activeTab === 'schedule' || activeTab === 'employees') && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Hero Section dengan Garis Pembatas Bawah Kontras */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-300 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Kelola Petugas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Total {branchStaff.length} akun di {currentBranch?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Petugas</span>
            </button>
          </div>

          {/* Searchbox di bawah garis pembatas */}
          <div className="relative">
            <input
              type="text"
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              placeholder="Cari nama, role, atau nomor WhatsApp..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition shadow-xs"
            />
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3 pointer-events-none" />
            {staffSearchQuery && (
              <button
                type="button"
                onClick={() => setStaffSearchQuery('')}
                className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center absolute right-2.5 top-2.5 cursor-pointer text-xs transition"
              >
                ×
              </button>
            )}
          </div>

          {/* List Langsung Menempel di Body (Tanpa Wrapper Card) */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filterStaff(branchStaff, staffSearchQuery)
              .sort(compareStaff)
              .map((staff) => {
                const isPendingDelete = staff.deletion_status === 'pending_deletion' || !staff.is_active;
                const isBM = staff.role === 'branch_manager';

                return (
                  <div
                    key={staff.id}
                    className={`py-3 px-1 transition-colors ${
                      isBM ? 'bg-purple-50/40 dark:bg-purple-950/20 rounded-xl px-2 my-0.5' : ''
                    }`}
                  >
                    {/* Baris 1: [nama lengkap] • [role teks biasa dengan opacity warna dasar] */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {staff.full_name}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs select-none">•</span>
                      {(() => {
                        const roleInfo = getStaffRoleInfo(staff);
                        return (
                          <span className={`text-xs font-semibold ${roleInfo.colorClass}`}>
                            {roleInfo.label}
                          </span>
                        );
                      })()}

                      {!staff.is_active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                          Terkunci
                        </span>
                      )}

                      {isPendingDelete && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                          <ShieldAlert className="w-3 h-3 flex-shrink-0" />
                          Pending Hapus
                        </span>
                      )}
                    </div>

                    {/* Baris 2: [nomor whatsapp]                  [icon WA] [icon Ubah Role] [icon Opsi] */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium truncate">
                        {staff.phone || '-'}
                      </span>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isBM ? (
                          <>
                            {staff.phone && (
                              <a
                                href={`https://wa.me/${(() => {
                                  const clean = staff.phone.replace(/[^0-9]/g, '');
                                  return clean.startsWith('0') ? '62' + clean.slice(1) : clean;
                                })()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs"
                                title={`Chat WhatsApp (${staff.phone})`}
                              >
                                <img
                                  src="/whatsapp.png"
                                  alt="WhatsApp"
                                  className="w-4 h-4 object-contain"
                                />
                              </a>
                            )}
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-100/70 dark:bg-purple-900/40 px-2 py-0.5 rounded-lg border border-purple-200/60 dark:border-purple-800/60">
                              Atasan Cabang
                            </span>
                          </>
                        ) : (
                          <>
                            {/* Tombol WhatsApp (Icon Saja di Kiri Tombol Ubah Role) */}
                            {staff.phone ? (
                              <a
                                href={`https://wa.me/${(() => {
                                  const clean = staff.phone.replace(/[^0-9]/g, '');
                                  return clean.startsWith('0') ? '62' + clean.slice(1) : clean;
                                })()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs"
                                title={`Chat WhatsApp (${staff.phone})`}
                              >
                                <img
                                  src="/whatsapp.png"
                                  alt="WhatsApp"
                                  className="w-4 h-4 object-contain"
                                />
                              </a>
                            ) : (
                              <div
                                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center opacity-40 cursor-not-allowed shadow-xs"
                                title="Nomor WhatsApp belum diisi"
                              >
                                <img
                                  src="/whatsapp.png"
                                  alt="WhatsApp"
                                  className="w-4 h-4 object-contain grayscale"
                                />
                              </div>
                            )}

                            {/* Tombol Arrow Down: Buka Modal Pemilihan Role */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffForRole(staff);
                                setSelectedStaffForOption(null);
                              }}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs"
                              title="Ubah Penugasan Peran"
                            >
                              <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                            </button>

                            {/* Tombol Opsi Titik 3: Buka Modal Tindakan Karyawan */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffForOption(staff);
                                setSelectedStaffForRole(null);
                              }}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs"
                              title="Opsi Tindakan Karyawan"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {filterStaff(branchStaff, staffSearchQuery).length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Tidak ada petugas yang cocok dengan kata kunci &quot;{staffSearchQuery}&quot;.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Mesin (Mobile Hybrid Machine & Prefix Manager) */}
      {activeTab === 'machines' && (
        <MachineManagerMobile
          branchId={activeBranchId}
          machines={machines}
          droppingStaff={droppingUsers}
          stores={branchStores}
          onRefresh={fetchBranchData}
        />
      )}

      {/* Tab: Laporan (Absensi Harian Seluruh Karyawan Cabang) */}
      {activeTab === 'reports' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Laporan Absensi Karyawan</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pencatatan kehadiran seluruh staf cabang hari ini
              </p>
            </div>
          </div>
          <StaffAttendanceManager branchId={activeBranchId} />
        </div>
      )}

      {/* Add Staff Modal Mobile */}
      <AddStaffModalMobile
        isOpen={showAddStaffModal}
        onClose={() => setShowAddStaffModal(false)}
        branchId={activeBranchId}
        onSuccess={(newStaff) => {
          setBranchStaff((prev) => [newStaff, ...prev]);
          if (newStaff.role === 'dropping') {
            setDroppingUsers((prev) => [newStaff, ...prev]);
          }
          fetchBranchData();
        }}
      />

      {/* Edit Staff Modal Mobile */}
      <EditStaffModalMobile
        isOpen={!!selectedStaffForEdit}
        onClose={() => setSelectedStaffForEdit(null)}
        staff={selectedStaffForEdit}
        onSuccess={(updatedStaff) => {
          setBranchStaff((prev) =>
            prev.map((s) => (s.id === updatedStaff.id ? { ...s, ...updatedStaff } : s))
          );
          if (updatedStaff.role === 'dropping') {
            setDroppingUsers((prev) =>
              prev.map((s) => (s.id === updatedStaff.id ? { ...s, ...updatedStaff } : s))
            );
          }
          fetchBranchData();
        }}
      />

      {/* Photo Preview Modal */}
      <BottomSheetModal
        item={previewPhotoUrl}
        onClose={() => setPreviewPhotoUrl(null)}
        contentClassName="relative max-w-sm w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl p-2 border border-slate-800"
      >
        {(photoUrl, close) => (
          <div className="relative">
            <button
              type="button"
              onClick={close}
              className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white cursor-pointer z-10 hover:bg-black/80 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={photoUrl}
              alt="Foto Bukti Lapangan"
              className="w-full h-auto rounded-2xl object-cover max-h-[75vh]"
            />
          </div>
        )}
      </BottomSheetModal>

      {/* Modal / Action Sheet: Pemilihan Role Staf (Diluar Kolom List agar Tidak Kepotong & Bebas dari Parent Layout) */}
      <BottomSheetModal
        item={selectedStaffForRole}
        onClose={() => setSelectedStaffForRole(null)}
      >
        {(staff, close) => (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Penugasan Peran
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {staff.full_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  @{staff.username} • Pilih peran atau tugas operasional
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

            {/* List Pilihan Role Berukuran Besar & Jelas */}
            <div className="space-y-2">
              {(staff.role === 'admin_cabang' || staff.role === 'admin') && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    handleChangeAdminTask(staff, 'admin_cabang');
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${!staff.assigned_task || staff.assigned_task === 'admin_cabang'
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                      Pengelola
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Kendali kas, penugasan tim logistik, dan monitoring omset cabang
                    </span>
                  </div>
                  {(!staff.assigned_task || staff.assigned_task === 'admin_cabang') && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  close();
                  if (staff.role === 'admin_cabang' || staff.role === 'admin') {
                    handleChangeAdminTask(staff, 'logistik');
                  } else {
                    handleChangeStaffRole(staff, 'logistik');
                  }
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'logistik' || staff.assigned_task === 'driver'
                  : staff.role === 'logistik' || staff.role === 'driver')
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                    Logistik
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Relokasi unit mesin dan tugas operasional lapangan
                  </span>
                </div>
                {(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'logistik' || staff.assigned_task === 'driver'
                  : staff.role === 'logistik' || staff.role === 'driver') && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  if (staff.role === 'admin_cabang' || staff.role === 'admin') {
                    handleChangeAdminTask(staff, 'dropping');
                  } else {
                    handleChangeStaffRole(staff, 'dropping');
                  }
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'dropping'
                  : staff.role === 'dropping')
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                    Dropping
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Pemasangan unit mesin & perawatan titik mitra
                  </span>
                </div>
                {(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'dropping'
                  : staff.role === 'dropping') && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  if (staff.role === 'admin_cabang' || staff.role === 'admin') {
                    handleChangeAdminTask(staff, 'marketing');
                  } else {
                    handleChangeStaffRole(staff, 'marketing');
                  }
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'marketing'
                  : staff.role === 'marketing' || staff.role === 'sales')
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                    Marketing
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Akuisisi toko baru & survey calon lokasi partner
                  </span>
                </div>
                {(staff.role === 'admin_cabang' || staff.role === 'admin'
                  ? staff.assigned_task === 'marketing'
                  : staff.role === 'marketing' || staff.role === 'sales') && (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
              </button>
            </div>

            <button
              type="button"
              onClick={close}
              className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm text-center transition cursor-pointer"
            >
              Tutup
            </button>
          </>
        )}
      </BottomSheetModal>

      {/* Modal / Action Sheet: Opsi Karyawan (Diluar Kolom List agar Tidak Kepotong) */}
      <BottomSheetModal
        item={selectedStaffForOption}
        onClose={() => setSelectedStaffForOption(null)}
      >
        {(staff, close) => (
          <>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Opsi Tindakan
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {staff.full_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  @{staff.username}
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

            {/* List Aksi Berukuran Besar & Nyaman Diklik */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  close();
                  setSelectedStaffForEdit(staff);
                }}
                className="w-full p-3.5 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/60 text-left flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                    Edit Petugas
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Perbarui nama lengkap, nomor WhatsApp, PIN, atau prefix mesin
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  handleStaffAction(staff, 'cuti');
                }}
                className="w-full p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-left flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                    Libur / Cuti
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Setel status staf menjadi libur atau izin sementara
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  handleStaffAction(staff, 'peringatan');
                }}
                className="w-full p-3.5 rounded-2xl bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 text-left flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-amber-900 dark:text-amber-300 block">
                    Peringatan
                  </span>
                  <span className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium">
                    Catat teguran kedisiplinan atau evaluasi operasional
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  close();
                  handleStaffAction(staff, 'hapus');
                }}
                className="w-full p-3.5 rounded-2xl bg-rose-50/60 hover:bg-rose-100/70 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-800/50 text-left flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 block">
                    Hapus Akun
                  </span>
                  <span className="text-xs text-rose-600/80 dark:text-rose-400/80 font-medium">
                    Ajukan penonaktifan & penghapusan akun dari cabang
                  </span>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={close}
              className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm text-center transition cursor-pointer"
            >
              Batal
            </button>
          </>
        )}
      </BottomSheetModal>

      {/* Modal Detail Transaksi Dropping */}
      <BottomSheetModal
        item={selectedDroppingDetail}
        onClose={() => setSelectedDroppingDetail(null)}
        isFullscreen={true}
      >
        {(detail, close) => {
          // Gabungkan riwayat: pastikan transaksi hari ini / transaksi aktif muncul di urutan paling atas jika belum ada di list
          const combinedHistory: DroppingTransaction[] = [...storeHistoryDroppings];
          if (!combinedHistory.some((h) => h.id === detail.id)) {
            combinedHistory.unshift(detail);
          }

          const store = detail.store || {
            name: 'Toko Mitra',
            address: '',
            phone: '',
            machine: detail.machine,
          };
          const machineCode = displayMachineCode(detail.machine?.machine_code || store.machine?.machine_code);

          return (
            <>
              {/* Sticky Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                      Informasi Toko Mitra
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Riwayat tracking & bukti foto kunjungan
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer active:scale-90 transition"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-lg mx-auto w-full pb-8">
                {/* 1. Profil Toko & Kontak */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Outlet Mitra
                      </span>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">{store.name}</h4>
                    </div>
                    <span className="text-[11px] font-extrabold font-mono px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 flex-shrink-0">
                      {machineCode}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Alamat Toko</span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {store.address || 'Alamat belum diatur'}
                    </p>
                  </div>

                  {/* Hubungi WA dengan Nomor Langsung */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsApp(store)}
                      disabled={!store.phone}
                      className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition shadow-2xs ${store.phone
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer active:scale-95'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                        }`}
                    >
                      <img src="/whatsapp.png" alt="WA" className="w-4 h-4 object-contain" />
                      <span className="font-mono">{store.phone || 'Nomor Belum Ada'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Meteran Terakhir Sistem */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block uppercase tracking-wider">Meter Terakhir Sistem</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Counter meter fisik mesin</span>
                  </div>
                  <span className="font-mono font-black text-base text-indigo-600 dark:text-indigo-400 px-3 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    {detail.actual_physical_meter ?? detail.machine?.last_counter_meter ?? store.machine?.last_counter_meter ?? detail.previous_counter_meter ?? 0}
                  </span>
                </div>

                {/* 3. Riwayat Tracking Kunjungan & Bukti Foto (SAMA PERSIS DENGAN MILIK DROPPING) */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          Riwayat Tracking Kunjungan
                        </h5>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Timeline kunjungan, pencatatan waktu & galeri foto
                        </span>
                      </div>
                    </div>
                  </div>

                  {isLoadingHistory ? (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                      <p className="text-xs font-medium">Memuat riwayat tracking...</p>
                    </div>
                  ) : combinedHistory.length > 0 ? (
                    <div className="pt-2 space-y-4">
                      {combinedHistory.map((tx, idx) => {
                        const photos = [
                          { url: tx.photo_machine_url || tx.photo_machine_meter_url, label: 'Mesin' },
                          { url: tx.photo_machine_number_url, label: 'No Plat' },
                          { url: tx.photo_coin_url || tx.photo_coin_tray_url, label: 'Koin' },
                          { url: tx.photo_nota_url, label: 'Nota' },
                          { url: tx.photo_optional_url, label: 'Opsional' },
                        ].filter((p): p is { url: string; label: string } => Boolean(p.url));

                        return (
                          <div
                            key={tx.id || idx}
                            className="relative pl-6 pb-4 last:pb-1 border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-2"
                          >
                            {/* Dot marker */}
                            <div className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>

                            {/* Waktu & Petugas */}
                            <div className="flex items-center justify-between text-[11px] mb-1.5">
                              <span className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                {formatDateTime(tx.created_at)}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                                {idx === 0 ? 'Kunjungan Terakhir' : `Kunjungan ke-${combinedHistory.length - idx}`}
                              </span>
                            </div>

                            {/* Kartu Ringkasan Kunjungan */}
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${tx.coins_collected
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : tx.optional_notes?.includes('Toko Tutup')
                                      ? 'border border-slate-900 text-slate-900 dark:border-white dark:text-white bg-transparent'
                                      : tx.optional_notes?.includes('Minimal Koin')
                                        ? 'border border-orange-500 text-orange-600 dark:text-orange-400 bg-transparent'
                                        : (tx.photo_optional_url || tx.optional_notes)
                                          ? 'border border-rose-500 text-rose-600 dark:text-rose-400 bg-transparent'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                    }`}
                                >
                                  {tx.coins_collected ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" /> Ambil omset
                                    </>
                                  ) : tx.optional_notes?.includes('Toko Tutup') ? (
                                    <>
                                      <X className="w-3 h-3" /> Toko Tutup
                                    </>
                                  ) : tx.optional_notes?.includes('Minimal Koin') ? (
                                    <>
                                      <Coins className="w-3 h-3" /> Minimal Koin (MK)
                                    </>
                                  ) : (tx.photo_optional_url || tx.optional_notes) ? (
                                    <>
                                      <AlertTriangle className="w-3 h-3" /> Kendala Khusus
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" /> Kunjungan
                                    </>
                                  )}
                                </span>
                                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                  Meter: <strong className="text-slate-900 dark:text-white font-bold">{tx.actual_physical_meter ?? tx.previous_counter_meter ?? 0}</strong>
                                </span>
                              </div>

                              {tx.coins_collected ? (
                                <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Koin Terambil:</span>
                                    <strong className="text-slate-900 dark:text-white font-mono font-black">{tx.coins_collected} Koin</strong>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Setoran Bersih:</span>
                                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatIDR(tx.net_deposit_amount || 0)}</strong>
                                  </div>
                                </div>
                              ) : null}

                              {tx.optional_notes && (
                                <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700/60 leading-relaxed">
                                  <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px] uppercase">Catatan Petugas:</span>
                                  {tx.optional_notes}
                                </div>
                              )}

                              {/* Galeri Preview Gambar Bukti (Sama Persis Kategori Milik Dropping: Mesin, No Plat, Koin, Nota, Opsional) */}
                              {photos.length > 0 && (
                                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                                    <Camera className="w-3 h-3 text-indigo-500" />
                                    Preview Bukti Foto ({photos.length} Foto)
                                  </span>
                                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {photos.map((photo, pIdx) => (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => setPreviewPhotoUrl(photo.url)}
                                        className="group relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition cursor-pointer active:scale-95 shadow-xs"
                                        title={`Klik untuk memperbesar Foto ${photo.label}`}
                                      >
                                        <img
                                          src={photo.url}
                                          alt={photo.label}
                                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                          <Eye className="w-4 h-4 drop-shadow-sm" />
                                        </div>
                                        <span className="absolute bottom-1 inset-x-1 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold py-0.5 rounded text-center truncate">
                                          {photo.label}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="pt-2">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-center space-y-1">
                        <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Belum Ada Riwayat Kunjungan</span>
                        <p className="text-[11px] text-slate-500">Mulai kunjungan pertama hari ini untuk mencatat meteran fisik dan bukti foto.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        }}
      </BottomSheetModal>

      {/* Modal Preview Foto */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/90">
              <span className="text-xs font-bold text-slate-200">Foto Bukti Lapangan</span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/40 min-h-[250px] max-h-[75vh]">
              <img
                src={previewPhotoUrl}
                alt="Bukti Foto"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Aksi Custom (Pengganti window.prompt & window.confirm) */}
      <ActionPromptModal
        config={actionPrompt}
        onClose={() => setActionPrompt(null)}
      />
    </div>
  );
};
