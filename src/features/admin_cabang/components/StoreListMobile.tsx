import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { compressImage } from '../../../lib/imageCompression';
import { getDeviceLocation } from '../../../lib/geolocation';
import { BottomSheetModal } from '../../../components/BottomSheetModal';
import { ActionPromptModal, type ActionPromptConfig } from '../../../components/ActionPromptModal';
import { StoreInfoModal } from '../../../components/StoreInfoModal';
import { displayMachineCode } from '../../../lib/machineCodeLogic';
import { useMobileBackHandler } from '../../../hooks/useMobileBackHandler';
import { StoreMapMobile } from '../../maps/components/StoreMapMobile';
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
  Camera,
  Image as ImageIcon,
  ExternalLink,
  Filter,
  ChevronDown,
  Check,
  Map as MapIcon,
  Navigation,
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
 * Ekstraksi koordinat latitude & longitude dari berbagai varian input Google Maps:
 * 1. Exact Place Pin Google Maps: !3d<lat>!4d<lng> (Prioritas Tertinggi: 100% tepat ke atap/pin gedung)
 * 2. Koordinat manual langsung: "-7.2575, 112.7521" atau "-7.2575 112.7521" (Hasil klik kanan di Google Maps)
 * 3. Query parameter: ?q=<lat>,<lng> atau query=<lat>,<lng> atau ll=<lat>,<lng>
 * 4. Format URL @<lat>,<lng> (Viewport kamera Google Maps)
 * 5. Embed iframe / pb: !2d<lng>!3d<lat> (Viewport kamera saat sematkan peta)
 */
