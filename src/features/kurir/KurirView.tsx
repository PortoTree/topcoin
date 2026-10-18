import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { CameraCapture } from '../../components/CameraCapture';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Truck,
  MapPin,
  Phone,
  CheckCircle2,
  RefreshCw,
  Cpu,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import type { Store, Machine } from '../../types';

interface KurirViewProps {
  activeTab: string;
}

export const KurirView: React.FC<KurirViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();

  const [pendingStores, setPendingStores] = useState<Store[]>([]);
  const [completedStores, setCompletedStores] = useState<Store[]>([]);
  const [warehouseMachines, setWarehouseMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal / Delivery in progress state
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [installedPhotoBlob, setInstalledPhotoBlob] = useState<Blob | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch pending stores (proses / dikirim)
      const { data: storesData } = await supabase
        .from('stores')
        .select(`
          *,
          machine:machines!stores_current_machine_id_fkey(id, machine_code, status)
        `)
        .in('status', ['proses', 'dikirim'])
        .order('created_at', { ascending: false });

      if (storesData) setPendingStores(storesData as Store[]);

      // 2. Fetch completed stores delivered by this courier or any
      const { data: completedData } = await supabase
        .from('stores')
        .select(`
          *,
          machine:machines!stores_current_machine_id_fkey(id, machine_code, status)
        `)
        .eq('status', 'terkirim')
        .order('delivered_at', { ascending: false })
        .limit(20);

      if (completedData) setCompletedStores(completedData as Store[]);

      // 3. Fetch machines in gudang
      const { data: machinesData } = await supabase
        .from('machines')
        .select('*')
        .eq('status', 'gudang')
        .order('machine_code', { ascending: true });

      if (machinesData) setWarehouseMachines(machinesData as Machine[]);
    } catch (err) {
      console.error('Error fetching courier data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Action: Courier takes machine from warehouse and sets status to 'dikirim'
  const handleStartDelivery = async (store: Store, machineId: string) => {
    if (!profile || !machineId) {
      alert('Pilih nomor mesin yang akan Anda bawa dari gudang.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Update machine
      await supabase
        .from('machines')
        .update({ status: 'dikirim', current_store_id: store.id })
        .eq('id', machineId);

      // Update store
      await supabase
        .from('stores')
        .update({
          status: 'dikirim',
          current_machine_id: machineId,
          kurir_id: profile.id,
        })
        .eq('id', store.id);

      fetchData();
      setSelectedStore(null);
      alert('Status diubah ke "Dikirim". Silakan antar mesin ke toko.');
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status pengiriman.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Courier arrives, takes installation photo, confirms installation
  const handleConfirmDelivered = async (store: Store) => {
    if (!profile) return;
    if (!installedPhotoBlob) {
      alert('Harap ambil foto bukti instalasi mesin di toko terlebih dahulu.');
      return;
    }

    try {
      setIsSubmitting(true);
      const photoUrl = await uploadToCloudinary(installedPhotoBlob, 'deliveries');

      // Update store to terkirim (aktif)
      await supabase
        .from('stores')
        .update({
          status: 'terkirim',
          kurir_id: profile.id,
          delivered_at: new Date().toISOString(),
          photo_store_url: photoUrl,
        })
        .eq('id', store.id);

      // Update machine to terpasang
      if (store.current_machine_id) {
        await supabase
          .from('machines')
          .update({
            status: 'terpasang',
            current_store_id: store.id,
          })
          .eq('id', store.current_machine_id);
      }

      fetchData();
      setSelectedStore(null);
      setInstalledPhotoBlob(null);
      alert(`Sukses! Toko "${store.name}" sudah aktif dan siap dikoleksi oleh tim Dropping.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menyelesaikan pengiriman.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            {activeTab === 'deliveries' ? 'Tugas Kirim Mesin' : 'Riwayat Pemasangan'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {activeTab === 'deliveries'
              ? `${pendingStores.length} toko menunggu unit mesin`
              : `${completedStores.length} mesin terpasang`}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {activeTab === 'deliveries' ? (
        <div className="space-y-3">
          {pendingStores.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Semua Toko Sudah Terpasang Mesin!</p>
              <p className="text-[11px] text-slate-500 mt-1">Tidak ada antrean pengiriman saat ini.</p>
            </div>
          ) : (
            pendingStores.map((store) => {
              const isDelivering = store.status === 'dikirim';

              return (
                <div
                  key={store.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{store.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Pemilik: <span className="text-slate-800 dark:text-slate-200 font-bold">{store.owner_name}</span>
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isDelivering
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                      }`}
                    >
                      {isDelivering ? 'Sedang Dikirim' : 'Menunggu Mesin'}
                    </span>
                  </div>

                  {/* Address & Navigation */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 font-medium">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>{store.address}</span>
                    </div>
                    {store.latitude && store.longitude && (
                      <a
                        href={`https://maps.google.com/?q=${store.latitude},${store.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded text-[10px] font-bold flex items-center gap-1 flex-shrink-0"
                      >
                        <span>Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Phone quick call */}
                  {store.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Hubungi:</span>
                      <a
                        href={`tel:${store.phone}`}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        {store.phone}
                      </a>
                    </div>
                  )}

                  {/* Courier Action Section */}
                  {!isDelivering ? (
                    // Step 1: Assign machine & start delivery
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Pilih Unit Mesin dari Gudang:
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={selectedStore?.id === store.id ? selectedMachineId : ''}
                          onChange={(e) => {
                            setSelectedStore(store);
                            setSelectedMachineId(e.target.value);
                          }}
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono shadow-xs"
                        >
                          <option value="">-- Pilih Nomor Mesin --</option>
                          {warehouseMachines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.machine_code} ({m.notes || 'Siap Kirim'})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            isSubmitting ||
                            selectedStore?.id !== store.id ||
                            !selectedMachineId
                          }
                          onClick={() => handleStartDelivery(store, selectedMachineId)}
                          className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1 active:scale-95 transition disabled:opacity-40 shadow-xs"
                        >
                          <span>Bawa</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Step 2: Confirm installation with photo
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="text-xs text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                        <Cpu className="w-4 h-4" />
                        <span>Mesin dibawa:</span>
                        <span className="font-mono bg-blue-100 dark:bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-900 dark:text-white font-extrabold">
                          {store.machine?.machine_code || 'Unit Mesin'}
                        </span>
                      </div>

                      <CameraCapture
                        label="Foto Bukti Mesin Terpasang"
                        subLabel="Jepret foto mesin yang sudah dicolok & siap pakai di toko"
                        onPhotoCaptured={({ base64 }) => {
                          setSelectedStore(store);
                          setInstalledPhotoBlob(base64);
                        }}
                      />

                      <button
                        type="button"
                        disabled={isSubmitting || !installedPhotoBlob}
                        onClick={() => handleConfirmDelivered(store)}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition disabled:opacity-40 touch-target"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Selesai Pasang (Aktifkan Toko)</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Completed History Tab */
        <div className="space-y-3">
          {completedStores.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <Truck className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-xs font-medium">Belum ada riwayat pemasangan.</p>
            </div>
          ) : (
            completedStores.map((store) => (
              <div
                key={store.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-xs transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{store.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{store.address}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Terpasang
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Nomor Mesin:</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    {store.machine?.machine_code || '-'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
