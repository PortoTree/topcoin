import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../context/ToastContext';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { compressImage } from '../../../lib/imageCompression';
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
  Camera,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
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
 * 1. Embed iframe HTML: <iframe src="https://www.google.com/maps/embed?pb=!1m18!...!2d<lng>!3d<lat>..." ...>
 * 2. Embed URL: ...!2d<lng>!3d<lat>... atau !3d<lat>!4d<lng>...
 * 3. Place / View URL: .../@<lat>,<lng>...
 * 4. Search query: ?q=<lat>,<lng> atau query=<lat>,<lng>
 * 5. Koordinat manual langsung: "-7.2575, 112.7521"
 */
export function parseGmapsCoordinates(input: string): { latitude: number; longitude: number } | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();

  // 1. Cek Google Maps Embed URL/iframe: !2d<lng>!3d<lat>
  const embedMatch = str.match(/!2d(-?\d+(?:\.\d+)?)[^!]*!3d(-?\d+(?:\.\d+)?)/i);
  if (embedMatch) {
    const lng = parseFloat(embedMatch[1]);
    const lat = parseFloat(embedMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 1b. Alternatif embed: !3d<lat>!4d<lng>
  const embedAltMatch = str.match(/!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/i);
  if (embedAltMatch) {
    const lat = parseFloat(embedAltMatch[1]);
    const lng = parseFloat(embedAltMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Cek format URL @<lat>,<lng>
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
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

  // 4. Cek format koordinat langsung: -7.2575, 112.7521
  const directMatch = str.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
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
// FORM EDIT / TAMBAH TOKO DENGAN GOOGLE MAPS EMBED & FOTO TOKO
// ===========================================================================

interface StoreFormData {
  name: string;
  owner_name: string;
  address: string;
  phone: string;
  gmaps_input: string;
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

  // Inisialisasi gmaps_input: jika edit dan sudah ada koordinat, tampilkan koordinat
  const initialGmapsInput = store?.latitude && store?.longitude
    ? `${store.latitude}, ${store.longitude}`
    : '';

  const [form, setForm] = useState<StoreFormData>({
    name: store?.name ?? '',
    owner_name: store?.owner_name ?? '',
    address: store?.address ?? '',
    phone: store?.phone ?? '',
    gmaps_input: initialGmapsInput,
  });

  // State untuk Foto Toko
  const [photoPreview, setPhotoPreview] = useState<string | null>(store?.photo_store_url || null);
  const [photoBlob, setPhotoBlob] = useState<Blob | string | null>(null);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Hidden Input Refs untuk Kamera & File Picker
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Real-time parsing Google Maps embed / link / koordinat
  const parsedCoords = useMemo(() => {
    return parseGmapsCoordinates(form.gmaps_input);
  }, [form.gmaps_input]);

  const handleChange = (field: keyof StoreFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

      // 2. Hitung titik koordinat (dari hasil generate gmaps embed/link atau data lama)
      let finalLat: number | null = null;
      let finalLng: number | null = null;

      if (parsedCoords) {
        finalLat = parsedCoords.latitude;
        finalLng = parsedCoords.longitude;
      } else if (store?.latitude && store?.longitude && form.gmaps_input.trim()) {
        finalLat = store.latitude;
        finalLng = store.longitude;
      }

      const payload = {
        name: form.name.trim(),
        owner_name: form.owner_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        branch_id: branchId,
        latitude: finalLat,
        longitude: finalLng,
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

            {/* 5. Kolom Link / Embed Google Maps */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Link / Embed Google Maps
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Generate Titik Toko</span>
              </label>
              <textarea
                rows={2}
                value={form.gmaps_input}
                onChange={(e) => handleChange('gmaps_input', e.target.value)}
                placeholder="Paste kode Embed HTML (iframe), link share Google Maps, atau koordinat (-7.2575, 112.7521)..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none"
              />

              {/* Status Real-time Titik Koordinat yang Ter-generate */}
              {parsedCoords ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-bold truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    Titik: {parsedCoords.latitude.toFixed(6)}, {parsedCoords.longitude.toFixed(6)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${parsedCoords.latitude},${parsedCoords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-bold underline hover:text-emerald-900 dark:hover:text-emerald-200 flex-shrink-0 ml-2"
                  >
                    Cek di Maps <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              ) : form.gmaps_input.trim() ? (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Titik belum terdeteksi. Pastikan link berisi koordinat atau paste embed iframe Google Maps.</span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                  💡 Tips: Di Google Maps, klik <strong>Bagikan</strong> &gt; <strong>Sematkan peta</strong> lalu copy kode HTML-nya, atau masukkan koordinat langsung.
                </p>
              )}
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

      {/* Filter Chips Horizontal */}
      <div className="pb-3 flex gap-2 overflow-x-auto scrollbar-none">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setActiveFilter(chip.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 border transition cursor-pointer ${activeFilter === chip.id
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
    </div>
  );
};
