import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { offlineDb } from '../../lib/db';
import { CameraCapture } from '../../components/CameraCapture';
import { MultiStepCameraModal } from '../../components/MultiStepCameraModal';
import type { PhotoStepItem } from '../../components/MultiStepCameraModal';
import { BottomSheetModal } from '../../components/BottomSheetModal';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Coins,
  Store as StoreIcon,
  CheckCircle2,
  RefreshCw,
  Trash2,
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
  Camera,
  Info,
  X,
  ExternalLink,
  Eye,
  History,
  Receipt,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Store, DroppingTransaction } from '../../types';
import { toast } from '../../context/ToastContext';
import { useMobileBackHandler } from '../../hooks/useMobileBackHandler';
import { displayMachineCode } from '../../lib/machineCodeLogic';

interface DroppingViewProps {
  activeTab: string;
  tabClickTick?: number;
}

// Fallback demo stores with machines for testing
const DEMO_DROPPING_STORES: Store[] = [
  {
    id: '22222222-0000-0000-0000-000000000001',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Toko Berkah Mandiri',
    address: 'Jl. Basuki Rahmat No. 12, Surabaya',
    owner_name: 'Pak Haji Ahmad',
    phone: '081234567890',
    latitude: -7.265,
    longitude: 112.742,
    status: 'terpasang',
    current_machine_id: '11111111-0000-0000-0000-000000000001',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: '11111111-0000-0000-0000-000000000001',
      machine_code: 'MSN-SBY-001',
      status: 'terpasang',
      current_store_id: '22222222-0000-0000-0000-000000000001',
      last_counter_meter: 100,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: '22222222-0000-0000-0000-000000000002',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Kedai Kopi Rezeki',
    address: 'Jl. Embong Malang No. 45, Surabaya',
    owner_name: 'Ibu Ratna',
    phone: '081298765432',
    latitude: -7.261,
    longitude: 112.738,
    status: 'terpasang',
    current_machine_id: '11111111-0000-0000-0000-000000000002',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: '11111111-0000-0000-0000-000000000002',
      machine_code: 'MSN-SBY-002',
      status: 'terpasang',
      current_store_id: '22222222-0000-0000-0000-000000000002',
      last_counter_meter: 1234,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: '22222222-0000-0000-0000-000000000003',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Minimarket Barokah Jaya',
    address: 'Jl. Manyar Kertoarjo No. 88, Surabaya',
    owner_name: 'Pak Handoko',
    phone: '081377889900',
    latitude: -7.282,
    longitude: 112.765,
    status: 'terpasang',
    current_machine_id: '11111111-0000-0000-0000-000000000003',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: '11111111-0000-0000-0000-000000000003',
      machine_code: 'MSN-SBY-003',
      status: 'terpasang',
      current_store_id: '22222222-0000-0000-0000-000000000003',
      last_counter_meter: 410,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: '22222222-0000-0000-0000-000000000004',
    branch_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Toko Kelontong Bu Siti',
    address: 'Jl. Ngagel Jaya Selatan No. 19, Surabaya',
    owner_name: 'Mas Dwi',
    phone: '085611223344',
    latitude: -7.291,
    longitude: 112.752,
    status: 'terpasang',
    current_machine_id: '11111111-0000-0000-0000-000000000004',
    photo_store_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    machine: {
      id: '11111111-0000-0000-0000-000000000004',
      machine_code: 'MSN-SBY-004',
      status: 'terpasang',
      current_store_id: '22222222-0000-0000-0000-000000000004',
      last_counter_meter: 85,
      notes: null,
      created_at: new Date().toISOString(),
    },
  },
];

