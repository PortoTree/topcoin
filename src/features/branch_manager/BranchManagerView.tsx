import React, { useState, useEffect, useCallback } from 'react';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { ActionPromptModal, type ActionPromptConfig } from '../../components/ActionPromptModal';
import { toast } from '../../context/ToastContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Building,
  AlertCircle,
  RefreshCw,
  Building2,
  Clock,
  MoreVertical,
  AlertTriangle,
  Calendar,
  Trash2,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProfile, UserRole, DroppingTransaction, Machine } from '../../types';
import { LogisticsDispatchView } from '../logistics/LogisticsDispatchView';

interface BranchManagerViewProps {
  activeTab: string;
}

export const BranchManagerView: React.FC<BranchManagerViewProps> = ({ activeTab }) => {
  const { currentBranch, availableBranches, setCurrentBranch } = useBranch();
  const { updateStaffRole } = useAuth();

  // Pending Deletion Accounts
  const [pendingDeletions, setPendingDeletions] = useState<UserProfile[]>([]);
  const [branchStaff, setBranchStaff] = useState<UserProfile[]>([]);
  const [branchDroppings, setBranchDroppings] = useState<DroppingTransaction[]>([]);
  const [branchMachines, setBranchMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Selected staff for Role Assignment Modal & Staff Option Modal (rendered outside list)
  const [selectedStaffForRole, setSelectedStaffForRole] = useState<UserProfile | null>(null);
  const [selectedStaffForOption, setSelectedStaffForOption] = useState<UserProfile | null>(null);
  const [actionPrompt, setActionPrompt] = useState<ActionPromptConfig | null>(null);

  const getStaffBadge = (staff: UserProfile) => {
    if (staff.role === 'branch_manager') {
      return {
        label: 'Branch Manager (Anda)',
        className: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
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
          className: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
        };
      }
      return {
        label: 'Admin Cabang',
        className: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
      };
    }
    if (staff.role === 'logistik' || staff.role === 'driver' || staff.role === 'kurir') {
      return {
        label: 'Logistik',
        className: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
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

  const activeBranchId = currentBranch?.id || availableBranches[0]?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const fetchBMData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch pending deletion accounts across managed branches
      const { data: pendingData } = await supabase
        .from('profiles')
        .select('*')
        .eq('deletion_status', 'pending_deletion');

      if (pendingData) {
        setPendingDeletions(pendingData as UserProfile[]);
      } else {
        // Fallback demo pending deletion if empty for testing
        setPendingDeletions([]);
      }

      // 2. Fetch staff in the selected branch
      const { data: staffData } = await supabase
        .from('profiles')
        .select('*')
        .eq('branch_id', activeBranchId)
        .order('role', { ascending: true });

      if (staffData) setBranchStaff(staffData as UserProfile[]);

      // 3. Fetch today droppings in the selected branch
      const today = new Date().toISOString().split('T')[0];
      const { data: droppingData } = await supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name),
          machine:machines(machine_code),
          dropping_user:profiles(full_name)
        `)
        .eq('branch_id', activeBranchId)
        .eq('transaction_date', today);

      if (droppingData) setBranchDroppings(droppingData as DroppingTransaction[]);

      // 4. Fetch machines in the selected branch
      const { data: machineData } = await supabase
        .from('machines')
        .select('*')
        .eq('branch_id', activeBranchId);

      if (machineData) setBranchMachines(machineData as Machine[]);
    } catch (err) {
      console.error('Error fetching BM data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchBMData();
  }, [fetchBMData]);

  // Handle Approve Account Deletion (Permanent Removal)
  const handleApproveDeletion = (user: UserProfile) => {
    setActionPrompt({
      type: 'confirm',
      variant: 'danger',
      title: 'Setujui Hapus Permanen',
      subtitle: `${user.full_name} (@${user.username})`,
      message: 'Setujui penghapusan akun ini secara permanen dari sistem? Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Ya, Hapus Permanen',
      cancelLabel: 'Batal',
      onConfirm: async () => {
        try {
          await supabase.from('profiles').delete().eq('id', user.id);
          setPendingDeletions((prev) => prev.filter((u) => u.id !== user.id));
          setBranchStaff((prev) => prev.filter((u) => u.id !== user.id));
          confetti({ particleCount: 50, spread: 60 });
          const successMsg = `Akun "${user.full_name}" resmi dihapus permanen.`;
          setActionSuccess(successMsg);
          toast.success(successMsg);
        } catch (err: any) {
          console.error('Error approving deletion:', err);
          toast.error(err.message || 'Gagal menghapus akun.');
        }
      },
    });
  };

  // Handle Reject Account Deletion (Restore to Active)
  const handleRejectDeletion = (user: UserProfile) => {
    setActionPrompt({
      type: 'confirm',
      variant: 'primary',
      title: 'Pulihkan Akun Karyawan',
      subtitle: `${user.full_name} (@${user.username})`,
      message: 'Batalkan permohonan hapus dan aktifkan kembali akses login staf ini?',
      confirmLabel: 'Ya, Pulihkan Akun',
      cancelLabel: 'Batal',
      onConfirm: async () => {
        try {
          await supabase
            .from('profiles')
            .update({
              deletion_status: 'active',
              is_active: true,
              deletion_requested_by: null,
              deletion_requested_at: null,
            })
            .eq('id', user.id);

          setPendingDeletions((prev) => prev.filter((u) => u.id !== user.id));
          setBranchStaff((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, deletion_status: 'active', is_active: true } : u))
          );
          confetti({ particleCount: 40, spread: 50 });
          const restoreMsg = `Akun "${user.full_name}" berhasil dipulihkan!`;
          setActionSuccess(restoreMsg);
          toast.success(restoreMsg);
        } catch (err: any) {
          console.error('Error restoring account:', err);
          toast.error(err.message || 'Gagal memulihkan akun.');
        }
      },
    });
  };

  // Reassign staff role / duty from BM
  const handleChangeStaffRole = async (staff: UserProfile, selectedValue: string) => {
    const isAdmin = staff.role === 'admin_cabang' || staff.role === 'admin';
    const isPengelola = selectedValue === 'admin_cabang';
    const newAssignedTask = isAdmin
      ? isPengelola
        ? null
        : (selectedValue as 'logistik' | 'marketing' | 'dropping' | 'driver')
      : null;
    const targetRole: UserRole = isAdmin ? 'admin_cabang' : (selectedValue as UserRole);

    const label = isAdmin
      ? isPengelola
        ? 'Pengelola Murni'
        : `Admin Cabang + Tugas ${selectedValue.toUpperCase()}`
      : selectedValue.toUpperCase();

    try {
      const res = await updateStaffRole(staff.id, targetRole, newAssignedTask);
      if (res.success) {
        setBranchStaff((prev) =>
          prev.map((s) =>
            s.id === staff.id
              ? { ...s, role: targetRole, assigned_task: newAssignedTask }
              : s
          )
        );
        toast.success(`Penugasan ${staff.full_name} kini menjadi "${label}"!`);
      } else {
        toast.error(res.message || 'Gagal mengubah tugas staf.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat mengubah tugas.');
    }
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
        message: `Catat teguran kedisiplinan atau target operasional untuk ${staff.full_name}:`,
        inputLabel: 'Catatan Teguran / Peringatan',
        inputPlaceholder: 'Contoh: Pelanggaran SOP operasional, target tidak tercapai...',
        initialValue: 'Peringatan kedisiplinan & target cabang',
        confirmLabel: 'Terbitkan SP',
        onConfirm: (note) => {
          toast.warning(`Surat peringatan untuk "${staff.full_name}" dicatat: ${note || 'Kedisiplinan'}`);
        },
      });
    } else if (action === 'hapus') {
      setActionPrompt({
        type: 'confirm',
        variant: 'danger',
        title: 'Konfirmasi Hapus Akun',
        subtitle: `${staff.full_name} (@${staff.username})`,
        message: `Hapus / Kunci akun "${staff.full_name}" dari operasional cabang ini?`,
        confirmLabel: 'Ya, Hapus Akun',
        cancelLabel: 'Batal',
        onConfirm: async () => {
          try {
            await supabase
              .from('profiles')
              .update({
                deletion_status: 'pending_deletion',
                is_active: false,
              })
              .eq('id', staff.id);

            setBranchStaff((prev) =>
              prev.map((s) => (s.id === staff.id ? { ...s, is_active: false, deletion_status: 'pending_deletion' } : s))
            );
            toast.success(`Akun "${staff.full_name}" berhasil dikunci dan ditandai untuk dihapus.`);
          } catch (err: any) {
            toast.error(err.message || 'Gagal menghapus akun.');
          }
        },
      });
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const totalBranchGross = branchDroppings.reduce((acc, d) => acc + (d.gross_omset || 0), 0);
  const totalBranchNet = branchDroppings.reduce((acc, d) => acc + (d.net_deposit_amount || 0), 0);
  const installedMachines = branchMachines.filter((m) => m.status === 'terpasang').length;

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
      {/* BM Status Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden border border-indigo-500/30">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold mb-2">
            <Building className="w-3.5 h-3.5 text-indigo-400" />
            SUPERVISI MULTI-CABANG
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {currentBranch ? currentBranch.name : 'Pilih Cabang Supervisi'}
          </h2>
          <p className="text-xs text-indigo-200 mt-1 font-medium">
            Memantau {availableBranches.length} cabang penugasan ({availableBranches.map((b) => b.city).join(', ')})
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tab: BM Overview (Supervisi Cabang) */}
      {activeTab === 'bm_overview' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Branch Switcher Pill Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-2">
              Beralih Cabang yang Diawasi:
            </span>
            <div className="grid grid-cols-2 gap-2">
              {availableBranches.map((b) => {
                const isSelected = currentBranch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setCurrentBranch(b)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{b.city}</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {b.code}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Omset Kotor
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block truncate">
                {formatIDR(totalBranchGross)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Setoran Bersih
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
                {formatIDR(totalBranchNet)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block truncate">
                Mesin Aktif
              </span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block truncate">
                {installedMachines} / {branchMachines.length}
              </span>
            </div>
          </div>

          {/* Pending Approval Badge Link */}
          {pendingDeletions.length > 0 && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200 shadow-sm animate-pulse">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Ada {pendingDeletions.length} permohonan hapus akun menunggu approval Anda!</span>
              </div>
            </div>
          )}

          {/* Recent Dropping Activities in this Branch */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Transaksi Dropping Hari Ini</span>
              <button
                type="button"
                onClick={fetchBMData}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </h3>

            {branchDroppings.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">Belum ada transaksi di cabang ini hari ini.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {branchDroppings.map((d) => (
                  <div key={d.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white">{d.store?.name}</h4>
                      <p className="text-[10px] text-slate-500">
                        {d.dropping_user?.full_name} • Unit: {d.machine?.machine_code}
                      </p>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatIDR(d.net_deposit_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Approvals (Penghapusan Akun Karyawan Bertingkat) */}
      {activeTab === 'approvals' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Permohonan Hapus Akun Karyawan ({pendingDeletions.length})
            </h3>
            <button
              type="button"
              onClick={fetchBMData}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            Permohonan penghapusan akun dari Admin Cabang. Akun saat ini dalam status terkunci otomatis (*pending deletion*) dan tidak dapat login ke aplikasi.
          </p>

          {pendingDeletions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-semibold">Tidak ada permohonan hapus akun yang tertunda.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Semua akun staf beroperasi normal.</p>
            </div>
          ) : (
            pendingDeletions.map((user) => (
              <div
                key={user.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {user.full_name}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">
                        Terkunci
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Username: {user.username} • Peran: {user.role.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Diajukan oleh Admin Cabang
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleApproveDeletion(user)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui Hapus Permanen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectDeletion(user)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak & Pulihkan Akun</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Branch Staff (Supervisi Karyawan Cabang) */}
      {activeTab === 'branch_staff' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Karyawan {currentBranch?.name} ({branchStaff.length})
              </h3>
              <p className="text-xs text-slate-500">Supervisi tim operasional lapangan</p>
            </div>
            <button
              type="button"
              onClick={fetchBMData}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            {[...branchStaff]
              .sort((a, b) => {
                if (a.role === 'branch_manager') return -1;
                if (b.role === 'branch_manager') return 1;
                if (a.role === 'admin_cabang' || a.role === 'admin') return -1;
                if (b.role === 'admin_cabang' || b.role === 'admin') return 1;
                return a.full_name.localeCompare(b.full_name);
              })
              .map((staff) => {
                const isBM = staff.role === 'branch_manager';
                return (
                  <div
                    key={staff.id}
                    className={`p-3 sm:p-3.5 transition-colors ${
                      isBM ? 'bg-purple-50/40 dark:bg-purple-950/20' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Baris 1: Full Name */}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {staff.full_name}
                    </h4>

                    {/* Baris 2: Sejajar antara Badge Role & Status (kiri) dan Tombol Aksi (kanan) */}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      {/* Kiri: Badge Role (semua role ada badge) + Status */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const badge = getStaffBadge(staff);
                          return (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}

                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            staff.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                          }`}
                        >
                          {staff.is_active ? 'Aktif' : 'Terkunci'}
                        </span>
                      </div>

                      {/* Kanan: Tombol Arrow Down (Role) + Tombol Titik 3 (Opsi) */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isBM ? (
                          <>
                            {/* Tombol Arrow Down: Buka Modal Pemilihan Role (Diluar List) */}
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

                            {/* Tombol Opsi Titik 3: Buka Modal Tindakan Karyawan (Diluar List) */}
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
                        ) : (
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-100/70 dark:bg-purple-900/40 px-2 py-0.5 rounded-lg border border-purple-200/60 dark:border-purple-800/60">
                            Atasan Cabang
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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
                    handleChangeStaffRole(staff, 'admin_cabang');
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                    !staff.assigned_task || staff.assigned_task === 'admin_cabang'
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white block">
                      Pengelola
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Kendali kas, penugasan tim lapangan, dan monitoring omset cabang
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
                  handleChangeStaffRole(staff, 'logistik');
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                  (staff.role === 'admin_cabang' || staff.role === 'admin'
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
                    Relokasi unit mesin dan tugas operasional armada
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
                  handleChangeStaffRole(staff, 'dropping');
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                  (staff.role === 'admin_cabang' || staff.role === 'admin'
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
                  handleChangeStaffRole(staff, 'marketing');
                }}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all active:scale-98 cursor-pointer ${
                  (staff.role === 'admin_cabang' || staff.role === 'admin'
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

      {/* Modal / Action Sheet: Opsi Karyawan (Diluar Kolom List agar Tidak Kepotong & Bebas dari Parent Layout) */}
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

      {/* Modal Aksi Custom (Pengganti window.prompt & window.confirm) */}
      <ActionPromptModal
        config={actionPrompt}
        onClose={() => setActionPrompt(null)}
      />
    </div>
  );
};
