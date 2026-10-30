import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  X,
  Layers,
  Maximize2,
  Phone,
  Navigation,
} from 'lucide-react';
import type { Store, Machine, UserProfile } from '../../../types';
import type { StoreMapItem } from '../types';
import {
  filterValidMapStores,
  getStoreMapCategory,
  getNavigationUrls,
} from '../utils/mapLogic';

interface StoreMapDesktopProps {
  stores: Store[];
  machines: Machine[];
  droppingUsers: UserProfile[];
  relocatedStoreIds?: Set<string>;
  branchName?: string;
  onClose?: () => void;
  onOpenStoreDetail?: (store: Store) => void;
}

export const StoreMapDesktop: React.FC<StoreMapDesktopProps> = ({
  stores,
  machines,
  droppingUsers,
  relocatedStoreIds = new Set(),
  branchName,
  onClose,
  onOpenStoreDetail,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<StoreMapItem | null>(null);
  const [tileMode, setTileMode] = useState<'auto' | 'satellite'>('auto');

  const isDarkMode = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark')
    : false;

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

  const filteredItems = useMemo(() => {
    return mapItems.filter((i) => {
      if (activeFilter === 'CADANGAN' && i.category !== 'CADANGAN') return false;
      if (activeFilter === 'BEKAS' && i.category !== 'BEKAS') return false;
      if (activeFilter !== 'all' && activeFilter !== 'CADANGAN' && activeFilter !== 'BEKAS') {
        if (i.droppingStaffName !== activeFilter) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = i.store.name.toLowerCase().includes(q);
        const matchOwner = i.store.owner_name?.toLowerCase().includes(q);
        const matchAddress = i.store.address?.toLowerCase().includes(q);
        if (!matchName && !matchOwner && !matchAddress) return false;
      }
      return true;
    });
  }, [mapItems, activeFilter, searchQuery]);

  // Init Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let defaultLat = -7.2575;
    let defaultLng = 112.7521;
    if (mapItems.length > 0) {
      defaultLat = mapItems[0].latitude;
      defaultLng = mapItems[0].longitude;
    }

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 12,
      attributionControl: false,
    });

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
      if (mapItems.length > 0) {
        const bounds = L.latLngBounds(mapItems.map((i) => [i.latitude, i.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    let tileUrl = '';
    if (tileMode === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (isDarkMode) {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }

    L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  }, [isDarkMode, tileMode]);

  // Update markers
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
        map.panTo([item.latitude, item.longitude], { animate: true });
      });
      markersLayer.addLayer(marker);
    });
  }, [filteredItems, selectedItem]);

  return (
    <div className="flex h-[80vh] w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Sidebar Kiri (380px) */}
      <div className="w-[380px] flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex-shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Peta Toko Mitra</h3>
              <p className="text-xs text-slate-500">{branchName || 'Cabang'} • {filteredItems.length} titik</p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search bar & filter pills */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari toko atau alamat..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
            {['all', 'CADANGAN', 'BEKAS'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  activeFilter === f
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'CADANGAN' ? 'Cadangan' : 'Bekas'}
              </button>
            ))}
          </div>
        </div>

        {/* List Toko Viewport */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredItems.map((item) => {
            const isSelected = selectedItem?.store.id === item.store.id;
            return (
              <div
                key={item.store.id}
                onClick={() => {
                  setSelectedItem(item);
                  mapInstanceRef.current?.panTo([item.latitude, item.longitude], { animate: true });
                }}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.store.name}</h4>
                  <span
                    style={{ backgroundColor: item.color }}
                    className="text-[9px] font-black text-white px-2 py-0.5 rounded-full uppercase"
                  >
                    {item.badgeText}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.store.address || 'Alamat belum ada'}</p>
              </div>
            );
          })}
        </div>

        {/* Selected Store Footer Action Panel */}
        {selectedItem && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {selectedItem.store.name}
              </span>
              {onOpenStoreDetail && (
                <button
                  type="button"
                  onClick={() => onOpenStoreDetail(selectedItem.store)}
                  className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  Detail Toko
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {selectedItem.store.phone && (
                <a
                  href={`https://wa.me/${selectedItem.store.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                >
                  <Phone className="w-3 h-3" /> WA
                </a>
              )}
              <a
                href={getNavigationUrls(selectedItem.latitude, selectedItem.longitude, selectedItem.store.name).googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
              >
                <Navigation className="w-3 h-3" /> Navigasi
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Kontainer Peta Kanan */}
      <div className="flex-1 relative h-full">
        {/* Floating Controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'auto' ? 'satellite' : 'auto'))}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>{tileMode === 'satellite' ? 'Jalan' : 'Satelit'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (filteredItems.length > 0) {
                const bounds = L.latLngBounds(filteredItems.map((i) => [i.latitude, i.longitude]));
                mapInstanceRef.current?.fitBounds(bounds, { padding: [40, 40] });
              }
            }}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Pusatkan</span>
          </button>
        </div>
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>
    </div>
  );
};
