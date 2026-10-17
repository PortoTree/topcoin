import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { offlineDb } from '../../lib/db';
import { CameraCapture } from '../../components/CameraCapture';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Coins,
  Store as StoreIcon,
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  Calendar,
  Sparkles,
  Gauge,
  Wallet,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Search,
  MapPin,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Store, DroppingTransaction } from '../../types';

interface DroppingViewProps {
  activeTab: string;
}

// Fallback demo stores with machines for testing
const DEMO_DROPPING_STORES: Store[] = [
  {
    id: 'store-sby-01',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Toko Berkah Mandiri',
    address: 'Jl. Basuki Rahmat No. 12, Surabaya',
    owner_name: 'Pak Haji Ahmad',
    phone: '081234567890',
    latitude: -7.265,
    longitude: 112.742,
    status: 'terpasang',
    current_machine_id: 'm-sby-001',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: 'm-sby-001',
      machine_code: 'MSN-SBY-001',
      status: 'terpasang',
      current_store_id: 'store-sby-01',
      last_counter_meter: 100,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'store-sby-02',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Kedai Kopi Rezeki',
    address: 'Jl. Embong Malang No. 45, Surabaya',
    owner_name: 'Ibu Ratna',
    phone: '081298765432',
    latitude: -7.261,
    longitude: 112.738,
    status: 'terpasang',
    current_machine_id: 'm-sby-002',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: 'm-sby-002',
      machine_code: 'MSN-SBY-002',
      status: 'terpasang',
      current_store_id: 'store-sby-02',
      last_counter_meter: 250,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'store-sby-03',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Minimarket Barokah Jaya',
    address: 'Jl. Manyar Kertoarjo No. 88, Surabaya',
    owner_name: 'Pak Handoko',
    phone: '081377889900',
    latitude: -7.282,
    longitude: 112.765,
    status: 'terpasang',
    current_machine_id: 'm-sby-003',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: 'm-sby-003',
      machine_code: 'MSN-SBY-003',
      status: 'terpasang',
      current_store_id: 'store-sby-03',
      last_counter_meter: 410,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'store-sby-04',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Warkop Citra Rasa 24 Jam',
    address: 'Jl. Ngagel Jaya Selatan No. 19, Surabaya',
    owner_name: 'Mas Dwi',
    phone: '085611223344',
    latitude: -7.291,
    longitude: 112.752,
    status: 'terpasang',
    current_machine_id: 'm-sby-004',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: 'm-sby-004',
      machine_code: 'MSN-SBY-004',
      status: 'terpasang',
      current_store_id: 'store-sby-04',
      last_counter_meter: 85,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
];

export const DroppingView: React.FC<DroppingViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();
  const { currentBranch } = useBranch();

  // Active stores for selection
  const [activeStores, setActiveStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Foto Wajib (3 Foto Pertama di atas)
  const [photoMachine, setPhotoMachine] = useState<string | null>(null);             // 1. Wajib
  const [photoMachineNumber, setPhotoMachineNumber] = useState<string | null>(null); // 2. Wajib
  const [photoCoin, setPhotoCoin] = useState<string | null>(null);                   // 3. Wajib

  // 2. Checklist "Total Koin Terambil / Ambil Omset" Toggle (Default false: hanya pencocokan meteran)
  const [hasOmset, setHasOmset] = useState<boolean>(false);

  // 3. Kolom Omset & Odometer
  const [coinsCollectedStr, setCoinsCollectedStr] = useState<string>('');
  const [hasMismatch, setHasMismatch] = useState<boolean>(false);
  const [actualPhysicalMeterStr, setActualPhysicalMeterStr] = useState<string>('');
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');

  // Standalone Meter reading (jika tidak ambil omset - default ke prevMeter saat toko dipilih)
  const [noOmsetMeterStr, setNoOmsetMeterStr] = useState<string>('');

  // 4. Jatah Toko & Foto Nota
  const [storeShareStr, setStoreShareStr] = useState<string>('');
  const [photoNota, setPhotoNota] = useState<string | null>(null);                   // 4. Nota (di bagian omset)
  const [photoOptional, setPhotoOptional] = useState<string | null>(null);           // 5. Tambahan

  // GPS & Form Status
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Today's Droppings
  const [todayDroppings, setTodayDroppings] = useState<DroppingTransaction[]>([]);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // Selected store and machine metrics
  const selectedStore = activeStores.find((s) => s.id === selectedStoreId);
  const prevMeter = selectedStore?.machine?.last_counter_meter ?? 0;
  const coinsCollected = hasOmset ? (parseInt(coinsCollectedStr.replace(/[^0-9]/g, ''), 10) || 0) : 0;
  const grossOmset = coinsCollected * 1000;
  const calculatedNewMeter = prevMeter + coinsCollected;

  const actualPhysicalMeter = hasOmset
    ? hasMismatch
      ? parseInt(actualPhysicalMeterStr.replace(/[^0-9]/g, ''), 10) || null
      : calculatedNewMeter
    : (parseInt(noOmsetMeterStr.replace(/[^0-9]/g, ''), 10) || prevMeter);

  const meterDiscrepancy = actualPhysicalMeter !== null ? actualPhysicalMeter - calculatedNewMeter : 0;

  const storeShareAmount = hasOmset ? (parseInt(storeShareStr.replace(/[^0-9]/g, ''), 10) || 0) : 0;
  const netDepositAmount = Math.max(0, grossOmset - storeShareAmount);

  // Tab & Store Visit Filter Logic
  const isVisitTab = activeTab === 'store_visits' || activeTab === 'dropping_form';

  const filteredStores = activeStores.filter((st) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = st.name.toLowerCase().includes(q);
    const codeMatch = st.machine?.machine_code?.toLowerCase().includes(q) || false;
    const addrMatch = st.address.toLowerCase().includes(q);
    return nameMatch || codeMatch || addrMatch;
  });

  const visitedStoreIds = new Set(todayDroppings.map((d) => d.store_id));
  const visitedTodayCount = activeStores.filter((st) => visitedStoreIds.has(st.id)).length;
  const unvisitedTodayCount = Math.max(0, activeStores.length - visitedTodayCount);

  // Format IDR Currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Fetch active stores with machines
  const fetchActiveStores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          machine:machines(*)
        `)
        .eq('branch_id', activeBranchId)
        .in('status', ['terpasang', 'terkirim'])
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        setActiveStores(data as Store[]);
      } else {
        setActiveStores(DEMO_DROPPING_STORES);
      }
    } catch (err) {
      console.error('Error fetching active stores:', err);
      setActiveStores(DEMO_DROPPING_STORES);
    }
  }, [activeBranchId]);

  // Fetch today's transactions for this dropping user
  const fetchTodayDroppings = useCallback(async () => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name, address),
          machine:machines(machine_code)
        `)
        .eq('dropping_user_id', profile.id)
        .eq('transaction_date', today)
        .order('created_at', { ascending: false });

      if (data) setTodayDroppings(data as DroppingTransaction[]);

      // Check offline count
      const offlineCount = await offlineDb.offlineDroppings
        .where('sync_status')
        .equals('pending')
        .count();
      setOfflinePendingCount(offlineCount);
    } catch (err) {
      console.error('Error fetching today droppings:', err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchActiveStores();
    fetchTodayDroppings();

    // Auto-detect GPS on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [fetchActiveStores, fetchTodayDroppings]);

  // When store changes, default noOmsetMeterStr to prevMeter
  useEffect(() => {
    if (selectedStore) {
      setNoOmsetMeterStr(prevMeter.toString());
    }
  }, [selectedStoreId, prevMeter]);

  // Quick 10% Suggestion
  const handleQuick10Percent = () => {
    const suggested = Math.round((grossOmset * 10) / 100);
    setStoreShareStr(suggested.toString());
  };

  const resetForm = () => {
    setSelectedStoreId('');
    setHasOmset(false);
    setCoinsCollectedStr('');
    setHasMismatch(false);
    setActualPhysicalMeterStr('');
    setDiscrepancyReason('');
    setNoOmsetMeterStr('');
    setStoreShareStr('');
    setPhotoMachine(null);
    setPhotoMachineNumber(null);
    setPhotoCoin(null);
    setPhotoNota(null);
    setPhotoOptional(null);
  };

  // Handle Offline Synchronization
  const syncOfflineRecords = async () => {
    if (!navigator.onLine) {
      alert('Perangkat Anda masih dalam keadaan offline. Cari sinyal terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    try {
      const pendingRecords = await offlineDb.offlineDroppings
        .where('sync_status')
        .equals('pending')
        .toArray();

      for (const rec of pendingRecords) {
        if (!rec.localId) continue;

        try {
          const [urlMachine, urlMachineNumber, urlCoin, urlNota, urlOptional] = await Promise.all([
            uploadToCloudinary(rec.photo_machine_blob || '', 'droppings/machine'),
            uploadToCloudinary(rec.photo_machine_number_blob || '', 'droppings/machine_number'),
            uploadToCloudinary(rec.photo_coin_blob || '', 'droppings/coin'),
            rec.photo_nota_blob ? uploadToCloudinary(rec.photo_nota_blob, 'droppings/nota') : Promise.resolve(null),
            rec.photo_optional_blob ? uploadToCloudinary(rec.photo_optional_blob, 'droppings/optional') : Promise.resolve(null),
          ]);

          const { error } = await supabase.from('droppings').insert({
            branch_id: rec.branch_id || activeBranchId,
            dropping_user_id: rec.dropping_user_id,
            store_id: rec.store_id,
            machine_id: rec.machine_id,
            has_omset: rec.has_omset,
            coins_collected: rec.coins_collected ?? 0,
            previous_counter_meter: rec.previous_counter_meter ?? 0,
            actual_physical_meter: rec.actual_physical_meter,
            discrepancy_reason: rec.discrepancy_reason,
            store_share_amount: rec.store_share_amount ?? 0,
            photo_machine_url: urlMachine,
            photo_machine_number_url: urlMachineNumber,
            photo_coin_url: urlCoin,
            photo_machine_meter_url: urlMachineNumber || urlMachine,
            photo_coin_tray_url: urlCoin,
            photo_nota_url: urlNota,
            photo_optional_url: urlOptional,
            latitude: rec.latitude,
            longitude: rec.longitude,
          });

          if (!error) {
            await offlineDb.offlineDroppings.update(rec.localId, { sync_status: 'synced' });
          }
        } catch (syncErr) {
          console.error('Sync item error:', syncErr);
        }
      }

      fetchTodayDroppings();
      alert('Sinkronisasi data offline selesai!');
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Submit Dropping Form
  const handleSubmitDropping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedStoreId) {
      alert('Silakan pilih toko mitra yang dikunjungi.');
      return;
    }

    // 1. Validasi 3 Foto Wajib Terlebih Dahulu
    if (!photoMachine) {
      alert('Wajib melampirkan Foto 1: Foto Mesin / Boneka.');
      return;
    }
    if (!photoMachineNumber) {
      alert('Wajib melampirkan Foto 2: Foto Nomor Mesin.');
      return;
    }
    if (!photoCoin) {
      alert('Wajib melampirkan Foto 3: Foto Koin.');
      return;
    }

    // 2. Validasi Omset jika checklist dicentang, atau validasi meteran jika tidak dicentang
    if (hasOmset) {
      if (coinsCollected <= 0) {
        alert('Karena checklist penarikan koin dicentang, masukkan total koin terambil di laci (harus lebih dari 0).');
        return;
      }

      if (hasMismatch && !discrepancyReason.trim()) {
        alert('Ada selisih meteran fisik! Wajib mengisi kolom Catatan Kendala Selisih.');
        return;
      }
    } else {
      if (!noOmsetMeterStr.trim()) {
        alert('Silakan masukkan angka meteran yang terbaca di mesin saat ini.');
        return;
      }
    }

    const store = activeStores.find((s) => s.id === selectedStoreId);
    if (!store || !store.current_machine_id) {
      alert('Toko ini tidak memiliki unit mesin aktif.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);

    const finalMeterReading = hasOmset
      ? (actualPhysicalMeter ?? calculatedNewMeter)
      : (parseInt(noOmsetMeterStr, 10) || prevMeter);

    // If offline, save directly to IndexedDB
    if (!navigator.onLine) {
      try {
        await offlineDb.offlineDroppings.add({
          branch_id: activeBranchId,
          dropping_user_id: profile.id,
          store_id: store.id,
          store_name: store.name,
          machine_id: store.current_machine_id,
          machine_code: store.machine?.machine_code || '',
          has_omset: hasOmset,
          coins_collected: hasOmset ? coinsCollected : 0,
          previous_counter_meter: prevMeter,
          actual_physical_meter: finalMeterReading,
          discrepancy_reason: hasOmset && hasMismatch ? discrepancyReason.trim() : null,
          store_share_amount: hasOmset ? storeShareAmount : 0,
          photo_machine_blob: photoMachine,
          photo_machine_number_blob: photoMachineNumber,
          photo_coin_blob: photoCoin,
          photo_nota_blob: photoNota,
          photo_optional_blob: photoOptional,
          latitude,
          longitude,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
        });

        confetti({ particleCount: 50, spread: 60 });
        setSubmitSuccess('Tersimpan secara OFFLINE di HP! Data akan terunggah otomatis saat Anda terhubung ke internet.');
        resetForm();
        fetchTodayDroppings();
      } catch (dbErr: any) {
        alert('Gagal menyimpan offline: ' + dbErr.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If online, upload to Cloudinary & insert to Supabase
    try {
      const [urlMachine, urlMachineNumber, urlCoin, urlNota, urlOptional] = await Promise.all([
        uploadToCloudinary(photoMachine, 'droppings/machine'),
        uploadToCloudinary(photoMachineNumber, 'droppings/machine_number'),
        uploadToCloudinary(photoCoin, 'droppings/coin'),
        photoNota ? uploadToCloudinary(photoNota, 'droppings/nota') : Promise.resolve(null),
        photoOptional ? uploadToCloudinary(photoOptional, 'droppings/optional') : Promise.resolve(null),
      ]);

      const payload = {
        branch_id: activeBranchId,
        dropping_user_id: profile.id,
        store_id: store.id,
        machine_id: store.current_machine_id,
        has_omset: hasOmset,
        coins_collected: hasOmset ? coinsCollected : 0,
        previous_counter_meter: prevMeter,
        actual_physical_meter: finalMeterReading,
        discrepancy_reason: hasOmset && hasMismatch ? discrepancyReason.trim() : null,
        store_share_amount: hasOmset ? storeShareAmount : 0,
        photo_machine_url: urlMachine,
        photo_machine_number_url: urlMachineNumber,
        photo_coin_url: urlCoin,
        photo_machine_meter_url: urlMachineNumber || urlMachine,
        photo_coin_tray_url: urlCoin,
        photo_nota_url: urlNota,
        photo_optional_url: urlOptional,
        latitude,
        longitude,
      };

      const { error } = await supabase.from('droppings').insert(payload);

      if (error) {
        console.warn('DB dropping insert fallback:', error);
      }

      // Update machine's last_counter_meter
      await supabase
        .from('machines')
        .update({ last_counter_meter: finalMeterReading })
        .eq('id', store.current_machine_id);

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setSubmitSuccess(
        hasOmset
          ? `Sukses! Dropping "${store.name}" berhasil dicatat: ${coinsCollected} Koin (${formatIDR(grossOmset)}). Setoran bersih: ${formatIDR(netDepositAmount)}.`
          : `Sukses! Kunjungan toko "${store.name}" (pencocokan meteran: ${finalMeterReading}) berhasil dicatat.`
      );
      resetForm();
      fetchTodayDroppings();
      fetchActiveStores();
    } catch (err: any) {
      console.error('Dropping error:', err);
      alert(err.message || 'Gagal menyimpan transaksi dropping.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations for today's summary tab
  const totalTodayCoins = todayDroppings.reduce((acc, curr) => acc + (curr.coins_collected || 0), 0);
  const totalTodayGross = todayDroppings.reduce((acc, curr) => acc + (curr.gross_omset || 0), 0);
  const totalTodayStoreShare = todayDroppings.reduce((acc, curr) => acc + (curr.store_share_amount || 0), 0);
  const totalTodayNet = todayDroppings.reduce((acc, curr) => acc + (curr.net_deposit_amount || 0), 0);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      {/* Offline Pending Badge */}
      {offlinePendingCount > 0 && (
        <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200 shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <CloudUpload className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Ada {offlinePendingCount} data tersimpan offline di HP Anda</span>
          </div>
          <button
            type="button"
            disabled={isSyncing}
            onClick={syncOfflineRecords}
            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Mengunggah...' : 'Unggah Sekarang'}
          </button>
        </div>
      )}

      {isVisitTab ? (
        !selectedStoreId ? (
          /* ======================================================== */
          /* 1. HALAMAN LIST KUNJUNGAN TOKO MITRA                     */
          /* ======================================================== */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <StoreIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Daftar Kunjungan Toko Mitra
                </h2>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {currentBranch?.name || 'Cabang'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                Pilih toko mitra untuk mencatat pencocokan meteran mesin dan penarikan koin omset hari ini.
              </p>

              {/* Metric Pills */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">Total Toko</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{activeStores.length}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">Dikunjungi</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">{visitedTodayCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block">Belum</span>
                  <span className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">{unvisitedTodayCount}</span>
                </div>
              </div>
            </div>

            {submitSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(null)}
                  className="text-[11px] font-bold underline cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Cari nama toko, kode mesin, atau alamat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* Stores List */}
            <div className="space-y-3">
              {filteredStores.map((store) => {
                const todayTx = todayDroppings.find((t) => t.store_id === store.id);
                const isVisited = Boolean(todayTx);

                return (
                  <div
                    key={store.id}
                    className={`p-4 rounded-2xl border transition shadow-xs ${
                      isVisited
                        ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {store.name}
                          </h3>
                          {isVisited ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Sudah Dikunjungi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              <Clock className="w-3 h-3" />
                              Belum Dikunjungi
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{store.address}</span>
                        </p>
                      </div>
                    </div>

                    {/* Machine & Meter Info */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                          Unit Mesin:
                        </span>
                        <span className="font-extrabold font-mono text-slate-900 dark:text-white">
                          {store.machine?.machine_code || 'Tanpa Mesin'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                          Meteran Terakhir:
                        </span>
                        <span className="font-black font-mono text-indigo-700 dark:text-indigo-400">
                          {(store.machine?.last_counter_meter ?? 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* If visited today, show brief summary */}
                    {isVisited && todayTx && (
                      <div className="mt-2.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center justify-between font-semibold">
                        <span>Kunjungan Hari Ini:</span>
                        <span className="font-bold">
                          {todayTx.has_omset
                            ? `${todayTx.coins_collected} Koin (${formatIDR(todayTx.gross_omset || 0)})`
                            : `Meteran dicocokkan: ${todayTx.actual_physical_meter}`}
                        </span>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStoreId(store.id);
                          setNoOmsetMeterStr(store.machine?.last_counter_meter?.toString() || '0');
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-xs ${
                          isVisited
                            ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        }`}
                      >
                        <span>{isVisited ? 'Update / Kunjungi Ulang Toko' : 'Mulai Kunjungan & Dropping'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredStores.length === 0 && (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-2">
                  <StoreIcon className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold">Tidak ada toko mitra yang cocok dengan pencarian "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* 2. STATE INPUT DROPPING (Setelah Toko Dipilih Dari List)  */
          /* ======================================================== */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Top Navigation: Tombol Kembali ke Daftar Toko */}
            <div className="flex items-center justify-between pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedStoreId('');
                  resetForm();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Daftar Toko</span>
              </button>
              <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 font-mono">
                Unit: {selectedStore?.machine?.machine_code}
              </span>
            </div>

            {/* Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Dropping Koin & Pencocokan Meteran
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                Ambil foto bukti wajib, verifikasi meteran, dan catat omset toko di {currentBranch?.name || 'Cabang'}.
              </p>
            </div>

            {submitSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDropping} className="space-y-4">
              {/* Toko Mitra Terpilih (NO DROPDOWN!) */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-slate-50 dark:from-slate-900 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl space-y-2 shadow-xs">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    Toko Mitra Terpilih:
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                    <StoreIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    {selectedStore?.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{selectedStore?.address}</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Meteran Terakhir Mesin:
                    </span>
                    <span className="text-base font-black font-mono text-indigo-950 dark:text-white">
                      {prevMeter.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Kode Unit Mesin:
                    </span>
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                      {selectedStore?.machine?.machine_code}
                    </span>
                  </div>
                </div>
              </div>

            {/* 2. Tiga Foto Wajib Terlebih Dahulu */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  3 Foto Wajib (Selesaikan Terlebih Dahulu)
                </h3>
              </div>

              {/* 1. Foto Mesin / Boneka */}
              <CameraCapture
                label="1. Foto Mesin / Boneka"
                subLabel="Ambil foto unit mesin dan boneka tampak depan"
                required={true}
                onPhotoCaptured={({ base64 }) => setPhotoMachine(base64)}
              />

              {/* 2. Foto Nomor Mesin */}
              <CameraCapture
                label="2. Foto Nomor Mesin"
                subLabel="Ambil foto plat kode / nomor unit mesin"
                required={true}
                onPhotoCaptured={({ base64 }) => setPhotoMachineNumber(base64)}
              />

              {/* 3. Foto Koin */}
              <CameraCapture
                label="3. Foto Koin"
                subLabel="Ambil foto fisik koin yang berada di mesin"
                required={true}
                onPhotoCaptured={({ base64 }) => setPhotoCoin(base64)}
              />
            </div>

            {/* 3. Section: Pencocokan Angka Meteran & Checklist Ambil Koin */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs transition-colors">
              {/* 1. Pencocokan Angka Meteran Mesin Saja (Diletakkan di atas) */}
              {!hasOmset && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-xs">
                      <Gauge className="w-4 h-4 text-indigo-500" />
                      <span>Pencocokan Angka Meteran Mesin Saja</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                      Tanpa Tarik Koin
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Kunjungan tanpa penarikan koin omset. Petugas hanya mencocokkan dan memperbarui angka meteran fisik mesin saat ini.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Angka Meteran Terbaca di Mesin Saat Ini *
                    </label>
                    <div className="relative">
                      <Gauge className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        inputMode="numeric"
                        required={!hasOmset}
                        value={noOmsetMeterStr}
                        onChange={(e) => setNoOmsetMeterStr(e.target.value)}
                        placeholder={prevMeter.toString()}
                        className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 dark:text-slate-400">
                      <span>Meteran terakhir sistem: <strong className="font-mono text-slate-700 dark:text-slate-300">{prevMeter.toLocaleString('id-ID')}</strong></span>
                      {selectedStore && (
                        <span>Unit: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedStore.machine?.machine_code}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Checklist Toggle Card (Diletakkan di bawah) */}
              <label className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                hasOmset
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/70 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}>
                <input
                  type="checkbox"
                  checked={hasOmset}
                  onChange={(e) => setHasOmset(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Ambil Koin di Laci (Tarik Omset)
                    </span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      hasOmset
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {hasOmset ? '✓ Dicentang' : 'Pencocokan Saja'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1 leading-relaxed">
                    {hasOmset
                      ? 'Dicentang: Kolom koin terambil, perhitungan omset, bagi hasil toko, dan foto nota aktif.'
                      : 'Klik untuk mencentang jika ada koin yang ditarik dari laci. Jika tidak dicentang, petugas hanya mencocokkan angka meteran saja.'}
                  </span>
                </div>
              </label>

              {/* JIKA CENTANG: Muncul Kolom Koin, Kalkulasi Omset, Bagi Hasil Toko & Foto Nota */}
              {hasOmset && (
                <div className="space-y-4 animate-in fade-in duration-200 pt-1">
                  {/* Input Total Koin Terambil */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Total Koin Terambil di Laci *
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        1 Koin = Rp 1.000
                      </span>
                    </div>
                    <div className="relative">
                      <Coins className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        inputMode="numeric"
                        required={hasOmset}
                        placeholder="Contoh: 30"
                        value={coinsCollectedStr}
                        onChange={(e) => setCoinsCollectedStr(e.target.value)}
                        className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Auto Calculations Summary (Target Odometer & Gross Omset) */}
                  {coinsCollected > 0 && (
                    <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          Target Meteran Baru ({prevMeter.toLocaleString('id-ID')} + {coinsCollected.toLocaleString('id-ID')} koin):
                        </span>
                        <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                          {calculatedNewMeter.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-400 font-bold">
                          Total Omset Kotor (100%):
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatIDR(grossOmset)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pencocokan Meteran Fisik & Selisih Toleransi */}
                  {coinsCollected > 0 && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Kesesuaian Meteran Fisik Mesin
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setHasMismatch(!hasMismatch);
                            if (!hasMismatch) setActualPhysicalMeterStr(calculatedNewMeter.toString());
                          }}
                          className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            hasMismatch
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                          }`}
                        >
                          {hasMismatch ? '⚠️ Ada Selisih' : '✓ Cocok Sempurna'}
                        </button>
                      </div>

                      {hasMismatch && (
                        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Angka Meteran Fisik Aktual di Mesin *
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              required
                              value={actualPhysicalMeterStr}
                              onChange={(e) => setActualPhysicalMeterStr(e.target.value)}
                              placeholder={`Contoh: ${calculatedNewMeter + 5}`}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          {actualPhysicalMeter !== null && (
                            <div className="text-xs font-bold flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <span>Selisih Odometer:</span>
                              <span className="font-mono">
                                {meterDiscrepancy > 0 ? `+${meterDiscrepancy}` : meterDiscrepancy} Koin
                              </span>
                            </div>
                          )}

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Catatan Kendala / Alasan Selisih *
                            </label>
                            <textarea
                              required
                              rows={2}
                              value={discrepancyReason}
                              onChange={(e) => setDiscrepancyReason(e.target.value)}
                              placeholder="Contoh: Koin nyangkut di coin mech atau koin tes teknisi..."
                              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bagi Hasil Jatah Toko */}
                  {coinsCollected > 0 && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Bagi Hasil Jatah Toko
                          </span>
                        </div>
                        {/* Quick 10% Button */}
                        <button
                          type="button"
                          onClick={handleQuick10Percent}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Hitung Cepat 10% ({formatIDR(Math.round(grossOmset * 0.1))})</span>
                        </button>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Nominal Jatah Toko (Diserahkan ke Toko) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required={hasOmset}
                          placeholder="Contoh: 3000"
                          value={storeShareStr}
                          onChange={(e) => setStoreShareStr(e.target.value)}
                          className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Net Deposit Takeaway Card */}
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white space-y-1 shadow-md">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-90 block">
                          Uang Setoran Dibawa Pulang (Disetor ke Admin Cabang):
                        </span>
                        <span className="text-xl font-black block tracking-tight">
                          {formatIDR(netDepositAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Foto Nota / Kuitansi Toko (Hanya muncul ketika checklist koin aktif) */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <CameraCapture
                      label="Foto Nota / Kuitansi Toko (Wajib dengan Omset)"
                      subLabel="Ambil foto nota penyerahan bagi hasil yang ditandatangani pihak toko"
                      required={false}
                      onPhotoCaptured={({ base64 }) => setPhotoNota(base64)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Foto Tambahan / Opsional */}
            <div className="pt-1">
              <CameraCapture
                label="Foto Tambahan (Opsional)"
                subLabel="Ambil foto tambahan jika ada kondisi khusus mesin atau toko"
                required={false}
                onPhotoCaptured={({ base64 }) => setPhotoOptional(base64)}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition disabled:opacity-50 touch-target cursor-pointer"
            >
              {isSubmitting ? (
                <span>Menyimpan Transaksi...</span>
              ) : (
                <>
                  <span>
                    {hasOmset
                      ? `Simpan Dropping & Omset (${formatIDR(grossOmset)})`
                      : 'Simpan Kunjungan & Verifikasi Meteran'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )
    ) : (
        /* Rekap Hari Ini Tab */
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Rekap Dropping Saya</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Hari ini: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchTodayDroppings}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block">
                Total Koin
              </span>
              <span className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1 block">
                {totalTodayCoins.toLocaleString('id-ID')}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {formatIDR(totalTodayGross)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block">
                Setoran Dibawa Pulang
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatIDR(totalTodayNet)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                Jatah Toko: {formatIDR(totalTodayStoreShare)}
              </span>
            </div>
          </div>

          {/* List Transactions */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Riwayat Transaksi Toko ({todayDroppings.length})
            </h3>

            {todayDroppings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
                <Calendar className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold">Belum ada transaksi dropping hari ini.</p>
              </div>
            ) : (
              todayDroppings.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {item.store?.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.machine?.machine_code} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      {item.has_omset !== false ? `+${item.coins_collected} Koin` : 'Tanpa Omset'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 font-medium">
                    <span className="text-slate-500 dark:text-slate-400">Setoran Bawa Pulang:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white font-mono">
                      {formatIDR(item.net_deposit_amount || 0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
