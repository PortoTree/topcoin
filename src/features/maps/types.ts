import type { Store } from '../../types';

export type MapPinCategory = 'CADANGAN' | 'PETUGAS' | 'BEKAS';

export interface StoreMapItem {
  store: Store;
  latitude: number;
  longitude: number;
  category: MapPinCategory;
  categoryLabel: string;
  badgeText: string;
  color: string;
  droppingStaffName?: string;
  machineCode?: string;
}

export interface MapNavigationUrls {
  googleMaps: string;
  waze: string;
}