export function parseGmapsCoordinates(input: string): { latitude: number; longitude: number } | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  // 1. Cek Exact Place Pin Google Maps: !3d<lat>!4d<lng> (Prioritas Tertinggi: ada di URL address bar Google Maps)
  const exactPinMatch = str.match(/!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/i);
  if (exactPinMatch) {
    const lat = parseFloat(exactPinMatch[1]);
    const lng = parseFloat(exactPinMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Cek format koordinat langsung: -7.2575, 112.7521 (Hasil klik kanan di Google Maps)
  const directMatch = str.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Cek query parameter q=<lat>,<lng> atau query=<lat>,<lng> atau ll=<lat>,<lng>
  const queryMatch = str.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. Cek format URL @<lat>,<lng> (Viewport kamera Google Maps)
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 5. Cek Google Maps Embed URL/iframe: !2d<lng>!3d<lat> (Viewport kamera iframe)
  const embedMatch = str.match(/!2d(-?\d+(?:\.\d+)?)[^!]*!3d(-?\d+(?:\.\d+)?)/i);
  if (embedMatch) {
    const lng = parseFloat(embedMatch[1]);
    const lat = parseFloat(embedMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

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
// FORM EDIT / TAMBAH TOKO DENGAN GPS GEOLOCATION & FOTO TOKO
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

  // State Titik Koordinat GPS Toko (Fitur Kunci GPS sama seperti di Akun Marketing)
  const [latitude, setLatitude] = useState<number | null>(store?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(store?.longitude ?? null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [showManualCoord, setShowManualCoord] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>(
    store?.latitude && store?.longitude ? `${store.latitude}, ${store.longitude}` : ''
  );

  // State untuk Foto Toko
  const [photoPreview, setPhotoPreview] = useState<string | null>(store?.photo_store_url || null);
  const [photoBlob, setPhotoBlob] = useState<Blob | string | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Hidden Input Refs untuk Kamera & File Picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof StoreFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // GPS Auto-detect / Kunci GPS dengan dukungan multi-stage fallback & pesan error akurat
  const handleGetLocation = async () => {
    setIsGettingGps(true);
    try {
      const pos = await getDeviceLocation();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      setGpsAccuracy(pos.accuracy);
      setManualInput(`${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`);
      toast.success(`Titik GPS toko berhasil dikunci (±${pos.accuracy}m).`);
    } catch (errMsg: any) {
      console.warn('GPS location error:', errMsg);
      toast.error(typeof errMsg === 'string' ? errMsg : 'Gagal mendeteksi lokasi GPS.');
    } finally {
      setIsGettingGps(false);
    }
  };

  // Handler input koordinat / link Maps manual jika admin tidak sedang di toko
  const handleManualInputChange = (val: string) => {
    setManualInput(val);
    const parsed = parseGmapsCoordinates(val);
    if (parsed) {
      setLatitude(parsed.latitude);
      setLongitude(parsed.longitude);
      setGpsAccuracy(null);
    } else if (!val.trim()) {
      setLatitude(null);
      setLongitude(null);
      setGpsAccuracy(null);
    }
  };

  // Handler saat user memilih file gambar dari Kamera atau Galeri
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Kompres gambar otomatis di sisi client (target WebP ~150-250 KB)
      const compressed = await compressImage(file, 1200, 1200, 0.75);
      setPhotoPreview(compressed.base64);
      setPhotoBlob(compressed.blob);
      setIsPhotoRemoved(false);
      toast.success('Foto toko berhasil dimuat.');
    } catch (err) {
      console.warn('Gagal mengompres foto, menggunakan fallback:', err);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setPhotoBlob(file);
      setIsPhotoRemoved(false);
    } finally {
      // Reset input agar bisa memilih ulang file yang sama jika diperlukan
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoBlob(null);
    setIsPhotoRemoved(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Nama toko wajib diisi.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Unggah foto ke Cloudinary jika ada foto baru
      let finalPhotoUrl = isPhotoRemoved ? null : (store?.photo_store_url || null);
      if (photoBlob) {
        try {
          const uploadedUrl = await uploadToCloudinary(photoBlob, 'stores');
          if (uploadedUrl) {
            finalPhotoUrl = uploadedUrl;
          }
        } catch (uploadErr) {
          console.warn('Gagal upload ke Cloudinary, fallback local:', uploadErr);
          if (typeof photoPreview === 'string') {
            finalPhotoUrl = photoPreview;
          }
        }
      }

      const payload = {
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        branch_id: branchId,
        latitude: latitude,
        longitude: longitude,
        photo_store_url: finalPhotoUrl,
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
          .insert({
            ...payload,
            status: 'proses',
            current_machine_id: null,
          })
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
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
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

          {/* Hidden File Inputs (Kamera & Galeri) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageFileChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />

          {/* Form Fields */}
          <div className="space-y-3.5">
            {/* 1. Nama Toko */}
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

            {/* 2. Nama Pemilik */}
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

            {/* 3. Alamat */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Toko
              </label>
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Contoh: Jl. Basuki Rahmat No. 12, Surabaya"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* 4. Nomor WhatsApp */}
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

            {/* 5. Titik Koordinat GPS Toko (1 Kolom Stacked - Tombol di Bawah) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  Titik Koordinat GPS Toko
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-snug">
                  {latitude && longitude
                    ? `Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}${gpsAccuracy ? ` (±${gpsAccuracy}m)` : ''}`
                    : 'Ambil titik lokasi langsung saat berada di toko mitra.'}
                </p>
              </div>

              {/* Tombol Kunci GPS Full Width di Bawah */}
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isGettingGps}
                className="w-full py-2.5 px-3 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGettingGps ? 'animate-spin' : ''}`} />
                {latitude ? 'Perbarui Titik GPS' : 'Kunci GPS'}
              </button>

              {/* Status dan Tindakan Tambahan jika Koordinat Ada */}
              {latitude && longitude && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                  <a
                    href={`https://maps.google.com/?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Cek di Google Maps
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(null);
                      setLongitude(null);
                      setGpsAccuracy(null);
                      setManualInput('');
                      toast.info('Titik koordinat dihapus.');
                    }}
                    className="text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    Hapus Titik
                  </button>
                </div>
              )}

              {/* Opsi alternatif input manual jika admin tidak berada di lokasi toko */}
              <div className="pt-0.5">
                {!showManualCoord ? (
                  <button
                    type="button"
                    onClick={() => setShowManualCoord(true)}
                    className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium underline cursor-pointer"
                  >
                    + Masukkan koordinat maps
                  </button>
                ) : (
                  <div className="space-y-1.5 mt-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        Input Koordinat:
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowManualCoord(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => handleManualInputChange(e.target.value)}
                      placeholder="Contoh: -8.153713, 112.583569"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                    {manualInput.trim() && !latitude && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Format koordinat belum valid. Masukkan angka (misal: -8.153713, 112.583569).
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 6. Kolom Buka Kamera & Upload Foto Toko */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Foto Tampak Depan Toko
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Kamera / Galeri</span>
              </label>

              {photoPreview ? (
                <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 group">
                  <img
                    src={photoPreview}
                    alt="Preview Foto Toko"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white/90 text-slate-900 text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-white cursor-pointer"
                    >
                      <Camera className="w-3 h-3" /> Foto Ulang
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-md hover:bg-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                  {/* Tombol Hapus Pojok Kanan Atas Selalu Siap Tap */}
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer shadow-xs"
                    title="Hapus foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-3 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span>Buka Kamera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-3 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-200 text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span>Pilih dari Galeri</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
              {isSaving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Toko'}
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
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [selectedStoreInfo, setSelectedStoreInfo] = useState<Store | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [actionPrompt, setActionPrompt] = useState<ActionPromptConfig | null>(null);

  // Tutup dropdown filter saat user menekan tombol Back bawaan HP
  useMobileBackHandler({
    enabled: isFilterDropdownOpen,
    onBack: () => setIsFilterDropdownOpen(false),
  });

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

      // Default: CADANGAN
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
  // FILTER DROPDOWN OPTIONS
  // =========================================================================

  const filterOptions = useMemo(() => {
    let countCadangan = 0;
    let countBekas = 0;
    const staffCountMap = new Map<string, number>();

    for (const cs of categorizedStores) {
      if (cs.category === 'CADANGAN') {
        countCadangan++;
      } else if (cs.category === 'BEKAS') {
        countBekas++;
      } else if (cs.droppingStaffName) {
        const cur = staffCountMap.get(cs.droppingStaffName) || 0;
        staffCountMap.set(cs.droppingStaffName, cur + 1);
      }
    }

    return [
      {
        id: 'all',
        label: 'Semua',
        fullLabel: 'Semua Kategori Toko',
        count: stores.length,
        dotColor: 'bg-indigo-500',
      },
      {
        id: 'CADANGAN',
        label: 'Cadangan',
        fullLabel: 'Cadangan',
        count: countCadangan,
        dotColor: 'bg-amber-500',
      },
      ...droppingStaffGroups.map((name) => ({
        id: name,
        label: name.split(' ')[0], // Nama panggilan petugas
        fullLabel: `${name}`,
        count: staffCountMap.get(name) || 0,
        dotColor: 'bg-emerald-500',
      })),
      {
        id: 'BEKAS',
        label: 'Bekas',
        fullLabel: 'Bekas',
        count: countBekas,
        dotColor: 'bg-rose-500',
      },
    ];
  }, [stores.length, categorizedStores, droppingStaffGroups]);

  const activeOption = useMemo(() => {
    return filterOptions.find((opt) => opt.id === activeFilter) || filterOptions[0];
  }, [filterOptions, activeFilter]);

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
            Daftar Toko Mitra
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
            Tambah
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

      {/* Baris Tombol [Buka Maps] (Kiri) & Filter Dropdown (Kanan) */}
      <div className="flex items-center gap-2 pb-3">
        {/* Tombol Buka Maps */}
        <button
          type="button"
          onClick={() => setShowMapView(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer flex-shrink-0"
          title="Buka Peta Persebaran Toko Mitra"
        >
          <MapIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="whitespace-nowrap">Buka Maps</span>
        </button>

        {/* Filter Dropdown */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-2xs active:scale-[0.99] transition cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Filter className="w-3 h-3" />
              </div>
              <span className="truncate font-extrabold text-xs text-slate-900 dark:text-white">
                {activeOption.label}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex-shrink-0">
                ({activeOption.count})
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
              <span className={`w-2 h-2 rounded-full ${activeOption.dotColor}`} />
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                  }`}
              />
            </div>
          </button>

          {/* Dropdown Floating Menu */}
          {isFilterDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsFilterDropdownOpen(false)}
              />
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
                  <span>Pilih Kategori Toko</span>

                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-none">
                  {filterOptions.map((opt) => {
                    const isSelected = activeFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setActiveFilter(opt.id);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-extrabold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 font-medium'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${opt.dotColor}`} />
                          <span className="truncate">{opt.fullLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span
                            className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isSelected
                              ? 'bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                          >
                            {opt.count}
                          </span>
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
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
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide ${category === 'CADANGAN'
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

      {/* ===== MODAL: Detail Informasi Toko Mitra ===== */}
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
                    setSelectedStoreInfo(null);
                    setEditingStore(targetStore);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95 transition"
                >
                  <Pencil className="w-4 h-4" />
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

      {/* ===== VIEW: Peta Persebaran Lokasi Toko Mitra (Leaflet.js) ===== */}
      {showMapView && (
        <StoreMapMobile
          stores={stores}
          machines={machines}
          droppingUsers={droppingUsers}
          relocatedStoreIds={relocatedStoreIds}
          branchName={branchName}
          initialFilter={activeFilter}
          onClose={() => setShowMapView(false)}
          onOpenStoreDetail={(targetStore) => {
            setShowMapView(false);
            setSelectedStoreInfo(targetStore);
          }}
        />
      )}
    </div>
  );
};
