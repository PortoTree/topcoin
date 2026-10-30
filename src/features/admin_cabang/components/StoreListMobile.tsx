import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import { BottomSheetModal } from '../../../components/BottomSheetModal';
import { ActionPromptModal, type ActionPromptConfig } from '../../../components/ActionPromptModal';
import { StoreInfoModal } from '../../../components/StoreInfoModal';
import { displayMachineCode } from '../../../lib/machineCodeLogic';
import type { Store, Machine, UserProfile } from '../../../types';
import {
  Search,
  X,
  Plus,
  RefreshCw,
  Store as StoreIcon,
  Users,
  Archive,
  Cpu,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';

// ===========================================================================
// TYPES
// ===========================================================================

interface StoreListMobileProps {
  stores: Store[];
  machines: Machine[];
  droppingUsers: UserProfile[];
  branchId: string;
  branchName?: string;
  isLoading: boolean;
  onRefresh: () => void;
}

type StoreCategory = 'CADANGAN' | 'PETUGAS' | 'BEKAS';

interface CategorizedStore {
  store: Store;
  category: StoreCategory;
  /** full_name dropping staff yg pegang mesin di toko ini (jika ada) */
  droppingStaffName: string | null;
  /** kode mesin yg terpasang (jika ada) */
  machineCode: string | null;
  /** format: [time, dd/mm/yyyy] */
  dateLabel: string;
}

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Format tanggal & jam sesuai permintaan user:
 * [time, dd/mm/yyyy] contoh: 14:30, 30/10/2026
 */
function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${mins}, ${day}/${month}/${year}`;
}

function cleanPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.startsWith('0') ? '62' + digits.slice(1) : digits;
}

// ===========================================================================
// FORM EDIT / TAMBAH TOKO
// ===========================================================================

interface StoreFormData {
  name: string;
  owner_name: string;
  address: string;
  phone: string;
}

interface StoreFormModalProps {
  store: Store | null; // null = tambah baru
  branchId: string;
  onClose: () => void;
  onSuccess: (savedStore: Store) => void;
}

const StoreFormModal: React.FC<StoreFormModalProps> = ({
  store,
  branchId,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(store);
  const [form, setForm] = useState<StoreFormData>({
    name: store?.name ?? '',
    owner_name: store?.owner_name ?? '',
    address: store?.address ?? '',
    phone: store?.phone ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof StoreFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama toko wajib diisi.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        branch_id: branchId,
      };

      if (isEdit && store) {
        const { data, error } = await supabase
          .from('stores')
          .update(payload)
          .eq('id', store.id)
          .select()
          .single();
        if (error) throw error;
        toast.success(`Toko "${data.name}" berhasil diperbarui.`);
        onSuccess(data as Store);
      } else {
        const { data, error } = await supabase
          .from('stores')
          .insert({ ...payload, status: 'proses', current_machine_id: null, photo_store_url: null })
          .select()
          .single();
        if (error) throw error;
        toast.success(`Toko "${data.name}" berhasil ditambahkan.`);
        onSuccess(data as Store);
      }
      onClose();
    } catch (err: any) {
      console.error('Store form error:', err);
      toast.error(err.message || 'Gagal menyimpan data toko.');
    } finally {
      setIsSaving(false);
    }
  };

  const trigger = isEdit ? store : (true as unknown as Store);

  return (
    <BottomSheetModal item={trigger} onClose={onClose}>
      {(_, close) => (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {isEdit ? 'Edit Toko Mitra' : 'Tambah Toko Baru'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isEdit ? `Memperbarui data: ${store?.name}` : 'Daftarkan toko mitra baru ke sistem'}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer active:scale-90 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Toko <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Contoh: Warung Pak Budi"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pemilik
              </label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat
              </label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Contoh: Jl. Basuki Rahmat No. 12, Surabaya"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nomor WhatsApp
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>{isEdit ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</>
              )}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Toko'}
            </button>
          </div>
        </form>
      )}
    </BottomSheetModal>
  );
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================

export const StoreListMobile: React.FC<StoreListMobileProps> = ({
  stores,
  machines,
  droppingUsers,
  branchId,
  branchName,
  isLoading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all' | 'CADANGAN' | staffName | 'BEKAS'
  const [selectedStoreInfo, setSelectedStoreInfo] = useState<Store | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [actionPrompt, setActionPrompt] = useState<ActionPromptConfig | null>(null);

  // Set ID toko yang pernah direlokasi dari tabel driver_tasks
  const [relocatedStoreIds, setRelocatedStoreIds] = useState<Set<string>>(new Set());

  // Ambil data driver_tasks relokasi_mesin berstatus 'completed' untuk mendeteksi toko BEKAS
  useEffect(() => {
    let isMounted = true;
    const fetchRelocations = async () => {
      try {
        const { data, error } = await supabase
          .from('driver_tasks')
          .select('store_id')
          .eq('branch_id', branchId)
          .eq('task_type', 'relokasi_mesin')
          .eq('status', 'completed');

        if (isMounted && data && !error) {
          const ids = new Set<string>();
          for (const item of data) {
            if (item.store_id) ids.add(item.store_id);
          }
          setRelocatedStoreIds(ids);
        }
      } catch (err) {
        console.warn('Error fetching relocation tasks for store list:', err);
      }
    };

    fetchRelocations();
    return () => {
      isMounted = false;
    };
  }, [branchId, stores]);

  // =========================================================================
  // MAPPER & KALKULASI KATEGORI
  // Logika Kategori:
  // 1. Toko memiliki mesin aktif -> [NAMA PETUGAS DROPPING] (cth: [NAUFAL])
  // 2. Toko tidak memiliki mesin, tapi pernah dipasang mesin (relokasi selesai / nonaktif) -> [BEKAS]
  // 3. Toko belum memiliki mesin -> [CADANGAN] (sumber dari marketing)
  //
  // Logika Nomor Mesin:
  // - Jika ada mesin dipasang -> tampilkan badge kode mesin
  // - Jika tidak ada mesin dipasang -> kolom nomor mesin DI-HIDE
  // =========================================================================

  const machineByStoreId = useMemo(() => {
    const map = new Map<string, Machine>();
    for (const m of machines) {
      if (m.current_store_id) {
        map.set(m.current_store_id, m);
      }
    }
    return map;
  }, [machines]);

  const droppingUserById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const u of droppingUsers) {
      map.set(u.id, u);
    }
    return map;
  }, [droppingUsers]);

  const categorizedStores = useMemo((): CategorizedStore[] => {
    return stores.map((store) => {
      const machine = machineByStoreId.get(store.id);
      const hasMachineNow = Boolean(store.current_machine_id && machine);

      if (hasMachineNow && machine) {
        // Toko aktif dengan mesin
        const droppingUser = machine.assigned_dropping_id
          ? droppingUserById.get(machine.assigned_dropping_id)
          : null;
        return {
          store,
          category: 'PETUGAS',
          droppingStaffName: droppingUser?.full_name ?? 'PETUGAS',
          machineCode: machine.machine_code,
          dateLabel: formatDateShort(store.delivered_at ?? machine.created_at ?? store.created_at),
        };
      }

      // Kategori BEKAS:
      // Pernah ada relokasi mesin (completed 'relokasi_mesin' dengan toko ini sbg store_id)
      // ATAU store.status === 'nonaktif' ATAU pernah terpasang tapi mesin sudah ditarik
      const isRelocated = relocatedStoreIds.has(store.id);
      const wasEverInstalled = isRelocated || store.status === 'nonaktif' || Boolean(store.delivered_at);
      if (!hasMachineNow && wasEverInstalled) {
        return {
          store,
          category: 'BEKAS',
          droppingStaffName: null,
          machineCode: null,
          dateLabel: formatDateShort(store.updated_at ?? store.delivered_at ?? store.created_at),
        };
      }

      // Default: CADANGAN (dari input marketing yang belum dipasang mesin)
      return {
        store,
        category: 'CADANGAN',
        droppingStaffName: null,
        machineCode: null,
        dateLabel: formatDateShort(store.created_at),
      };
    });
  }, [stores, machineByStoreId, droppingUserById, relocatedStoreIds]);

  // Daftar nama dropping staff unik untuk filter chips
  const droppingStaffGroups = useMemo(() => {
    const staffMap = new Map<string, string>();
    for (const cs of categorizedStores) {
      if (cs.category === 'PETUGAS' && cs.droppingStaffName) {
        staffMap.set(cs.droppingStaffName, cs.droppingStaffName);
      }
    }
    return Array.from(staffMap.keys()).sort();
  }, [categorizedStores]);

  // Filter pencarian & kategori chip
  const filteredCategorized = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return categorizedStores.filter((cs) => {
      // Filter chip
      if (activeFilter !== 'all') {
        if (activeFilter === 'CADANGAN' && cs.category !== 'CADANGAN') return false;
        if (activeFilter === 'BEKAS' && cs.category !== 'BEKAS') return false;
        if (
          activeFilter !== 'CADANGAN' &&
          activeFilter !== 'BEKAS' &&
          cs.droppingStaffName !== activeFilter
        )
          return false;
      }
      // Pencarian
      if (!q) return true;
      return (
        cs.store.name.toLowerCase().includes(q) ||
        cs.store.owner_name?.toLowerCase().includes(q) ||
        cs.store.address?.toLowerCase().includes(q) ||
        cs.store.phone?.includes(q)
      );
    });
  }, [categorizedStores, activeFilter, searchQuery]);

  // Pengelompokan list per kategori (Urutan: CADANGAN -> Petugas Dropping -> BEKAS)
  const grouped = useMemo(() => {
    const cadangan: CategorizedStore[] = [];
    const petugasMap = new Map<string, CategorizedStore[]>();
    const bekas: CategorizedStore[] = [];

    for (const cs of filteredCategorized) {
      if (cs.category === 'CADANGAN') {
        cadangan.push(cs);
      } else if (cs.category === 'BEKAS') {
        bekas.push(cs);
      } else {
        const key = cs.droppingStaffName ?? 'PETUGAS';
        if (!petugasMap.has(key)) petugasMap.set(key, []);
        petugasMap.get(key)!.push(cs);
      }
    }

    const result: Array<{ label: string; items: CategorizedStore[]; type: StoreCategory }> = [];
    if (cadangan.length > 0) result.push({ label: 'CADANGAN', items: cadangan, type: 'CADANGAN' });
    petugasMap.forEach((items, name) => {
      result.push({ label: name.toUpperCase(), items, type: 'PETUGAS' });
    });
    if (bekas.length > 0) result.push({ label: 'BEKAS', items: bekas, type: 'BEKAS' });

    return result;
  }, [filteredCategorized]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleDeleteStore = useCallback(
    (store: Store, isBekas: boolean) => {
      if (isBekas) {
        toast.warning(`Toko "${store.name}" tidak dapat dihapus karena memiliki riwayat relokasi / dropping.`);
        return;
      }
      setActionPrompt({
        type: 'confirm',
        variant: 'danger',
        title: 'Hapus Toko Mitra?',
        subtitle: store.name,
        message: `Yakin ingin menghapus toko "${store.name}"? Data toko akan terhapus dari sistem cabang.`,
        confirmLabel: 'Ya, Hapus',
        cancelLabel: 'Batal',
        onConfirm: async () => {
          try {
            const { error } = await supabase.from('stores').delete().eq('id', store.id);
            if (error) throw error;
            toast.success(`Toko "${store.name}" berhasil dihapus.`);
            onRefresh();
          } catch (err: any) {
            console.error('Delete store error:', err);
            toast.error(err.message || 'Gagal menghapus toko.');
          }
        },
      });
    },
    [onRefresh]
  );

  const handleOpenWA = (phone: string) => {
    window.open(`https://wa.me/${cleanPhone(phone)}`, '_blank');
  };

  // =========================================================================
  // FILTER CHIPS
  // =========================================================================

  const filterChips: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'Semua' },
    { id: 'CADANGAN', label: 'Cadangan' },
    ...droppingStaffGroups.map((name) => ({ id: name, label: name.split(' ')[0] })),
    { id: 'BEKAS', label: 'Bekas' },
  ];

  // =========================================================================
  // STYLING PER KATEGORI
  // =========================================================================

  const getCategoryStyle = (type: StoreCategory) => {
    if (type === 'CADANGAN')
      return {
        headerBg: 'bg-amber-50 dark:bg-amber-950/40',
        headerBorder: 'border-amber-200 dark:border-amber-800/60',
        headerText: 'text-amber-700 dark:text-amber-400',
        icon: <Users className="w-3.5 h-3.5" />,
        badgeBg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300',
      };
    if (type === 'BEKAS')
      return {
        headerBg: 'bg-slate-100 dark:bg-slate-800/60',
        headerBorder: 'border-slate-200 dark:border-slate-700',
        headerText: 'text-slate-500 dark:text-slate-400',
        icon: <Archive className="w-3.5 h-3.5" />,
        badgeBg: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
      };
    // PETUGAS
    return {
      headerBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      headerBorder: 'border-indigo-200 dark:border-indigo-800/60',
      headerText: 'text-indigo-700 dark:text-indigo-400',
      icon: <StoreIcon className="w-3.5 h-3.5" />,
      badgeBg: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300',
    };
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="space-y-0 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pt-1 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Toko Mitra Cabang
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Total {stores.length} toko mitra{branchName ? ` di ${branchName}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-90 transition"
            title="Segarkan data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Toko
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="pb-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama toko, pemilik, alamat..."
            className="w-full pl-9 pr-9 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Horizontal */}
      <div className="pb-3 flex gap-2 overflow-x-auto scrollbar-none">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setActiveFilter(chip.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border transition cursor-pointer ${
              activeFilter === chip.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
          <p className="text-xs font-medium">Memuat data toko cabang...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredCategorized.length === 0 && (
        <div className="py-12 text-center px-6">
          <StoreIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            {searchQuery ? 'Toko tidak ditemukan' : 'Belum ada toko terdaftar'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {searchQuery
              ? 'Coba kata kunci lain atau pilih filter "Semua"'
              : 'Tap tombol Tambah Toko untuk mendaftarkan toko mitra baru'}
          </p>
        </div>
      )}

      {/* Grouped Store List */}
      {!isLoading && grouped.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-4 border-t border-slate-200 dark:border-slate-800">
          {grouped.map((group) => {
            const style = getCategoryStyle(group.type);
            return (
              <div key={group.label}>
                {/* Section Header */}
                <div
                  className={`flex items-center gap-2 px-4 py-2 ${style.headerBg} border-y ${style.headerBorder}`}
                >
                  <span className={`${style.headerText}`}>{style.icon}</span>
                  <span className={`text-[11px] font-extrabold uppercase tracking-widest ${style.headerText}`}>
                    {group.label}
                  </span>
                  <span
                    className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badgeBg}`}
                  >
                    {group.items.length} toko
                  </span>
                </div>

                {/* Store Items List */}
                <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
                  {group.items.map(({ store, category, droppingStaffName, machineCode, dateLabel }) => (
                    <div
                      key={store.id}
                      onClick={() => setSelectedStoreInfo(store)}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 active:bg-slate-100 dark:active:bg-slate-800/60 transition cursor-pointer select-none"
                    >
                      {/* Konten Utama Toko Sesuai Format Layout Permintaan User */}
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Baris 1: [nama toko] | [nama pemilik] */}
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                            {store.name}
                          </h4>
                          {store.owner_name && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600 text-xs">|</span>
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                                {store.owner_name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Baris 2: [alamat] > [nomor whatsapp] */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600 dark:text-slate-400">
                          <span className="truncate max-w-[200px] flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            {store.address || 'Alamat belum diisi'}
                          </span>
                          {store.phone && (
                            <>
                              <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">›</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenWA(store.phone!);
                                }}
                                className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                {store.phone}
                              </button>
                            </>
                          )}
                        </div>

                        {/* Baris 3: [kategori] [time, dd/mm/yyyy] [nomor mesin] (nomor mesin di-hide jika tdk ada) */}
                        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                          {/* Badge Kategori */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide ${
                              category === 'CADANGAN'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                                : category === 'BEKAS'
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300'
                            }`}
                          >
                            {category === 'CADANGAN' ? (
                              <Users className="w-2.5 h-2.5" />
                            ) : category === 'BEKAS' ? (
                              <Archive className="w-2.5 h-2.5" />
                            ) : (
                              <StoreIcon className="w-2.5 h-2.5" />
                            )}
                            {category === 'PETUGAS'
                              ? (droppingStaffName?.split(' ')[0]?.toUpperCase() ?? 'PETUGAS')
                              : category}
                          </span>

                          {/* Tanggal & Waktu: [time, dd/mm/yyyy] */}
                          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {dateLabel}
                          </span>

                          {/* Nomor Mesin: Jika ada mesin terpasang, tampilkan. Jika tidak ada, di-hide */}
                          {machineCode && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-black text-slate-800 dark:text-slate-200 shadow-2xs">
                              <Cpu className="w-2.5 h-2.5 text-indigo-500" />
                              {displayMachineCode(machineCode)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tombol WhatsApp Ikon Bulat Hijau di Kanan (Persis Screenshot) */}
                      {store.phone ? (
                        <a
                          href={`https://wa.me/${cleanPhone(store.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-800/60 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs flex-shrink-0"
                          title={`Chat WhatsApp (${store.name})`}
                        >
                          <img src="/whatsapp.png" alt="WA" className="w-4 h-4 object-contain" />
                        </a>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 flex-shrink-0">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!isLoading && filteredCategorized.length > 0 && (
        <div className="py-4 text-center">
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Menampilkan {filteredCategorized.length} dari {stores.length} toko
          </p>
        </div>
      )}

      {/* ===== MODAL: Detail Informasi Toko Mitra (Sama Persis dengan Dropping) ===== */}
      {selectedStoreInfo && (
        <StoreInfoModal
          store={selectedStoreInfo}
          onClose={() => setSelectedStoreInfo(null)}
          machineCodeOverride={
            categorizedStores.find((cs) => cs.store.id === selectedStoreInfo.id)?.machineCode ?? undefined
          }
          extraActions={(targetStore, close) => {
            const cat = categorizedStores.find((cs) => cs.store.id === targetStore.id);
            const isBekas = cat?.category === 'BEKAS';

            return (
              <div className="flex gap-2">
                {!isBekas ? (
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      handleDeleteStore(targetStore, false);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-xs font-bold cursor-pointer active:scale-95 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                ) : (
                  <div className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-[11px] font-semibold flex items-center gap-1">
                    <Archive className="w-3.5 h-3.5" />
                    Toko Bekas (Terkunci)
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setEditingStore(targetStore);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Data Toko
                </button>
              </div>
            );
          }}
        />
      )}

      {/* ===== MODAL: Edit Toko Mitra ===== */}
      {editingStore && (
        <StoreFormModal
          store={editingStore}
          branchId={branchId}
          onClose={() => setEditingStore(null)}
          onSuccess={() => {
            setEditingStore(null);
            onRefresh();
          }}
        />
      )}

      {/* ===== MODAL: Tambah Toko Baru ===== */}
      {showAddForm && (
        <StoreFormModal
          store={null}
          branchId={branchId}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            onRefresh();
          }}
        />
      )}

      {/* ===== MODAL: Konfirmasi Aksi (Hapus Toko) ===== */}
      <ActionPromptModal
        config={actionPrompt}
        onClose={() => setActionPrompt(null)}
      />
    </div>
  );
};
