import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Navigation,
  Layers,
  MapPin,
  Phone,
  X,
  Maximize2,
  Store as StoreIcon,
} from 'lucide-react';
import type { Store, Machine, UserProfile } from '../../../types';
import type { StoreMapItem } from '../types';
import {
  filterValidMapStores,
  getStoreMapCategory,
  getNavigationUrls,
} from '../utils/mapLogic';
import { useMobileBackHandler } from '../../../hooks/useMobileBackHandler';
import { toast } from '../../../context/ToastContext';

interface StoreMapMobileProps {
  stores: Store[];
  machines: Machine[];
  droppingUsers: UserProfile[];
  relocatedStoreIds?: Set<string>;
  branchName?: string;
  initialFilter?: string;
  onClose: () => void;
  onOpenStoreDetail?: (store: Store) => void;
}

export const StoreMapMobile: React.FC<StoreMapMobileProps> = ({
  stores,
  machines,
  droppingUsers,
  relocatedStoreIds = new Set(),
  branchName,
  initialFilter = 'all',
  onClose,
  onOpenStoreDetail,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [selectedItem, setSelectedItem] = useState<StoreMapItem | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [tileMode, setTileMode] = useState<'auto' | 'satellite'>('auto');

  // Deteksi tema gelap dari DOM
  const isDarkMode = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;

  // Tombol Back bawaan HP: tutup card info toko jika terbuka, atau kembali ke list toko
  useMobileBackHandler({
    enabled: true,
    onBack: () => {
      if (selectedItem) {
        setSelectedItem(null);
      } else {
        onClose();
      }
    },
  });

  // Transform toko valid ke StoreMapItem
  const mapItems = useMemo<StoreMapItem[]>(() => {
    const validStores = filterValidMapStores(stores);
    return validStores.map((store) => {
      const catInfo = getStoreMapCategory(store, machines, droppingUsers, relocatedStoreIds);
      return {
        store,
        latitude: typeof store.latitude === 'number' ? store.latitude : parseFloat(store.latitude as unknown as string),
        longitude: typeof store.longitude === 'number' ? store.longitude : parseFloat(store.longitude as unknown as string),
        category: catInfo.category,
        categoryLabel: catInfo.label,
        badgeText: catInfo.badgeText,
        color: catInfo.color,
        droppingStaffName: catInfo.droppingStaffName,
        machineCode: catInfo.machineCode,
      };
    });
  }, [stores, machines, droppingUsers, relocatedStoreIds]);

  // Filter pin marker berdasarkan filter aktif
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return mapItems;
    if (activeFilter === 'CADANGAN') return mapItems.filter((i) => i.category === 'CADANGAN');
    if (activeFilter === 'BEKAS') return mapItems.filter((i) => i.category === 'BEKAS');
    return mapItems.filter((i) => i.droppingStaffName === activeFilter);
  }, [mapItems, activeFilter]);

  // Opsi filter
  const filterOptions = useMemo(() => {
    const staffNames = Array.from(
      new Set(
        mapItems
          .map((i) => i.droppingStaffName)
          .filter((name): name is string => Boolean(name))
      )
    );

    return [
      { id: 'all', label: 'Semua', count: mapItems.length },
      { id: 'CADANGAN', label: 'Cadangan', count: mapItems.filter((i) => i.category === 'CADANGAN').length },
      ...staffNames.map((name) => ({
        id: name,
        label: name.split(' ')[0],
        count: mapItems.filter((i) => i.droppingStaffName === name).length,
      })),
      { id: 'BEKAS', label: 'Bekas', count: mapItems.filter((i) => i.category === 'BEKAS').length },
    ];
  }, [mapItems]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Hitung pusat awal peta
    let defaultLat = -7.2575;
    let defaultLng = 112.7521;
    let initialZoom = 12;

    if (mapItems.length > 0) {
      defaultLat = mapItems[0].latitude;
      defaultLng = mapItems[0].longitude;
    }

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: initialZoom,
      zoomControl: false, // Kita buat tombol zoom kustom
      attributionControl: false,
    });

    // Layer Markers
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Klik pada kanvas peta untuk menutup pop-up kartu
    map.on('click', () => {
      setSelectedItem(null);
    });

    // Invalidate size setelah DOM siap
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (mapItems.length > 0) {
        const bounds = L.latLngBounds(mapItems.map((i) => [i.latitude, i.longitude]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer saat mode tema (Dark/Light) atau satellite berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Hapus tile layer lama
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = '';
    let maxZoom = 19;

    if (tileMode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (isDarkMode) {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }

    L.tileLayer(tileUrl, {
      maxZoom,
      subdomains: 'abcd',
    }).addTo(map);

  }, [isDarkMode, tileMode]);

  // Update Marker Pin saat filteredItems atau selectedItem berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    filteredItems.forEach((item) => {
      const isSelected = selectedItem?.store.id === item.store.id;
      const pinScale = isSelected ? 'scale-125 z-50' : 'scale-100 hover:scale-105';
      const ringStyle = isSelected ? 'ring-4 ring-indigo-400 ring-offset-2' : '';

      const customIcon = L.divIcon({
        className: 'custom-store-pin',
        iconSize: [80, 52],
        iconAnchor: [40, 46],
        html: `
          <div class="flex flex-col items-center cursor-pointer transition-transform duration-200 ${pinScale}">
            <div style="background-color: ${item.color}; color: #ffffff;" class="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide shadow-md whitespace-nowrap mb-0.5 uppercase border border-white/80 max-w-[85px] truncate">
              ${item.badgeText}
            </div>
            <div style="background-color: ${item.color}; border: 2.5px solid #ffffff;" class="w-7 h-7 rounded-full shadow-lg flex items-center justify-center text-white ${ringStyle}">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
            <div style="border-top-color: ${item.color};" class="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] -mt-0.5"></div>
          </div>
        `,
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: customIcon });

      marker.on('click', () => {
        setSelectedItem(item);
        map.panTo([item.latitude, item.longitude], { animate: true, duration: 0.5 });
      });

      markersLayer.addLayer(marker);
    });
  }, [filteredItems, selectedItem]);

  // Fit All Markers
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredItems.length === 0) return;
    const bounds = L.latLngBounds(filteredItems.map((i) => [i.latitude, i.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  // GPS realtime user position
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      toast.error('Perangkat Anda tidak mendukung fitur lokasi GPS.');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        map.flyTo([latitude, longitude], 15, { animate: true, duration: 1 });

        // Marker posisi pengguna
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            html: `
              <div class="relative w-6 h-6 flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-lg"></span>
              </div>
            `,
          });
          userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
        }
        toast.success('Lokasi Anda berhasil ditemukan.');
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Geolocation error:', err);
        toast.error('Gagal mengambil posisi GPS. Pastikan izin lokasi aktif.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* 1. Header Bar Atas */}
      <div className="flex items-center justify-between px-3.5 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer active:scale-95 flex-shrink-0"
            title="Kembali ke Daftar Toko"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">
              Peta Mitra Toko
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {branchName ? `${branchName} • ` : ''}{filteredItems.length} titik terpetakan
            </p>
          </div>
        </div>

        {/* Toggle Satelit & Fit All */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'auto' ? 'satellite' : 'auto'))}
            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 ${
              tileMode === 'satellite'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Ganti Tampilan Peta Satelit / Jalan"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitAll}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
            title="Pusatkan Seluruh Titik Toko"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Floating Filter Pills (Horisontal di Atas Peta) */}
      <div className="absolute top-14 left-0 right-0 z-20 px-3 py-2 pointer-events-none">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pointer-events-auto py-1">
          {filterOptions.map((opt) => {
            const isSelected = activeFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setActiveFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Kontainer Peta Leaflet */}
      <div className="relative flex-1 w-full h-full bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating GPS Button */}
        <div className="absolute bottom-6 right-3.5 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLocateUser}
            disabled={isLocatingUser}
            className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xl flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Temukan Posisi Saya"
          >
            <Navigation className={`w-5 h-5 ${isLocatingUser ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Bottom Sheet Kartu Toko (Muncul saat Pin Marker Diklik) */}
      {selectedItem && (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
          <div className="pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in slide-in-from-bottom duration-200 max-w-lg mx-auto">
            {/* Header Kartu */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    style={{ backgroundColor: selectedItem.color }}
                    className="w-2 h-2 rounded-full flex-shrink-0"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    {selectedItem.categoryLabel}
                  </span>
                  {selectedItem.machineCode && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                      Mesin: {selectedItem.machineCode}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight truncate">
                  {selectedItem.store.name}
                </h3>
                {selectedItem.store.owner_name && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Pemilik: {selectedItem.store.owner_name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer active:scale-95 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Foto Toko (jika ada) */}
            {selectedItem.store.photo_store_url && (
              <div className="relative w-full h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <img
                  src={selectedItem.store.photo_store_url}
                  alt={selectedItem.store.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Alamat */}
            {selectedItem.store.address && (
              <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{selectedItem.store.address}</span>
              </div>
            )}

            {/* Tombol Aksi Lapangan */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              {/* Tombol WhatsApp */}
              {selectedItem.store.phone ? (
                <a
                  href={`https://wa.me/${selectedItem.store.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <button
                  disabled
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>No WA (-)</span>
                </button>
              )}

              {/* Tombol Navigasi Google Maps */}
              <a
                href={getNavigationUrls(selectedItem.latitude, selectedItem.longitude, selectedItem.store.name).googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigasi Maps</span>
              </a>

              {/* Tombol Detail Lengkap (jika handler disediakan) */}
              {onOpenStoreDetail && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenStoreDetail(selectedItem.store);
                  }}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Lihat Detail Riwayat Kunjungan Toko"
                >
                  <StoreIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
