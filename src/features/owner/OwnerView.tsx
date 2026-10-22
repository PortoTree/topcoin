import React, { useState, useEffect, useCallback } from 'react';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { generateBranchDailyBackupJson, downloadBackupJsonFile, type DailyBranchBackupSnapshot } from '../../lib/backupService';
import {
  ShieldCheck,
  Database,
  Building2,
  PlusCircle,
  Download,
  Trash2,
  RefreshCw,
  MapPin,
  X,
  FileCode,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Branch, UserProfile, UserRole, DroppingTransaction, Machine } from '../../types';
import { toast } from '../../context/ToastContext';
import { ActionPromptModal, type ActionPromptConfig } from '../../components/ActionPromptModal';
import { BottomSheetModal } from '../../components/BottomSheetModal';

interface OwnerViewProps {
  activeTab: string;
}

export const OwnerView: React.FC<OwnerViewProps> = ({ activeTab }) => {
  const { currentBranch, isGlobalView, availableBranches, refreshBranches } = useBranch();

  // Custom Action Prompt Modal state
  const [actionPrompt, setActionPrompt] = useState<ActionPromptConfig | null>(null);

  // Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allDroppings, setAllDroppings] = useState<DroppingTransaction[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals State
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('admin_cabang');
  const [newUserBranchId, setNewUserBranchId] = useState('');
  const [newUserPin, setNewUserPin] = useState('123456');

  // JSON Backup Preview Modal State
  const [previewSnapshot, setPreviewSnapshot] = useState<DailyBranchBackupSnapshot | null>(null);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);

  const fetchGlobalData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Branches
      const { data: bData } = await supabase.from('branches').select('*').order('name');
      if (bData && bData.length > 0) setBranches(bData as Branch[]);
      else setBranches(availableBranches);

      // 2. Fetch All Users
      const { data: uData } = await supabase
        .from('profiles')
        .select(`*, branch:branches(*)`)
        .order('role');
      if (uData) setUsers(uData as UserProfile[]);

      // 3. Fetch Droppings today
      const today = new Date().toISOString().split('T')[0];
      const { data: dData } = await supabase
        .from('droppings')
        .select(`*, branch:branches(*)`)
        .eq('transaction_date', today);
      if (dData) setAllDroppings(dData as DroppingTransaction[]);

      // 4. Fetch Machines
      const { data: mData } = await supabase.from('machines').select('*');
      if (mData) setAllMachines(mData as Machine[]);
    } catch (err) {
      console.error('Error fetching owner data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [availableBranches]);

  useEffect(() => {
    fetchGlobalData();
  }, [fetchGlobalData]);

  // Handle Add Branch
  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchCode.trim() || !newBranchName.trim() || !newBranchCity.trim()) {
      toast.warning('Isi kode, nama cabang, dan kota.');
      return;
    }

    try {
      const payload = {
        code: newBranchCode.trim().toUpperCase(),
        name: newBranchName.trim(),
        city: newBranchCity.trim(),
        address: newBranchAddress.trim() || null,
        phone: newBranchPhone.trim() || null,
        is_active: true,
      };

      const { data, error } = await supabase.from('branches').insert(payload).select().single();
      if (!error && data) {
        setBranches((prev) => [...prev, data as Branch]);
      } else {
        const mockB: Branch = {
          id: 'branch-' + Date.now(),
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setBranches((prev) => [...prev, mockB]);
      }

      await refreshBranches();
      setShowAddBranchModal(false);
      setNewBranchCode('');
      setNewBranchName('');
      setNewBranchCity('');
      setNewBranchAddress('');
      setNewBranchPhone('');
      confetti({ particleCount: 40, spread: 50 });
      toast.success('Cabang baru berhasil ditambahkan!');
    } catch (err: any) {
      console.error('Error adding branch:', err);
      toast.error(err.message || 'Gagal menambah cabang.');
    }
  };

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserUsername.trim() || !newUserFullName.trim()) {
      toast.warning('Isi username dan nama lengkap.');
      return;
    }

    try {
      const payload: Partial<UserProfile> = {
        id: 'user-' + Date.now(),
        username: newUserUsername.trim().toLowerCase(),
        full_name: newUserFullName.trim(),
        role: newUserRole,
        branch_id: newUserRole === 'owner' ? null : newUserBranchId || branches[0]?.id,
        pin: newUserPin.trim() || '123456',
        is_active: true,
        deletion_status: 'active',
      };

      const { error } = await supabase.from('profiles').insert(payload);
      if (error) console.warn('DB user insert fallback:', error);

      setUsers((prev) => [payload as UserProfile, ...prev]);
      setShowAddUserModal(false);
      setNewUserUsername('');
      setNewUserFullName('');
      confetti({ particleCount: 40, spread: 50 });
      toast.success(`Akun pengguna "${newUserFullName}" (${newUserRole}) berhasil dibuat!`);
    } catch (err: any) {
      console.error('Error adding user:', err);
      toast.error(err.message || 'Gagal membuat pengguna.');
    }
  };

  // Handle Delete User Directly (Owner Authority)
  const handleDeleteUserDirect = async (u: UserProfile) => {
    if (u.role === 'owner') {
      toast.warning('Akun Owner tidak dapat dihapus.');
      return;
    }

    setActionPrompt({
      type: 'confirm',
      variant: 'danger',
      title: 'Hapus Pengguna (Owner Override)',
      subtitle: `${u.full_name} (@${u.username})`,
      message: `Apakah Anda yakin ingin menghapus akun "${u.full_name}" (${u.username}) secara permanen?`,
      confirmLabel: 'Ya, Hapus Permanen',
      cancelLabel: 'Batal',
      onConfirm: async () => {
        setActionPrompt(null);
        try {
          await supabase.from('profiles').delete().eq('id', u.id);
          setUsers((prev) => prev.filter((user) => user.id !== u.id));
          toast.success(`Akun "${u.username}" telah dihapus.`);
        } catch (err: any) {
          console.error('Error deleting user:', err);
          toast.error(err.message || 'Gagal menghapus user.');
        }
      },
    });
  };

  // Generate and Download Backup JSON
  const handleGenerateBackup = async (b: Branch) => {
    setIsGeneratingBackup(true);
    try {
      const snapshot = await generateBranchDailyBackupJson(b);
      setPreviewSnapshot(snapshot);
      downloadBackupJsonFile(snapshot);
      confetti({ particleCount: 50, spread: 60 });
      toast.success(`Backup data cabang ${b.name} berhasil dibuat!`);
    } catch (err: any) {
      console.error('Backup error:', err);
      toast.error(err.message || 'Gagal men-generate file backup JSON.');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const totalGlobalGross = allDroppings.reduce((acc, d) => acc + (d.gross_omset || 0), 0);
  const totalGlobalShare = allDroppings.reduce((acc, d) => acc + (d.store_share_amount || 0), 0);
  const totalGlobalNet = allDroppings.reduce((acc, d) => acc + (d.net_deposit_amount || 0), 0);
  const totalInstalledMachines = allMachines.filter((m) => m.status === 'terpasang').length;

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto animate-in fade-in duration-150">
      {/* Scope Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden border border-purple-500/30">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[11px] font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            OWNER SUPER COMMAND
          </div>
          <h2 className="text-xl font-black tracking-tight">
            {isGlobalView ? 'Konsolidasi Seluruh Cabang' : currentBranch?.name}
          </h2>
          <p className="text-xs text-purple-200 mt-1 font-medium">
            {isGlobalView
              ? `Mengawasi ${branches.length} cabang aktif & seluruh staf perusahaan`
              : `Kota ${currentBranch?.city} • Kode: ${currentBranch?.code}`}
          </p>
        </div>
      </div>

      {/* Tab: Konsolidasi Global */}
      {activeTab === 'global_recap' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Global Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Omset Kotor Global
              </span>
              <span className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                {formatIDR(totalGlobalGross)}
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                Jatah Toko: {formatIDR(totalGlobalShare)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Setoran Bersih Masuk
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatIDR(totalGlobalNet)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                Unit Aktif: {totalInstalledMachines} / {allMachines.length}
              </span>
            </div>
          </div>

          {/* Breakdown per Cabang */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Performa Komparasi Antar-Cabang
              </h3>
              <button
                type="button"
                onClick={fetchGlobalData}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {branches.map((b) => {
                const bDroppings = allDroppings.filter((d) => d.branch_id === b.id);
                const bGross = bDroppings.reduce((acc, d) => acc + (d.gross_omset || 0), 0);
                const bNet = bDroppings.reduce((acc, d) => acc + (d.net_deposit_amount || 0), 0);
                const bMachines = allMachines.filter((m) => m.branch_id === b.id).length;

                return (
                  <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-white">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{b.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {b.city} • {bMachines} Mesin • {bDroppings.length} Transaksi Hari Ini
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-emerald-600 dark:text-emerald-400 block font-mono">
                        {formatIDR(bNet)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Kotor: {formatIDR(bGross)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Manajemen Cabang CRUD */}
      {activeTab === 'branches' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Daftar Cabang Perusahaan ({branches.length})
              </h3>
              <p className="text-xs text-slate-500">Kelola dan buka cabang operasional baru</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddBranchModal(true)}
              className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Cabang</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {branches.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-purple-500" />
                      {b.name}
                    </h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {b.address || b.city}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-extrabold border border-purple-200 dark:border-purple-800">
                    {b.code}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 text-[11px]">Kota: {b.city}</span>
                  <button
                    type="button"
                    onClick={() => handleGenerateBackup(b)}
                    className="py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-purple-500" />
                    <span>Backup JSON</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Manajemen Karyawan Lintas Cabang */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Semua Karyawan ({users.length})
              </h3>
              <p className="text-xs text-slate-500">Tata kelola seluruh akun di semua cabang</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah User</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-xs overflow-hidden">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {u.full_name}
                    </h4>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                      {u.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    User: {u.username} • PIN: {u.pin || '123456'}
                  </p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Cabang: {u.branch ? u.branch.name : 'Semua Cabang (Global)'}
                  </p>
                </div>

                <div>
                  {u.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUserDirect(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Hapus Pengguna (Owner Override)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Audit Backup JSON Harian */}
      {activeTab === 'backup_audit' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-500" />
              Sistem Auto-Backup JSON Harian
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium leading-relaxed">
              Setiap penutupan hari (*close day / reset midnight*), sistem otomatis men-generate file snapshot berekstensi <code className="font-mono text-purple-600 font-bold">.json</code> per cabang untuk arsip permanen dan disaster recovery.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">
              Download Snapshot Cabang Hari Ini:
            </h3>
            {branches.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">{b.name}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Format: backup_{b.code.toLowerCase()}_{new Date().toISOString().split('T')[0]}.json
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeneratingBackup}
                  onClick={() => handleGenerateBackup(b)}
                  className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh JSON</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      <BottomSheetModal
        isOpen={showAddBranchModal}
        onClose={() => setShowAddBranchModal(false)}
      >
        {(_, close) => (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Buka Cabang Operasional Baru
              </h3>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kode Cabang (Singkat) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: SDA-01"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Cabang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Cabang Sidoarjo Kota"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kota *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Sidoarjo"
                  value={newBranchCity}
                  onChange={(e) => setNewBranchCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Kantor Cabang
                </label>
                <input
                  type="text"
                  placeholder="Jl. Pahlawan No. 5..."
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
                >
                  Simpan Cabang
                </button>
              </div>
            </form>
          </>
        )}
      </BottomSheetModal>

      {/* Add User Modal */}
      <BottomSheetModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
      >
        {(_, close) => (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Buat Akun Karyawan Baru
              </h3>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Dimas Pratama"
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: dimas"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pilih Role *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="branch_manager">Branch Manager (Supervisi Multi-Cabang)</option>
                  <option value="admin_cabang">Admin Cabang (Kas & Dispatch)</option>
                  <option value="marketing">Marketing (Pendaftaran Toko)</option>
                  <option value="dropping">Dropping (Koleksi Omset)</option>
                  <option value="logistik">Logistik (Armada & Mesin)</option>
                </select>
              </div>

              {newUserRole !== 'owner' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cabang Penempatan *
                  </label>
                  <select
                    value={newUserBranchId}
                    onChange={(e) => setNewUserBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="">-- Pilih Cabang --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition cursor-pointer"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </>
        )}
      </BottomSheetModal>

      {/* JSON Snapshot Viewer Modal */}
      <BottomSheetModal
        item={previewSnapshot}
        onClose={() => setPreviewSnapshot(null)}
      >
        {(snapshot, close) => (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Snapshot JSON: {snapshot.branch.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              File berhasil diunduh ke komputer/HP Anda! Format data terstruktur siap untuk arsip dan audit:
            </p>

            <pre className="max-h-[50vh] overflow-y-auto p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[10px] leading-relaxed border border-slate-800">
              {JSON.stringify(snapshot, null, 2)}
            </pre>

            <button
              type="button"
              onClick={close}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
            >
              Tutup Preview
            </button>
          </>
        )}
      </BottomSheetModal>

      {/* Modal Aksi Custom (Pengganti window.confirm) */}
      <ActionPromptModal config={actionPrompt} onClose={() => setActionPrompt(null)} />
    </div>
  );
};
