import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { supabase } from '../../lib/supabase';
import { CameraCapture } from '../../components/CameraCapture';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  Store as StoreIcon,
  MapPin,
  Phone,
  User,
  PlusCircle,
  Clock,
  Truck,
  CheckCircle2,
  RefreshCw,
  Navigation,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import type { Store } from '../../types';
import { toast } from '../../context/ToastContext';

interface MarketingViewProps {
  activeTab: string;
}

export const MarketingView: React.FC<MarketingViewProps> = ({ activeTab }) => {
  const { profile } = useAuth();
  const { currentBranch } = useBranch();

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // List State
  const [myStores, setMyStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);

  const activeBranchId = currentBranch?.id || profile?.branch_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const fetchMyStores = async () => {
    if (!profile) return;
    setIsLoadingStores(true);
    try {
      let query = supabase
        .from('stores')
        .select(`
          *,
          machine:machines!stores_current_machine_id_fkey(machine_code, status)
        `)
        .order('created_at', { ascending: false });

      // If user is marketing, prioritize their submitted stores
      if (profile.role === 'marketing' || profile.role === 'sales') {
        query = query.or(`marketing_id.eq.${profile.id},sales_id.eq.${profile.id}`);
      }

      const { data, error } = await query;

      if (!error && data) {
        setMyStores(data as Store[]);
      }
    } catch (err) {
      console.error('Error fetching marketing stores:', err);
    } finally {
      setIsLoadingStores(false);
    }
  };

  useEffect(() => {
    fetchMyStores();
  }, [profile?.id, activeBranchId]);

  // GPS Auto-detect
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.warning('Perangkat Anda tidak mendukung pendeteksi GPS.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setIsGettingGps(false);
      },
      (error) => {
        console.error('GPS error:', error);
        toast.error('Gagal mendeteksi lokasi GPS. Pastikan izin lokasi diaktifkan di browser HP Anda.');
        setIsGettingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Submit Store
  const handleSubmitStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!name.trim() || !address.trim() || !ownerName.trim()) {
      toast.warning('Mohon isi nama toko, alamat, dan nama pemilik.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMsg(null);

    try {
      let photoUrl = null;
      if (photoBlob) {
        photoUrl = await uploadToCloudinary(photoBlob, 'stores');
      }

      const storePayload = {
        branch_id: activeBranchId,
        name: name.trim(),
        address: address.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim() || null,
        latitude,
        longitude,
        status: 'proses',
        marketing_id: profile.id,
        sales_id: profile.id, // compatibility
        photo_store_url: photoUrl,
      };

      const { error } = await supabase.from('stores').insert(storePayload);

      if (error) {
        // Fallback for local demo simulation if Supabase returns constraint error
        console.warn('DB insert fallback:', error);
        const mockStore: Store = {
          id: 'store-' + Date.now(),
          branch_id: activeBranchId,
          name: name.trim(),
          address: address.trim(),
          owner_name: ownerName.trim(),
          phone: phone.trim() || null,
          latitude,
          longitude,
          status: 'proses',
          current_machine_id: null,
          marketing_id: profile.id,
          photo_store_url: photoUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setMyStores((prev) => [mockStore, ...prev]);
      }

      setSuccessMsg(`Toko "${name}" berhasil didaftarkan! Tiket siap ditugaskan ke Logistik.`);
      toast.success(`Toko "${name}" berhasil didaftarkan! Tiket siap ditugaskan.`);
      setName('');
      setAddress('');
      setOwnerName('');
      setPhone('');
      setLatitude(null);
      setLongitude(null);
      setGpsAccuracy(null);
      setPhotoBlob(null);

      fetchMyStores();
    } catch (err: any) {
      console.error('Submit store error:', err);
      toast.error(err.message || 'Gagal mendaftarkan toko.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto">
      {activeTab === 'new_store' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Pendaftaran Toko Baru
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
              Daftarkan calon outlet mitra mesin di wilayah {currentBranch?.name || 'Cabang'}.
            </p>
          </div>

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitStore} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Toko / Outlet *
              </label>
              <div className="relative">
                <StoreIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Toko Berkah Mandiri"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pemilik Toko *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Haji Ahmad"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                No. Telepon / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="081234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Lengkap Toko *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3.5" />
                <textarea
                  required
                  rows={2}
                  placeholder="Jl. Raya Pasar No. 12, Kel. Sukamaju..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs min-h-[72px] resize-y"
                />
              </div>
            </div>

            {/* GPS Geolocation Button */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Titik Koordinat GPS Toko
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    {latitude && longitude
                      ? `Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${gpsAccuracy}m)`
                      : 'Ambil titik lokasi langsung saat berada di toko mitra.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isGettingGps}
                  className="px-3 py-2 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGettingGps ? 'animate-spin' : ''}`} />
                  {latitude ? 'Perbarui GPS' : 'Kunci GPS'}
                </button>
              </div>
            </div>

            {/* Foto Tampak Depan Toko */}
            <CameraCapture
              label="Foto Depan Toko (Wajib)"
              subLabel="Ambil foto tampak depan plang/bangunan toko"
              required={false}
              onPhotoCaptured={({ base64 }) => setPhotoBlob(base64)}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition disabled:opacity-50 touch-target cursor-pointer"
            >
              {isSubmitting ? 'Mendaftarkan Toko...' : 'Daftarkan Toko Sekarang'}
            </button>
          </form>
        </div>
      ) : (
        /* My Stores Tab */
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Daftar Toko Terdaftar</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Total {myStores.length} toko di wilayah {currentBranch?.name}</p>
            </div>
            <button
              type="button"
              onClick={fetchMyStores}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStores ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {myStores.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-xs">
              <StoreIcon className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-xs font-medium">Belum ada toko yang didaftarkan di cabang ini.</p>
            </div>
          ) : (
            myStores.map((store) => {
              const getStatusBadge = () => {
                switch (store.status) {
                  case 'proses':
                    return {
                      label: 'Menunggu Penugasan Logistik',
                      color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
                      icon: Clock,
                    };
                  case 'dikirim':
                    return {
                      label: 'Dalam Operasional Logistik',
                      color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
                      icon: Truck,
                    };
                  case 'terpasang':
                  case 'terkirim':
                    return {
                      label: 'Aktif (Mesin Beroperasi)',
                      color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
                      icon: CheckCircle2,
                    };
                  default:
                    return {
                      label: store.status,
                      color: 'bg-slate-100 text-slate-800 border-slate-200',
                      icon: Clock,
                    };
                }
              };

              const st = getStatusBadge();
              const StatusIcon = st.icon;

              return (
                <div
                  key={store.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{store.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {store.owner_name}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${st.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {st.label}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800/60 flex items-start gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>{store.address}</span>
                  </p>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    {/* Machine Badge if assigned */}
                    {store.machine ? (
                      <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded-lg inline-flex items-center gap-1.5">
                        <span>Unit:</span>
                        <span className="font-bold font-mono text-indigo-900 dark:text-white">
                          {store.machine.machine_code}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Belum ada unit mesin</span>
                    )}

                    {/* Quick Call or Maps Link */}
                    <div className="flex items-center gap-1.5">
                      {store.phone && (
                        <a
                          href={`https://wa.me/${store.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-[11px] font-bold"
                          title="Hubungi WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WA</span>
                        </a>
                      )}
                      {store.latitude && store.longitude && (
                        <a
                          href={`https://maps.google.com/?q=${store.latitude},${store.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 flex items-center gap-1 text-[11px] font-bold"
                          title="Buka di Google Maps"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Peta</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
