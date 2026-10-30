// Generator palet warna dinamis berbasis hash string
const PALETTE = [
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#3b82f6', // Blue
];

export function getStaffColor(nameOrId) {
  if (!nameOrId || typeof nameOrId !== 'string') return '#6366f1';
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = nameOrId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function filterValidMapStores(stores) {
  if (!Array.isArray(stores)) return [];
  return stores.filter((s) => {
    if (s.latitude === null || s.latitude === undefined) return false;
    if (s.longitude === null || s.longitude === undefined) return false;
    const lat = typeof s.latitude === 'number' ? s.latitude : parseFloat(s.latitude);
    const lng = typeof s.longitude === 'number' ? s.longitude : parseFloat(s.longitude);
    if (isNaN(lat) || isNaN(lng)) return false;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    return true;
  });
}

export function getNavigationUrls(latitude, longitude, storeName = '') {
  const encodedName = encodeURIComponent(storeName || 'Toko Mitra');
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodedName}`,
    waze: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
  };
}

export function getStoreMapCategory(store, machines = [], droppingUsers = [], relocatedStoreIds = new Set()) {
  const isBekas = relocatedStoreIds instanceof Set
    ? relocatedStoreIds.has(store.id)
    : false;

  const machineId = store.current_machine_id || store.machine?.id;
  const assignedMachine = machineId ? machines.find((m) => m.id === machineId) : null;
  const droppingId = assignedMachine?.assigned_dropping_id;
  const droppingUser = droppingId ? droppingUsers.find((u) => u.id === droppingId) : null;
  const droppingName = droppingUser?.full_name;

  if (isBekas && !assignedMachine) {
    return {
      category: 'BEKAS',
      label: 'Bekas (Pernah Pasang)',
      badgeText: 'Bekas',
      color: '#f43f5e', // Rose
      droppingStaffName: undefined,
      machineCode: undefined,
    };
  }

  if (assignedMachine && droppingName) {
    const firstName = droppingName.split(' ')[0];
    return {
      category: 'PETUGAS',
      label: `Petugas: ${droppingName}`,
      badgeText: `DRP: ${firstName}`,
      color: getStaffColor(droppingName),
      droppingStaffName: droppingName,
      machineCode: assignedMachine.machine_code,
    };
  }

  return {
    category: 'CADANGAN',
    label: 'Cadangan (Marketing)',
    badgeText: 'Cadangan',
    color: '#f59e0b', // Amber
    droppingStaffName: undefined,
    machineCode: undefined,
  };
}