export const DroppingView: React.FC<DroppingViewProps> = ({ activeTab, tabClickTick = 0 }) => {
  const { profile, activeRole } = useAuth();
  const { currentBranch } = useBranch();

  // Active stores for selection
  const [activeStores, setActiveStores] = useState<Store[]>([]);

  // Selected store (persisted to sessionStorage to survive mobile reloads)
  const [selectedStoreId, setSelectedStoreIdState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('topcoin_active_store_id') || '';
    } catch {
      return '';
    }
  });

  const setSelectedStoreId = (id: string) => {
    setSelectedStoreIdState(id);
    try {
      if (id) {
        sessionStorage.setItem('topcoin_active_store_id', id);
      } else {
        sessionStorage.removeItem('topcoin_active_store_id');
      }
    } catch {
      // ignore
    }
  };
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Foto Wajib (3 Foto Pertama di atas)
  const [photoMachine, setPhotoMachine] = useState<string | null>(null);             // 1. Wajib
  const [photoMachineNumber, setPhotoMachineNumber] = useState<string | null>(null); // 2. Wajib
  const [photoCoin, setPhotoCoin] = useState<string | null>(null);                   // 3. Wajib

  // Multi-step connected camera modal state
  const [isMultiStepCameraOpen, setIsMultiStepCameraOpen] = useState(false);
  const [multiStepStartIndex, setMultiStepStartIndex] = useState(0);

  // 2. Checklist "Total Koin Terambil / Ambil Omset" Toggle (Default false: hanya pencocokan meteran)
  const [hasOmset, setHasOmset] = useState<boolean>(false);

  // Daftar langkah foto wajib dinamis: jika Tarik Omset DICENTANG, Foto Koin diganti dengan Foto Nota
  const mandatoryPhotoSteps: PhotoStepItem[] = useMemo(() => {
    const baseSteps: PhotoStepItem[] = [
      {
        key: 'photoMachine',
        label: 'Foto Mesin / Boneka',
        subLabel: 'Ambil foto unit mesin dan boneka tampak depan',
        required: true,
      },
      {
        key: 'photoMachineNumber',
        label: 'Foto Nomor Mesin',
        subLabel: 'Ambil foto plat kode / nomor unit mesin',
        required: true,
      },
    ];

    if (hasOmset) {
      baseSteps.push({
        key: 'photoNota',
        label: 'Foto Nota / Kuitansi',
        subLabel: 'Ambil foto nota tertulis yang ditandatangani toko',
        required: true,
      });
    } else {
      baseSteps.push({
        key: 'photoCoin',
        label: 'Foto Koin',
        subLabel: 'Ambil foto fisik koin yang berada di mesin',
        required: true,
      });
    }

    return baseSteps;
  }, [hasOmset]);

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
  const [hasOptional, setHasOptional] = useState<boolean>(false);                    // Toggle Opsional (Kamera & Catatan)
  const [isStoreClosed, setIsStoreClosed] = useState<boolean>(false);                // Kendala Toko Tutup
  const [isMinimalCoin, setIsMinimalCoin] = useState<boolean>(false);                // Kendala Minimal Koin (MK)
  const [photoOptional, setPhotoOptional] = useState<string | null>(null);           // 5. Tambahan
  const [optionalNotes, setOptionalNotes] = useState<string>('');

  // GPS & Form Status
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState<boolean>(false);

  // Today's Droppings
  const [todayDroppings, setTodayDroppings] = useState<DroppingTransaction[]>([]);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Detail Modal & Tracking History State
  const [detailModalStore, setDetailModalStore] = useState<Store | null>(null);
  const [storeHistoryDroppings, setStoreHistoryDroppings] = useState<DroppingTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [activePreviewImage, setActivePreviewImage] = useState<{ url: string; title: string } | null>(null);

  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // Navigasi Back bawaan HP: Jika Lightbox Foto terbuka, tutup lightbox
  useMobileBackHandler({
    enabled: Boolean(activePreviewImage),
    onBack: () => {
      setActivePreviewImage(null);
    },
  });

  // Navigasi Back bawaan HP: Jika berada di Form Input Dropping, kembali ke Daftar Toko
  useMobileBackHandler({
    enabled: Boolean(selectedStoreId),
    onBack: () => {
      setSelectedStoreId('');
    },
  });

  // Selected store and machine metrics
  const selectedStore = activeStores.find((s) => s.id === selectedStoreId);
  const storeTodayDropping = todayDroppings.find((d) => d.store_id === selectedStoreId);
  const prevMeter = storeTodayDropping?.actual_physical_meter ?? selectedStore?.machine?.last_counter_meter ?? 0;
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

  // Menghitung daftar field yang belum diisi untuk feedback dinamis & validasi tombol Simpan
  const missingFields = useMemo(() => {
    const list: string[] = [];

    // 1. JALUR KENDALA / OPSIONAL (Bypass Foto Wajib)
    if (hasOptional) {
      const hasAnyOptionalContent = Boolean(
        isStoreClosed ||
        isMinimalCoin ||
        photoOptional ||
        optionalNotes.trim().length > 0
      );

      if (!hasAnyOptionalContent) {
        list.push('Pilihan Kendala / Foto / Catatan');
      }

      if (hasOmset) {
        if (coinsCollected <= 0) list.push('Total Koin');
        if (!photoNota) list.push('Foto Nota');
        if (hasMismatch) {
          if (actualPhysicalMeter === null) list.push('Meteran Fisik');
          if (!discrepancyReason.trim()) list.push('Alasan Selisih');
        }
      }

      return list;
    }

    // 2. JALUR NORMAL (Foto Wajib harus lengkap)
    if (!photoMachine) list.push('Foto Mesin');
    if (!photoMachineNumber) list.push('Foto No. Mesin');
    if (!hasOmset && !photoCoin) list.push('Foto Koin');

    if (hasOmset) {
      if (coinsCollected <= 0) list.push('Total Koin');
      if (!photoNota) list.push('Foto Nota');
      if (hasMismatch) {
        if (actualPhysicalMeter === null) list.push('Meteran Fisik');
        if (!discrepancyReason.trim()) list.push('Alasan Selisih');
      }
    } else {
      if (!noOmsetMeterStr.trim()) list.push('Angka Meteran');
    }

    return list;
  }, [
    hasOptional,
    isStoreClosed,
    isMinimalCoin,
    photoOptional,
    optionalNotes,
    photoMachine,
    photoMachineNumber,
    photoCoin,
    hasOmset,
    coinsCollected,
    photoNota,
    hasMismatch,
    discrepancyReason,
    actualPhysicalMeter,
    noOmsetMeterStr,
  ]);

  const isFormValid = missingFields.length === 0;

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


  // Format IDR Currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Format Tanggal & Jam (WIB)
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

  // Fetch riwayat transaksi dropping toko yang sedang dibuka di modal
  useEffect(() => {
    if (!detailModalStore) {
      setStoreHistoryDroppings([]);
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
            dropping_user:user_profiles(full_name)
          `)
          .eq('store_id', detailModalStore.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (isMounted) {
          if (!error && data && data.length > 0) {
            setStoreHistoryDroppings(data as DroppingTransaction[]);
          } else {
            // Fallback gunakan data todayDroppings jika ada
            const todayMatch = todayDroppings.filter(
              (t) => t.store_id === detailModalStore.id
            );
            setStoreHistoryDroppings(todayMatch);
          }
        }
      } catch (err) {
        console.warn('Error fetching store history:', err);
        if (isMounted) {
          const todayMatch = todayDroppings.filter(
            (t) => t.store_id === detailModalStore.id
          );
          setStoreHistoryDroppings(todayMatch);
        }
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [detailModalStore, todayDroppings]);

  // Handler Buka Chat WhatsApp Toko
  const handleOpenWhatsApp = (store: Store) => {
    if (!store.phone) {
      toast.error(`Nomor WhatsApp untuk toko "${store.name}" belum terdaftar.`);
      return;
    }
    let cleaned = store.phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    const message = `Halo ${store.owner_name ? store.owner_name + ' ' : ''}(${store.name}), saya teknisi dropping TopCoin ingin konfirmasi terkait kunjungan ke toko hari ini.`;
    const waUrl = `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Handler Buka Google Maps Lokasi Toko
  const handleOpenMaps = (store: Store) => {
    let mapsUrl = '';
    if (store.latitude && store.longitude) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`;
    } else if (store.address) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.name}, ${store.address}`)}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name)}`;
    }
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Fetch active stores with machines
  const fetchActiveStores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          machine:machines!stores_current_machine_id_fkey(*)
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

  // Fetch today's transactions for the active branch (syncs across all field staff & roles)
  const fetchTodayDroppings = useCallback(async () => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name, address),
          machine:machines(machine_code)
        `)
        .eq('transaction_date', today)
        .order('created_at', { ascending: false });

      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Error fetching today droppings from Supabase:', error);
      }

      const list: DroppingTransaction[] = data ? (data as DroppingTransaction[]) : [];

      // Also merge any pending offline records from Dexie.js
      try {
        const offlinePending = await offlineDb.offlineDroppings.toArray();

        if (offlinePending && offlinePending.length > 0) {
          const existingStoreIds = new Set(list.map((t) => t.store_id));
          for (const off of offlinePending) {
            if (!existingStoreIds.has(off.store_id)) {
              list.push({
                id: off.id || `offline-${off.store_id}`,
                branch_id: off.branch_id || activeBranchId,
                dropping_user_id: off.dropping_user_id,
                store_id: off.store_id,
                machine_id: off.machine_id,
                has_omset: Boolean(off.has_omset),
                coins_collected: off.coins_collected || 0,
                gross_omset: off.gross_omset || (off.coins_collected ? off.coins_collected * 1000 : 0),
                previous_counter_meter: off.previous_counter_meter || 0,
                actual_physical_meter: off.actual_physical_meter,
                store_share_amount: off.store_share_amount || 0,
                net_deposit_amount: Math.max(0, (off.gross_omset || (off.coins_collected ? off.coins_collected * 1000 : 0)) - (off.store_share_amount || 0)),
                photo_machine_url: off.photo_machine_blob || '',
                photo_machine_number_url: off.photo_machine_number_blob || '',
                photo_coin_url: off.photo_coin_blob || '',
                photo_nota_url: off.photo_nota_blob || null,
                photo_optional_url: off.photo_optional_blob || null,
                optional_notes: off.optional_notes || null,
                transaction_date: today,
                created_at: off.created_at,
              } as any);
            }
          }
        }
      } catch (offErr) {
        console.warn('Error reading offline droppings:', offErr);
      }

      setTodayDroppings(list);

      // Check offline count
      const offlineCount = await offlineDb.offlineDroppings
        .where('sync_status')
        .equals('pending')
        .count();
      setOfflinePendingCount(offlineCount);
    } catch (err) {
      console.error('Error fetching today droppings:', err);
    }
  }, [profile?.id, activeBranchId]);

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
        () => { },
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
    setSubmitAttempted(false);
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
    setHasOptional(false);
    setIsStoreClosed(false);
    setIsMinimalCoin(false);
    setPhotoOptional(null);
    setOptionalNotes('');
  };

  // Jika tombol navigasi bottom "Tugas" diklik saat berada di halaman form dropping,
  // otomatis reset form dan kembali ke halaman daftar tugas toko mitra
  useEffect(() => {
    if (tabClickTick > 0 && activeTab === 'store_visits') {
      resetForm();
    }
  }, [tabClickTick]);

  // Handle Offline Synchronization
  const syncOfflineRecords = useCallback(async () => {
    if (!navigator.onLine) {
      toast.warning('Perangkat Anda masih dalam keadaan offline. Cari sinyal terlebih dahulu.');
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const pendingRecords = await offlineDb.offlineDroppings
        .where('sync_status')
        .equals('pending')
        .toArray();

      for (const rec of pendingRecords) {
        if (!rec.localId) continue;

        try {
          // Upload paralel ke Cloudinary hanya untuk foto yang tersedia
          const [urlMachine, urlMachineNumber, urlCoin, urlNota, urlOptional] = await Promise.all([
            rec.photo_machine_blob ? uploadToCloudinary(rec.photo_machine_blob, 'droppings/machine') : Promise.resolve(null),
            rec.photo_machine_number_blob ? uploadToCloudinary(rec.photo_machine_number_blob, 'droppings/machine_number') : Promise.resolve(null),
            rec.photo_coin_blob ? uploadToCloudinary(rec.photo_coin_blob, 'droppings/coin') : Promise.resolve(null),
            rec.photo_nota_blob ? uploadToCloudinary(rec.photo_nota_blob, 'droppings/nota') : Promise.resolve(null),
            rec.photo_optional_blob ? uploadToCloudinary(rec.photo_optional_blob, 'droppings/optional') : Promise.resolve(null),
          ]);

          const today = new Date().toISOString().split('T')[0];
          const { error } = await supabase.from('droppings').insert({
            branch_id: rec.branch_id || activeBranchId,
            dropping_user_id: rec.dropping_user_id,
            store_id: rec.store_id,
            machine_id: rec.machine_id,
            has_omset: Boolean(rec.has_omset),
            coins_collected: rec.coins_collected ?? 0,
            gross_omset: rec.gross_omset ?? ((rec.coins_collected || 0) * 1000),
            previous_counter_meter: rec.previous_counter_meter ?? 0,
            actual_physical_meter: rec.actual_physical_meter,
            has_mismatch: Boolean(rec.has_mismatch),
            discrepancy_reason: rec.discrepancy_reason,
            store_share_amount: rec.store_share_amount ?? 0,
            photo_machine_url: urlMachine,
            photo_machine_number_url: urlMachineNumber,
            photo_coin_url: urlCoin,
            photo_machine_meter_url: urlMachineNumber || urlMachine,
            photo_coin_tray_url: urlCoin,
            photo_nota_url: urlNota,
            photo_optional_url: urlOptional,
            optional_notes: rec.optional_notes || null,
            latitude: rec.latitude,
            longitude: rec.longitude,
            transaction_date: today,
          });

          if (!error) {
            successCount++;
            // Bersihkan blob foto dari IndexedDB lokal setelah sukses tersinkron agar memori HP teknisi tidak boros
            await offlineDb.offlineDroppings.update(rec.localId, {
              sync_status: 'synced',
              photo_machine_blob: null,
              photo_machine_number_blob: null,
              photo_coin_blob: null,
              photo_nota_blob: null,
              photo_optional_blob: null,
            });
          } else {
            failCount++;
            console.error('Supabase sync error:', error);
          }
        } catch (syncErr) {
          failCount++;
          console.error('Sync item error:', syncErr);
        }
      }

      await fetchTodayDroppings();
      if (successCount > 0 && failCount === 0) {
        toast.success(`Berhasil mengunggah ${successCount} data offline ke server!`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} data berhasil diunggah, ${failCount} data masih menunggu koneksi stabil.`);
      } else if (failCount > 0) {
        toast.error('Gagal mengunggah data offline. Periksa kembali sinyal internet Anda.');
      } else {
        toast.info('Semua data offline sudah tersinkron.');
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Terjadi kesalahan saat memproses data offline.');
    } finally {
      setIsSyncing(false);
    }
  }, [activeBranchId, fetchTodayDroppings]);

  // Submit Dropping Form
  const handleSubmitDropping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!selectedStoreId) {
      toast.warning('Silakan pilih toko mitra yang dikunjungi.');
      return;
    }

    // Jika form belum valid, aktifkan penanda error warna merah pada kolom yang belum diisi
    if (!isFormValid) {
      setSubmitAttempted(true);
      toast.warning('Silakan lengkapi kolom yang berwarna merah.');
      return;
    }

    // 1. Validasi Foto Wajib (Hanya jika TIDAK memilih jalur kendala / opsional)
    if (!hasOptional) {
      if (!photoMachine) {
        toast.warning('Wajib melampirkan Foto 1: Foto Mesin / Boneka.');
        return;
      }
      if (!photoMachineNumber) {
        toast.warning('Wajib melampirkan Foto 2: Foto Nomor Mesin.');
        return;
      }
      // Jika tidak tarik omset, Foto Koin wajib diisi
      if (!hasOmset && !photoCoin) {
        toast.warning('Wajib melampirkan Foto 3: Foto Koin.');
        return;
      }
    } else {
      const hasAnyOptionalContent = Boolean(
        isStoreClosed ||
        isMinimalCoin ||
        photoOptional ||
        optionalNotes.trim().length > 0
      );
      if (!hasAnyOptionalContent) {
        toast.warning('Silakan pilih salah satu kendala (Toko Tutup / Minimal Koin), lampirkan foto, atau isi catatan.');
        return;
      }
    }

    // 2. Validasi Omset jika checklist dicentang, atau validasi meteran jika tidak dicentang
    if (hasOmset) {
      if (coinsCollected <= 0) {
        toast.warning('Karena checklist penarikan koin dicentang, masukkan total koin terambil di laci (harus lebih dari 0).');
        return;
      }

      // Poin 1: Foto Nota wajib saat Tarik Omset dicentang
      if (!photoNota) {
        toast.warning('Wajib melampirkan Foto Nota / Kuitansi Toko saat penarikan omset.');
        return;
      }

      if (hasMismatch && !discrepancyReason.trim()) {
        toast.warning('Ada selisih meteran fisik! Wajib mengisi kolom Catatan Kendala Selisih.');
        return;
      }
    } else {
      if (!hasOptional && !noOmsetMeterStr.trim()) {
        toast.warning('Silakan masukkan angka meteran yang terbaca di mesin saat ini.');
        return;
      }
    }

    const store = activeStores.find((s) => s.id === selectedStoreId);
    if (!store || !store.current_machine_id) {
      toast.warning('Toko ini tidak memiliki unit mesin aktif.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);

    const finalMeterReading = hasOmset
      ? (actualPhysicalMeter ?? calculatedNewMeter)
      : (parseInt(noOmsetMeterStr, 10) || prevMeter);

    // Format catatan kendala opsional dengan prefix tag
    const kendalaTags: string[] = [];
    if (isStoreClosed) kendalaTags.push('Toko Tutup');
    if (isMinimalCoin) kendalaTags.push('Minimal Koin (MK)');
    const kendalaPrefix = kendalaTags.length > 0 ? `[${kendalaTags.join(', ')}] ` : '';
    const finalOptionalNotes = hasOptional
      ? ((kendalaPrefix + (optionalNotes ? optionalNotes.trim() : '')).trim() || null)
      : null;

    const saveOfflineFallback = async (reasonMsg?: string) => {
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
          gross_omset: hasOmset ? grossOmset : 0,
          previous_counter_meter: prevMeter,
          actual_physical_meter: finalMeterReading,
          has_mismatch: hasOmset ? hasMismatch : false,
          discrepancy_reason: hasOmset && hasMismatch ? discrepancyReason.trim() : null,
          store_share_amount: hasOmset ? storeShareAmount : 0,
          photo_machine_blob: photoMachine || null,
          photo_machine_number_blob: photoMachineNumber || null,
          photo_coin_blob: !hasOmset ? photoCoin : null,
          photo_nota_blob: hasOmset ? photoNota : null,
          photo_optional_blob: hasOptional ? photoOptional : null,
          optional_notes: finalOptionalNotes,
          latitude,
          longitude,
          created_at: new Date().toISOString(),
          sync_status: 'pending',
        });

        confetti({ particleCount: 50, spread: 60 });
        setSubmitSuccess(
          reasonMsg
            ? `Tersimpan secara OFFLINE di HP, Data & foto kunjungan aman dan akan tersinkron otomatis begitu sinyal kembali stabil.`
            : 'Tersimpan secara OFFLINE di HP! Data akan terunggah otomatis saat Anda terhubung ke internet.'
        );
        setActiveStores((prev) =>
          prev.map((s) =>
            s.id === store.id && s.machine
              ? { ...s, machine: { ...s.machine, last_counter_meter: finalMeterReading } }
              : s
          )
        );
        resetForm();
        fetchTodayDroppings();
      } catch (dbErr: any) {
        toast.error('Gagal menyimpan offline: ' + dbErr.message);
      } finally {
        setIsSubmitting(false);
      }
    };

    // If offline, save directly to IndexedDB
    if (!navigator.onLine) {
      await saveOfflineFallback();
      return;
    }

    // If online, upload in PARALLEL to Cloudinary via Promise.all (3-4x lebih cepat) & insert to Supabase
    try {
      const [urlMachine, urlMachineNumber, urlCoin, urlNota, urlOptional] = await Promise.all([
        photoMachine ? uploadToCloudinary(photoMachine, 'droppings/machine') : Promise.resolve(null),
        photoMachineNumber ? uploadToCloudinary(photoMachineNumber, 'droppings/machine_number') : Promise.resolve(null),
        !hasOmset && photoCoin ? uploadToCloudinary(photoCoin, 'droppings/coin') : Promise.resolve(null),
        hasOmset && photoNota ? uploadToCloudinary(photoNota, 'droppings/nota') : Promise.resolve(null),
        hasOptional && photoOptional ? uploadToCloudinary(photoOptional, 'droppings/optional') : Promise.resolve(null),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const payload = {
        branch_id: activeBranchId,
        dropping_user_id: profile.id,
        store_id: store.id,
        machine_id: store.current_machine_id,
        has_omset: Boolean(hasOmset),
        coins_collected: hasOmset ? coinsCollected : 0,
        gross_omset: hasOmset ? grossOmset : 0,
        previous_counter_meter: prevMeter,
        actual_physical_meter: finalMeterReading,
        has_mismatch: hasOmset ? hasMismatch : false,
        discrepancy_reason: hasOmset && hasMismatch ? discrepancyReason.trim() : null,
        store_share_amount: hasOmset ? storeShareAmount : 0,
        photo_machine_url: urlMachine,
        photo_machine_number_url: urlMachineNumber,
        photo_coin_url: urlCoin,
        photo_machine_meter_url: urlMachineNumber || urlMachine,
        photo_coin_tray_url: urlCoin,
        photo_nota_url: urlNota,
        photo_optional_url: urlOptional,
        optional_notes: finalOptionalNotes,
        latitude,
        longitude,
        transaction_date: today,
      };

      const { error } = await supabase.from('droppings').insert(payload);

      if (error) {
        console.error('Supabase dropping insert error:', error);
        throw new Error('Gagal menyimpan transaksi ke database: ' + error.message);
      }

      // Update machine's last_counter_meter
      if (store.current_machine_id) {
        await supabase
          .from('machines')
          .update({ last_counter_meter: finalMeterReading })
          .eq('id', store.current_machine_id);
      }

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setSubmitSuccess(
        hasOmset
          ? `Sukses!, "${store.name}" berhasil dicatat: ${coinsCollected} Koin (${formatIDR(grossOmset)}). Setoran bersih: ${formatIDR(netDepositAmount)}.`
          : `Sukses! Kunjungan toko "${store.name}" berhasil dicatat.`
      );
      setActiveStores((prev) =>
        prev.map((s) =>
          s.id === store.id && s.machine
            ? { ...s, machine: { ...s.machine, last_counter_meter: finalMeterReading } }
            : s
        )
      );
      resetForm();
      await fetchTodayDroppings();
      await fetchActiveStores();
    } catch (err: any) {
      console.warn('Online upload failed, falling back to local Dexie storage:', err);
      // Fallback: save to Dexie so technician never loses data!
      await saveOfflineFallback('Koneksi tidak stabil / ' + (err.message || 'Gagal terhubung'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-sync when internet comes back online
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineRecords();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineRecords]);

  // Calculations for today's summary tab
  const totalTodayCoins = todayDroppings.reduce((acc, curr) => acc + (curr.coins_collected || 0), 0);
  const totalTodayGross = todayDroppings.reduce((acc, curr) => acc + (curr.gross_omset || 0), 0);
  const totalTodayStoreShare = todayDroppings.reduce((acc, curr) => acc + (curr.store_share_amount || 0), 0);
  const totalTodayNet = todayDroppings.reduce((acc, curr) => acc + (curr.net_deposit_amount || 0), 0);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      {/* Offline Pending Badge - Typography & Visual Layout Optimized */}
      {offlinePendingCount > 0 && (
        <div className="mb-4 p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-2xl flex items-center justify-between gap-3 text-amber-950 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 text-amber-600 dark:text-amber-400">
              <CloudUpload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight">
                Data Offline Tersedia
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 font-medium truncate mt-0.5">
                Ada <strong className="font-bold">{offlinePendingCount}</strong> data tersimpan.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSyncing}
            onClick={syncOfflineRecords}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer flex-shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '' : 'Kirim'}</span>
          </button>
        </div>
      )}

      {isVisitTab ? (
        !selectedStoreId ? (
          /* ======================================================== */
          /* 1. HALAMAN LIST KUNJUNGAN TOKO MITRA                     */
          /* ======================================================== */
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Page Title (Nempel ke body) */}
            <div className="pt-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <StoreIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <span>Daftar dropping {profile?.full_name || 'Budi'}</span>
              </h2>
            </div>

            {submitSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs shadow-xs flex items-start gap-3 animate-in fade-in duration-200">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 text-xs font-medium leading-relaxed">
                  {submitSuccess}
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(null)}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition cursor-pointer flex-shrink-0"
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

            {/* Stores List (Nempel ke body dengan border divider) */}
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredStores.map((store) => {
                const todayTx = todayDroppings.find(
                  (t) => t.store_id === store.id || (t.store && t.store.name === store.name)
                );

                const hasOmsetTaken = Boolean(
                  todayTx && (
                    todayTx.has_omset === true ||
                    (typeof todayTx.has_omset === 'string' && todayTx.has_omset === 'true') ||
                    (typeof todayTx.coins_collected === 'number' && todayTx.coins_collected > 0)
                  )
                );

                const isStoreClosedTx = Boolean(
                  todayTx?.optional_notes &&
                  (todayTx.optional_notes.includes('Toko Tutup') || todayTx.optional_notes.includes('[Toko Tutup]'))
                );

                const isMinimalCoinTx = Boolean(
                  todayTx?.optional_notes &&
                  (todayTx.optional_notes.includes('Minimal Koin') || todayTx.optional_notes.includes('[Minimal Koin (MK)]'))
                );

                const isCustomKendalaTx = Boolean(
                  todayTx &&
                  !isStoreClosedTx &&
                  !isMinimalCoinTx &&
                  (Boolean(todayTx.photo_optional_url) || (todayTx.optional_notes && todayTx.optional_notes.trim().length > 0))
                );

                // Status dynamic configuration
                let statusLabel = 'Belum Dikunjungi';
                let StatusIcon = Clock;
                // Hitam putih dengan kontras tinggi di light & dark mode
                let buttonStyle = 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';

                if (todayTx) {
                  if (hasOmsetTaken) {
                    // Omset sudah diambil
                    statusLabel = 'Kunjungan Selesai';
                    StatusIcon = CheckCircle2;
                    buttonStyle = 'bg-emerald-600 text-white font-bold hover:bg-emerald-500 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500';
                  } else if (isStoreClosedTx) {
                    // Kendala Toko Tutup: border hitam (background tombol transparan)
                    statusLabel = 'Toko Tutup';
                    StatusIcon = XCircle;
                    buttonStyle = 'border-2 border-slate-900 text-slate-900 dark:border-white dark:text-white bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 font-bold';
                  } else if (isMinimalCoinTx) {
                    // Kendala Minimal Koin (MK): border orange (background tombol transparan)
                    statusLabel = 'Minimal Koin (MK)';
                    StatusIcon = Coins;
                    buttonStyle = 'border-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-transparent hover:bg-orange-50/60 dark:hover:bg-orange-950/30 font-bold';
                  } else if (isCustomKendalaTx) {
                    // Kendala khusus (foto / catatan): border merah (background tombol transparan)
                    statusLabel = 'Memiliki kendala';
                    StatusIcon = AlertCircle;
                    buttonStyle = 'border-2 border-rose-500 text-rose-600 dark:text-rose-400 bg-transparent hover:bg-rose-50/60 dark:hover:bg-rose-950/30 font-bold';
                  } else {
                    // Kunjungan tercatat tetapi belum ambil omset
                    statusLabel = 'Belum Ambil Omset';
                    StatusIcon = Coins;
                    buttonStyle = 'bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300';
                  }
                }

                const isTwoVisitsRequired = Boolean(
                  store.machine?.daily_visit_target === 2 ||
                  store.machine?.notes?.includes('2x Kunjungan')
                );

                // Teks status kunjungan di bawah nama toko (sesuai spesifikasi)
                let visitSubtext = '';
                if (isTwoVisitsRequired) {
                  if (!todayTx) {
                    visitSubtext = 'Perlu 2x kunjungan: Belum di kunjungi';
                  } else if (hasOmsetTaken) {
                    visitSubtext = 'Perlu 2x Kunjungan: Kunjungan kedua selesai.';
                  } else if (isStoreClosedTx || isMinimalCoinTx || isCustomKendalaTx) {
                    visitSubtext = 'Perlu 2x Kunjungan: Kendala kunjungan pertama / kedua.';
                  } else {
                    visitSubtext = 'Perlu 2x Kunjungan: Kunjungan pertama selesai.';
                  }
                } else {
                  if (!todayTx) {
                    visitSubtext = 'Status kunjungan: Belum di kunjungi.';
                  } else if (hasOmsetTaken) {
                    visitSubtext = 'Status kunjungan: Selesai di kunjungi.';
                  } else if (isStoreClosedTx || isMinimalCoinTx || isCustomKendalaTx) {
                    visitSubtext = 'Status kunjungan: Kendala kunjungan.';
                  } else {
                    visitSubtext = 'Status kunjungan: Selesai di kunjungi.';
                  }
                }

                const machineCode = displayMachineCode(store.machine?.machine_code);

                return (
                  <div
                    key={store.id}
                    className="py-3.5 first:pt-1 space-y-2.5"
                  >
                    {/* [nomormesin | namatoko] */}
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        <span className="font-mono font-black">{machineCode}</span>
                        <span className="text-slate-400 dark:text-slate-500 font-normal mx-2">|</span>
                        <span>{store.name}</span>
                      </h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {visitSubtext}
                      </p>
                    </div>

                    {/* [tombol aksi]: [Info] + [status flex-1 di kanan] */}
                    <div className="flex items-center gap-2">
                      {/* Tombol Info Toko */}
                      <button
                        type="button"
                        onClick={() => setDetailModalStore(store)}
                        title="Informasi Detail Toko"
                        aria-label="Informasi Detail Toko"
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition active:scale-90 flex-shrink-0 cursor-pointer shadow-xs"
                      >
                        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </button>

                      {/* Tombol Action Status (Di Kanan) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (statusLabel === 'Kunjungan Selesai') {
                            setDetailModalStore(store);
                          } else {
                            setSelectedStoreId(store.id);
                            setNoOmsetMeterStr(store.machine?.last_counter_meter?.toString() || '0');
                          }
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer shadow-xs min-w-0 ${buttonStyle}`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                          <StatusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{statusLabel}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ml-1" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredStores.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <StoreIcon className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-xs font-semibold">Tidak ada toko mitra yang cocok dengan pencarian "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* 2. STATE INPUT DROPPING (Setelah Toko Dipilih Dari List)  */
          /* ======================================================== */
          <div className="space-y-4 animate-in fade-in duration-150 pb-16">
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
                <span>Kembali</span>
              </button>
              <span className="text-[15px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 font-mono">
                {displayMachineCode(selectedStore?.machine?.machine_code)}
              </span>
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
                      {prevMeter}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Kode Unit Mesin:
                    </span>
                    <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                      {displayMachineCode(selectedStore?.machine?.machine_code)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Tiga Foto Wajib Terlebih Dahulu */}
              <div className="space-y-3 pt-1">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Foto wajib {hasOmset ? '(2 Foto)' : '(3 Foto)'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Kirim foto secara jelas sesuai di bidang masing-masing
                  </p>
                </div>

                {/* Slot Kartu Foto (Bisa diklik untuk ambil/lihat masing-masing) */}
                <div className={`grid grid-cols-1 ${hasOmset ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2.5`}>
                  {/* Foto Mesin / Boneka */}
                  <div className={`p-3 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-2 bg-white dark:bg-slate-900 ${submitAttempted && !hasOptional && !photoMachine
                    ? 'border border-rose-400 dark:border-rose-500/80 shadow-xs'
                    : 'border border-slate-200 dark:border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <img src="/boneka.png" alt="Boneka" className="w-4 h-4 object-contain inline-block" />
                        Mesin / Boneka <span className="text-rose-500">*</span>
                      </span>
                      {photoMachine && (
                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Terisi
                        </span>
                      )}
                    </div>
                    {photoMachine ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                        <img src={photoMachine} alt="Foto Mesin" className="w-full h-full object-cover" />
                        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPhotoMachine('')}
                            className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95 shadow-sm"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMultiStepStartIndex(0);
                              setIsMultiStepCameraOpen(true);
                            }}
                            className="px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95"
                          >
                            <RefreshCw className="w-3 h-3" /> Foto Ulang
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMultiStepStartIndex(0);
                          setIsMultiStepCameraOpen(true);
                        }}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <img src="/boneka.png" alt="Mesin" className="w-7 h-7 object-contain drop-shadow-xs" />
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          Ambil Foto Mesin
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Foto Nomor Mesin */}
                  <div className={`p-3 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-2 bg-white dark:bg-slate-900 ${submitAttempted && !hasOptional && !photoMachineNumber
                    ? 'border border-rose-400 dark:border-rose-500/80 shadow-xs'
                    : 'border border-slate-200 dark:border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <img src="/nomor.png" alt="Nomor" className="w-4 h-4 object-contain inline-block" />
                        Nomor Mesin <span className="text-rose-500">*</span>
                      </span>
                      {photoMachineNumber && (
                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Terisi
                        </span>
                      )}
                    </div>
                    {photoMachineNumber ? (
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                        <img src={photoMachineNumber} alt="Foto Nomor Mesin" className="w-full h-full object-cover" />
                        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPhotoMachineNumber('')}
                            className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95 shadow-sm"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMultiStepStartIndex(1);
                              setIsMultiStepCameraOpen(true);
                            }}
                            className="px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95"
                          >
                            <RefreshCw className="w-3 h-3" /> Foto Ulang
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMultiStepStartIndex(1);
                          setIsMultiStepCameraOpen(true);
                        }}
                        className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <img src="/nomor.png" alt="Nomor Mesin" className="w-7 h-7 object-contain drop-shadow-xs" />
                        <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          Ambil Nomor Mesin
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Foto Koin (Otomatis disembunyikan jika Tarik Omset dicentang) */}
                  {!hasOmset && (
                    <div className={`p-3 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-2 bg-white dark:bg-slate-900 ${submitAttempted && !hasOptional && !photoCoin
                      ? 'border border-rose-400 dark:border-rose-500/80 shadow-xs'
                      : 'border border-slate-200 dark:border-slate-800'
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <img src="/coin.png" alt="Koin" className="w-4 h-4 object-contain inline-block" />
                          Foto Koin <span className="text-rose-500">*</span>
                        </span>
                        {photoCoin && (
                          <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Terisi
                          </span>
                        )}
                      </div>
                      {photoCoin ? (
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center">
                          <img src={photoCoin} alt="Foto Koin" className="w-full h-full object-cover" />
                          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPhotoCoin('')}
                              className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95 shadow-sm"
                              title="Hapus foto"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMultiStepStartIndex(2);
                                setIsMultiStepCameraOpen(true);
                              }}
                              className="px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95"
                            >
                              <RefreshCw className="w-3 h-3" /> Foto Ulang
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMultiStepStartIndex(2);
                            setIsMultiStepCameraOpen(true);
                          }}
                          className="w-full py-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <img src="/coin.png" alt="Koin" className="w-7 h-7 object-contain drop-shadow-xs" />
                          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                            Ambil Foto Koin
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Multi-Step In-App Camera Modal */}
              <MultiStepCameraModal
                isOpen={isMultiStepCameraOpen}
                onClose={() => setIsMultiStepCameraOpen(false)}
                steps={mandatoryPhotoSteps}
                initialStepIndex={multiStepStartIndex}
                initialPhotos={{
                  photoMachine,
                  photoMachineNumber,
                  photoCoin,
                  photoNota,
                }}
                onFinish={(results) => {
                  if (results.photoMachine !== undefined) setPhotoMachine(results.photoMachine);
                  if (results.photoMachineNumber !== undefined) setPhotoMachineNumber(results.photoMachineNumber);
                  if (results.photoCoin !== undefined) setPhotoCoin(results.photoCoin);
                  if (results.photoNota !== undefined) setPhotoNota(results.photoNota);
                }}
              />

              {/* 3. Section: Pencocokan Angka Meteran & Checklist Ambil Koin */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs transition-colors">
                {/* 1. Pencocokan Angka Meteran Mesin Saja (Diletakkan di atas) */}
                {!hasOmset && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-xs">
                        <Gauge className="w-4 h-4 text-indigo-500" />
                        <span>Pencocokan Angka Meteran Mesin</span>
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <Gauge className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          inputMode="numeric"
                          required={!hasOmset}
                          value={noOmsetMeterStr}
                          onChange={(e) => setNoOmsetMeterStr(e.target.value)}
                          placeholder={prevMeter.toString()}
                          className={`w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 shadow-xs transition-all ${submitAttempted && !hasOptional && !noOmsetMeterStr.trim()
                            ? 'border border-rose-400 dark:border-rose-500/80 focus:ring-rose-500'
                            : 'border border-slate-300 dark:border-slate-700 focus:ring-indigo-500'
                            }`}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 dark:text-slate-400">
                        <span>Meteran terakhir sistem: <strong className="font-mono text-slate-700 dark:text-slate-300">{prevMeter}</strong></span>
                        {selectedStore && (
                          <span>Unit: <strong className="font-mono text-slate-700 dark:text-slate-300">{displayMachineCode(selectedStore.machine?.machine_code)}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Checklist Toggle Card (Diletakkan di bawah) */}
                <label className={`flex items-start gap-3.5 p-3.5 rounded-xl border transition cursor-pointer select-none ${hasOmset
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
                        Tarik omset
                      </span>

                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1 leading-relaxed">
                      {hasOmset
                        ? 'Lanjutkan dengan mengisi kolom koin yang sudah dihitung.'
                        : 'Klik untuk tarik omset (Pastikan sudah menghitung koin).'}
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
                          className={`w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-base font-mono font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 shadow-xs transition-all ${submitAttempted && hasOmset && coinsCollected <= 0
                            ? 'border border-rose-400 dark:border-rose-500/80 focus:ring-rose-500'
                            : 'border border-slate-300 dark:border-slate-700 focus:ring-emerald-500'
                            }`}
                        />
                      </div>
                    </div>

                    {/* Auto Calculations Summary (Target Odometer & Gross Omset) */}
                    {coinsCollected > 0 && (
                      <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            Angka Meteran Baru ({prevMeter} + {coinsCollected} koin):
                          </span>
                          <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                            {calculatedNewMeter}
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
                              Kesesuaian Meteran
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setHasMismatch(!hasMismatch);
                              if (!hasMismatch) setActualPhysicalMeterStr(calculatedNewMeter.toString());
                            }}
                            className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition cursor-pointer ${hasMismatch
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                              }`}
                          >
                            {hasMismatch ? '⚠️Selisih' : '✓Cocok'}
                          </button>
                        </div>

                        {hasMismatch && (
                          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Angka Meteran di Mesin *
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
                                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 min-h-[72px] resize-y"
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
                              Pembagian toko
                            </span>
                          </div>
                          {/* Quick 10% Button */}

                        </div>
                        <button
                          type="button"
                          onClick={handleQuick10Percent}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-extrabold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Hitung Cepat 10% ({formatIDR(Math.round(grossOmset * 0.1))})</span>
                        </button>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Nominal yang diserahkan ke Toko *
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
                            Omset yang dibawa:
                          </span>
                          <span className="text-xl font-black block tracking-tight">
                            {formatIDR(netDepositAmount)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Foto Nota / Kuitansi Toko (Wajib jika opsi Tarik Omset dicentang - Tanpa Container Ganda & Terhubung ke Kamera Multi-Step) */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Receipt className="w-4 h-4 text-amber-500" />
                            Foto Nota / Kuitansi Toko <span className="text-rose-500">*</span>
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Wajib foto nota tertulis yang ditandatangani toko.
                          </p>
                        </div>
                        {photoNota && (
                          <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Terisi
                          </span>
                        )}
                      </div>

                      {photoNota ? (
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center border border-slate-300 dark:border-slate-700">
                          <img src={photoNota} alt="Foto Nota" className="w-full h-full object-cover" />
                          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPhotoNota(null)}
                              className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95 shadow-sm"
                              title="Hapus foto"
                            >
                              <Trash2 className="w-3 h-3" /> Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMultiStepStartIndex(2);
                                setIsMultiStepCameraOpen(true);
                              }}
                              className="px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer active:scale-95"
                            >
                              <RefreshCw className="w-3 h-3" /> Foto Ulang
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMultiStepStartIndex(2);
                            setIsMultiStepCameraOpen(true);
                          }}
                          className={`w-full py-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.99] ${submitAttempted && hasOmset && !photoNota
                            ? 'border-rose-400 dark:border-rose-500/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60'
                            : 'border-amber-300 dark:border-amber-700/60 bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                            <Receipt className="w-5 h-5" />
                          </div>
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            Ambil Foto Nota / Kuitansi
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Opsi Tambahan / Kendala Lapangan (Default Tersembunyi dengan Checkbox) */}
              <div className="space-y-3 pt-1">
                <label className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${hasOptional
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/70 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}>
                  <input
                    type="checkbox"
                    checked={hasOptional}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setHasOptional(checked);
                      if (!checked) {
                        setIsStoreClosed(false);
                        setIsMinimalCoin(false);
                        setPhotoOptional(null);
                        setOptionalNotes('');
                      }
                    }}
                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      Laporan Kondisi / Kendala Toko Jika Ada.
                    </span>

                  </div>
                </label>

                {/* Muncul jika dicentang */}
                {hasOptional && (
                  <div className={`p-3.5 rounded-2xl space-y-4 animate-in fade-in duration-200 transition-all ${submitAttempted && hasOptional && !isStoreClosed && !isMinimalCoin && !photoOptional && !optionalNotes.trim()
                    ? 'bg-slate-50 dark:bg-slate-800/40 border border-rose-400 dark:border-rose-500/80 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60'
                    }`}>
                    {/* Checkbox Pilihan Kondisi Kendala */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Kondisi / Status Kendala:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Checkbox Toko Tutup */}
                        <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${isStoreClosed
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/70 text-rose-900 dark:text-rose-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                          <input
                            type="checkbox"
                            checked={isStoreClosed}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsStoreClosed(checked);
                              if (checked) setIsMinimalCoin(false);
                            }}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold">Toko Tutup</span>
                        </label>

                        {/* Checkbox Minimal Koin (MK) */}
                        <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${isMinimalCoin
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                          <input
                            type="checkbox"
                            checked={isMinimalCoin}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsMinimalCoin(checked);
                              if (checked) setIsStoreClosed(false);
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold">Minimal Koin (MK)</span>
                        </label>
                      </div>
                    </div>

                    {/* Tombol Kamera Langsung & Preview tanpa Card Ganda */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
                      <CameraCapture
                        label="Foto Kondisi Khusus / Kendala (Opsional)"
                        subLabel="Ambil foto kondisi di lapangan jika diperlukan"
                        required={false}
                        embedded={true}
                        onPhotoCaptured={({ base64 }) => setPhotoOptional(base64)}
                        onPhotoRemoved={() => setPhotoOptional(null)}
                      />
                    </div>

                    {/* Input Catatan Tambahan */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Catatan / Keterangan Tambahan (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        value={optionalNotes}
                        onChange={(e) => setOptionalNotes(e.target.value)}
                        placeholder="Contoh: Toko tutup rapat, kunci gembok rusak, koin minim belum perlu penarikan..."
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[72px] resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button (Always Enabled, Hapus Error Text Bersih) */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition cursor-pointer disabled:opacity-50 touch-target"
                >
                  {isSubmitting ? (
                    <span>Menyimpan Transaksi...</span>
                  ) : (
                    <>
                      <span>
                        {hasOmset
                          ? `Simpan Laporan`
                          : 'Simpan Kunjungan'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Floating Camera Button - Tombol icon kamera bulat di kanan bawah (Dinaikkan khusus akun Admin/BM agar tidak tertutup panel expand) */}
            <div
              className={`fixed ${profile?.role === 'admin' ||
                profile?.role === 'admin_cabang' ||
                activeRole === 'admin' ||
                activeRole === 'admin_cabang' ||
                profile?.role === 'branch_manager' ||
                activeRole === 'branch_manager'
                ? 'bottom-[98px]'
                : 'bottom-20'
                } right-4 sm:right-[calc(50%-240px+16px)] z-20`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const firstUnfilled = !photoMachine
                    ? 0
                    : !photoMachineNumber
                      ? 1
                      : hasOmset
                        ? (!photoNota ? 2 : 0)
                        : (!photoCoin ? 2 : 0);
                  setMultiStepStartIndex(firstUnfilled);
                  setIsMultiStepCameraOpen(true);
                }}
                className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-90 text-white shadow-xl shadow-indigo-600/40 border-2 border-white dark:border-slate-900 flex items-center justify-center cursor-pointer transition-all"
                title="Buka Kamera Langsung"
                aria-label="Buka Kamera Langsung"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
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
                        {displayMachineCode(item.machine?.machine_code)} • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    </div>
                    <span className={`text-xs font-extrabold font-mono ${item.has_omset !== false
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.optional_notes?.includes('Toko Tutup')
                          ? 'text-slate-900 dark:text-white'
                          : item.optional_notes?.includes('Minimal Koin')
                            ? 'text-orange-600 dark:text-orange-400'
                            : (item.photo_optional_url || item.optional_notes)
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                      }`}>
                      {item.has_omset !== false
                        ? `+${item.coins_collected} Koin`
                        : item.optional_notes?.includes('Toko Tutup')
                          ? 'Toko Tutup'
                          : item.optional_notes?.includes('Minimal Koin')
                            ? 'Minimal Koin'
                            : (item.photo_optional_url || item.optional_notes)
                              ? 'Kendala Khusus'
                              : 'Tanpa Omset'}
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

      {/* ======================================================== */}
      {/* MODAL INFORMASI DETAIL TOKO MITRA (FULLSCREEN SLIDE-UP)   */}
      {/* ======================================================== */}
      <BottomSheetModal
        item={detailModalStore}
        onClose={() => setDetailModalStore(null)}
        isFullscreen={true}
      >
        {(store, close) => {
          // Gabungkan riwayat: pastikan transaksi hari ini muncul di urutan paling atas jika belum ada di list
          const combinedHistory: DroppingTransaction[] = [...storeHistoryDroppings];
          const todayTx = todayDroppings.find(t => t.store_id === store.id || (t.store && t.store.name === store.name));
          if (todayTx && !combinedHistory.some(h => h.id === todayTx.id)) {
            combinedHistory.unshift(todayTx);
          }

          // Cek status kunjungan hari ini
          const isVisitCompleted = Boolean(
            todayTx && (
              todayTx.has_omset === true ||
              (typeof todayTx.has_omset === 'string' && todayTx.has_omset === 'true') ||
              (typeof todayTx.coins_collected === 'number' && todayTx.coins_collected > 0)
            )
          );
          const hasPendingOmset = Boolean(todayTx && !isVisitCompleted);

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
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Outlet Mitra
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                      <span className="font-mono font-black">{displayMachineCode(store.machine?.machine_code)}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal mx-2">|</span>
                      <span>{store.name}</span>
                    </h4>
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
                    {store.machine?.last_counter_meter ?? 0}
                  </span>
                </div>

                {/* 3. Riwayat Tracking Kunjungan & Bukti Foto (Langsung di Body Modal) */}
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
                                      <XCircle className="w-3 h-3" /> Toko Tutup
                                    </>
                                  ) : tx.optional_notes?.includes('Minimal Koin') ? (
                                    <>
                                      <Coins className="w-3 h-3" /> Minimal Koin (MK)
                                    </>
                                  ) : (tx.photo_optional_url || tx.optional_notes) ? (
                                    <>
                                      <AlertCircle className="w-3 h-3" /> Kendala Khusus
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

                              {/* Galeri Preview Gambar Bukti */}
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
                                        onClick={() => setActivePreviewImage({ url: photo.url, title: `Foto ${photo.label} - ${store.name}` })}
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
                    /* Jika belum ada riwayat transaksi */
                    <div className="pt-2">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-center space-y-1">
                        <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Belum Ada Riwayat Kunjungan</span>
                        <p className="text-[11px] text-slate-500">Mulai kunjungan pertama hari ini untuk mencatat meteran fisik dan bukti foto.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Tombol Aksi Modal (Khusus status belum selesai kunjungan) */}
                {!isVisitCompleted && (
                  <div className="pt-2 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenMaps(store)}
                      className="flex-1 py-3 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
                    >
                      <img src="/maps.png" alt="Maps" className="w-4 h-4 object-contain" />
                      Buka Maps
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setSelectedStoreId(store.id);
                        setNoOmsetMeterStr(store.machine?.last_counter_meter?.toString() || '0');
                      }}
                      className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-sm ${hasPendingOmset
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900'
                        }`}
                    >
                      {hasPendingOmset ? (
                        <>
                          <Coins className="w-4 h-4" />
                          Ambil Omset
                        </>
                      ) : (
                        <>
                          <StoreIcon className="w-4 h-4" />
                          Mulai Kunjungan
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          );
        }}
      </BottomSheetModal>

      {/* ======================================================== */}
      {/* POPUP LIGHTBOX ZOOM PREVIEW FOTO                          */}
      {/* ======================================================== */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-[9999999] bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setActivePreviewImage(null)}
        >
          <div className="flex items-center justify-between text-white pt-2 max-w-lg mx-auto w-full z-10">
            <span className="text-xs font-bold truncate pr-3">{activePreviewImage.title}</span>
            <button
              type="button"
              onClick={() => setActivePreviewImage(null)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer active:scale-95"
              title="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-2 max-w-lg mx-auto w-full">
            <img
              src={activePreviewImage.url}
              alt={activePreviewImage.title}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="pb-3 flex justify-center max-w-lg mx-auto w-full z-10">
            <a
              href={activePreviewImage.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              Buka Foto Resolusi Penuh
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
