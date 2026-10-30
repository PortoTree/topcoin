import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../context/ToastContext';
import { BottomSheetModal } from './BottomSheetModal';
import { displayMachineCode } from '../lib/machineCodeLogic';
import type { Store, DroppingTransaction } from '../types';
import {
  Store as StoreIcon,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coins,
  Camera,
  Eye,
  History,
  RefreshCw,
} from 'lucide-react';

interface StoreInfoModalProps {
  store: Store | null;
  onClose: () => void;
  machineCodeOverride?: string;
}

export const StoreInfoModal: React.FC<StoreInfoModalProps> = ({
  store,
  onClose,
  machineCodeOverride,
}) => {
  const [storeHistory, setStoreHistory] = useState<DroppingTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [activePreviewImage, setActivePreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Fetch riwayat dropping dari Supabase saat modal terbuka
  useEffect(() => {
    if (!store) {
      setStoreHistory([]);
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
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (isMounted) {
          if (!error && data && data.length > 0) {
            setStoreHistory(data as DroppingTransaction[]);
          } else {
            setStoreHistory([]);
          }
        }
      } catch (err) {
        console.warn('Error fetching store history:', err);
        if (isMounted) setStoreHistory([]);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [store]);

  const handleOpenWhatsApp = (s: Store) => {
    if (!s.phone) {
      toast.error(`Nomor WhatsApp untuk toko "${s.name}" belum terdaftar.`);
      return;
    }
    let cleaned = s.phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    }
    window.open(`https://wa.me/${cleaned}`, '_blank');
  };

  const handleOpenMaps = (s: Store) => {
    if (s.latitude && s.longitude) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`, '_blank');
    } else if (s.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}`, '_blank');
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!store) return null;

  const machineCode = displayMachineCode(
    machineCodeOverride || store.machine?.machine_code
  );

  return (
    <>
      <BottomSheetModal
        item={store}
        onClose={onClose}
        isFullscreen={true}
      >
        {(_, close) => (
          <div className="flex flex-col h-full bg-white dark:bg-slate-950">
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
                    <span className="font-mono font-black">{machineCode}</span>
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
                    className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition shadow-2xs ${
                      store.phone
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

              {/* 3. Riwayat Tracking Kunjungan */}
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
                ) : storeHistory.length > 0 ? (
                  <div className="pt-2 space-y-4">
                    {storeHistory.map((tx, idx) => {
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

                          {/* Waktu & Urutan */}
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 flex-shrink-0" />
                              {formatDateTime(tx.created_at)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                              {idx === 0 ? 'Kunjungan Terakhir' : `Kunjungan ke-${storeHistory.length - idx}`}
                            </span>
                          </div>

                          {/* Kartu Ringkasan Kunjungan */}
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                  tx.coins_collected
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                    : tx.optional_notes?.includes('Toko Tutup')
                                    ? 'border border-slate-900 text-slate-900 dark:border-white dark:text-white bg-transparent'
                                    : tx.optional_notes?.includes('Minimal Koin')
                                    ? 'border border-orange-500 text-orange-600 dark:text-orange-400 bg-transparent'
                                    : tx.photo_optional_url || tx.optional_notes
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
                                ) : tx.photo_optional_url || tx.optional_notes ? (
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
                  <div className="pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-center space-y-1">
                      <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Belum Ada Riwayat Kunjungan</span>
                      <p className="text-[11px] text-slate-500">Belum ada pencatatan transaksi untuk outlet mitra ini.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Tombol Buka Maps */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenMaps(store)}
                  className="w-full py-3 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <img src="/maps.png" alt="Maps" className="w-4 h-4 object-contain" />
                  Buka Google Maps
                </button>
              </div>
            </div>
          </div>
        )}
      </BottomSheetModal>

      {/* Lightbox Zoom Foto */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setActivePreviewImage(null)}
        >
          <div className="w-full max-w-md flex items-center justify-between pb-3 text-white">
            <span className="text-xs font-bold truncate pr-2">{activePreviewImage.title}</span>
            <button
              type="button"
              onClick={() => setActivePreviewImage(null)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-md max-h-[75vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <img
              src={activePreviewImage.url}
              alt={activePreviewImage.title}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};
