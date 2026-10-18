import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { offlineDb } from '../../lib/db';
import { CameraCapture } from '../../components/CameraCapture';
import { MultiStepCameraModal } from '../../components/MultiStepCameraModal';
import type { PhotoStepItem } from '../../components/MultiStepCameraModal';
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
  Camera,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Store, DroppingTransaction } from '../../types';

interface DroppingViewProps {
  activeTab: string;
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

export const DroppingView: React.FC<DroppingViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();
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

  const MANDATORY_PHOTO_STEPS: PhotoStepItem[] = [
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
    {
      key: 'photoCoin',
      label: 'Foto Koin',
      subLabel: 'Ambil foto fisik koin yang berada di mesin',
      required: true,
    },
    {
      key: 'photoOptional',
      label: 'Foto Tambahan (Opsional)',
      subLabel: 'Ambil foto kondisi khusus',
      required: false,
    },
  ];

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

  // Fetch today's transactions for this dropping user
  const fetchTodayDroppings = useCallback(async () => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('droppings')
        .select(`
          *,
          store:stores(name, address),
          machine:machines(machine_code)
        `)
        .eq('dropping_user_id', profile.id)
        .eq('transaction_date', today)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching today droppings from Supabase:', error);
      }

      const list: DroppingTransaction[] = data ? (data as DroppingTransaction[]) : [];

      // Also merge any pending offline records from Dexie.js
      try {
        const offlinePending = await offlineDb.offlineDroppings
          .where('dropping_user_id')
          .equals(profile.id)
          .toArray();

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
                photo_machine_url: off.photo_machine_blob || '',
                photo_machine_number_url: off.photo_machine_number_blob || '',
                photo_coin_url: off.photo_coin_blob || '',
                photo_nota_url: off.photo_nota_blob || null,
                photo_optional_url: off.photo_optional_blob || null,
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
          const urlMachine = await uploadToCloudinary(rec.photo_machine_blob || '', 'droppings/machine');
          const urlMachineNumber = await uploadToCloudinary(rec.photo_machine_number_blob || '', 'droppings/machine_number');
          const urlCoin = await uploadToCloudinary(rec.photo_coin_blob || '', 'droppings/coin');
          const urlNota = rec.photo_nota_blob ? await uploadToCloudinary(rec.photo_nota_blob, 'droppings/nota') : null;
          const urlOptional = rec.photo_optional_blob ? await uploadToCloudinary(rec.photo_optional_blob, 'droppings/optional') : null;

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
            latitude: rec.latitude,
            longitude: rec.longitude,
            transaction_date: today,
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
        setSubmitSuccess(
          reasonMsg
            ? `Tersimpan secara OFFLINE di HP (${reasonMsg})! Data & foto kunjungan aman dan akan tersinkron otomatis begitu sinyal kembali stabil.`
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
        alert('Gagal menyimpan offline: ' + dbErr.message);
      } finally {
        setIsSubmitting(false);
      }
    };

    // If offline, save directly to IndexedDB
    if (!navigator.onLine) {
      await saveOfflineFallback();
      return;
    }

    // If online, upload sequentially to Cloudinary & insert to Supabase
    try {
      const urlMachine = await uploadToCloudinary(photoMachine, 'droppings/machine');
      const urlMachineNumber = await uploadToCloudinary(photoMachineNumber, 'droppings/machine_number');
      const urlCoin = await uploadToCloudinary(photoCoin, 'droppings/coin');
      const urlNota = photoNota ? await uploadToCloudinary(photoNota, 'droppings/nota') : null;
      const urlOptional = photoOptional ? await uploadToCloudinary(photoOptional, 'droppings/optional') : null;

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
          ? `Sukses! Dropping "${store.name}" berhasil dicatat: ${coinsCollected} Koin (${formatIDR(grossOmset)}). Setoran bersih: ${formatIDR(netDepositAmount)}.`
          : `Sukses! Kunjungan toko "${store.name}" (pencocokan meteran: ${finalMeterReading}) berhasil dicatat.`
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
                  <StoreIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Daftar dropping {profile?.username ? (profile.username.charAt(0).toUpperCase() + profile.username.slice(1)) : 'Budi'}</span>
                </h2>
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

                // Status dynamic configuration
                let statusLabel = 'Belum Dikunjungi';
                let StatusIcon = Clock;
                // Hitam putih dengan kontras tinggi di light & dark mode
                let buttonStyle = 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white';

                if (todayTx) {
                  StatusIcon = CheckCircle2;
                  buttonStyle = 'bg-emerald-600 text-white font-bold hover:bg-emerald-500 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500';
                  if (hasOmsetTaken) {
                    statusLabel = 'Kunjungan Selesai (Ada Omset)';
                  } else {
                    statusLabel = 'Kunjungan Selesai (Cek Meteran)';
                  }
                }

                return (
                  <div
                    key={store.id}
                    className="p-3.5 sm:p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700 space-y-3"
                  >
                    {/* [namatoko] [nomormesin] */}
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {store.name}
                      </h3>
                      <span className="text-[11px] font-extrabold font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 flex-shrink-0">
                        {store.machine?.machine_code || 'Tanpa Mesin'}
                      </span>
                    </div>

                    {/* [tombolstatus]: [icon] [status] [arrow right] */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setNoOmsetMeterStr(store.machine?.last_counter_meter?.toString() || '0');
                      }}
                      className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer shadow-xs ${buttonStyle}`}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon className="w-4 h-4 flex-shrink-0" />
                        <span>{statusLabel}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" />
                    </button>
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
                      {selectedStore?.machine?.machine_code}
                    </span>
                  </div>
                </div>
              </div>

            {/* 2. Tiga Foto Wajib Terlebih Dahulu */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    3 Foto Wajib (Saling Terhubung)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Foto 1, 2, dan 3 dapat diambil berurutan tanpa keluar kamera, atau satu per satu.
                  </p>
                </div>

                {/* Tombol Ambil Semua Sekaligus */}
                <button
                  type="button"
                  onClick={() => {
                    // Cari step yang belum terisi, atau mulai dari 0
                    const firstUnfilled = !photoMachine ? 0 : !photoMachineNumber ? 1 : !photoCoin ? 2 : 0;
                    setMultiStepStartIndex(firstUnfilled);
                    setIsMultiStepCameraOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Mulai Foto</span>
                </button>
              </div>

              {/* Slot Kartu Foto (Bisa diklik untuk ambil/lihat masing-masing) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Foto Mesin / Boneka */}
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
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
                      <button
                        type="button"
                        onClick={() => {
                          setMultiStepStartIndex(0);
                          setIsMultiStepCameraOpen(true);
                        }}
                        className="absolute bottom-1.5 right-1.5 px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Foto Ulang
                      </button>
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
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Ambil Foto Mesin</span>
                    </button>
                  )}
                </div>

                {/* Foto Nomor Mesin */}
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
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
                      <button
                        type="button"
                        onClick={() => {
                          setMultiStepStartIndex(1);
                          setIsMultiStepCameraOpen(true);
                        }}
                        className="absolute bottom-1.5 right-1.5 px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Foto Ulang
                      </button>
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
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Ambil Nomor Mesin</span>
                    </button>
                  )}
                </div>

                {/* Foto Koin */}
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-2">
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
                      <button
                        type="button"
                        onClick={() => {
                          setMultiStepStartIndex(2);
                          setIsMultiStepCameraOpen(true);
                        }}
                        className="absolute bottom-1.5 right-1.5 px-2 py-1 bg-black/70 hover:bg-black text-white rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Foto Ulang
                      </button>
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
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Ambil Foto Koin</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Connected Multi-Step In-App Camera Modal */}
            <MultiStepCameraModal
              isOpen={isMultiStepCameraOpen}
              onClose={() => setIsMultiStepCameraOpen(false)}
              steps={MANDATORY_PHOTO_STEPS}
              initialStepIndex={multiStepStartIndex}
              initialPhotos={{
                photoMachine,
                photoMachineNumber,
                photoCoin,
                photoOptional,
              }}
              onFinish={(results) => {
                if (results.photoMachine !== undefined) setPhotoMachine(results.photoMachine);
                if (results.photoMachineNumber !== undefined) setPhotoMachineNumber(results.photoMachineNumber);
                if (results.photoCoin !== undefined) setPhotoCoin(results.photoCoin);
                if (results.photoOptional !== undefined) setPhotoOptional(results.photoOptional);
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
                      <span>Meteran terakhir sistem: <strong className="font-mono text-slate-700 dark:text-slate-300">{prevMeter}</strong></span>
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
                          Target Meteran Baru ({prevMeter} + {coinsCollected} koin):
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
                subLabel="Ambil foto kondisi khusus"
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
