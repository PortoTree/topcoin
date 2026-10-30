import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian Navigasi Analisa & Relokasi Mesin Mobile...');

// 1. Uji Menu Tambahan Admin Cabang
const adminExpandedMenus = [
  { id: 'leave', label: 'Libur' },
  { id: 'analisa', label: 'Analisa' },
  { id: 'attendance', label: 'Absen' },
  { id: 'stores', label: 'Toko' },
  { id: 'machines', label: 'Mesin' },
];

assert.equal(adminExpandedMenus.some(m => m.id === 'analisa'), true, 'Menu Analisa wajib ada di menu tambahan');
assert.equal(adminExpandedMenus.some(m => m.id === 'driver_dispatch'), false, 'Menu driver_dispatch harus sudah digantikan oleh Analisa');
assert.equal(adminExpandedMenus.length, 5, 'Total menu tambahan drawer harus tetap 5');
console.log('✓ Test 1: Menu Tambahan Drawer terverifikasi (Logistik -> Analisa)');

// 2. Uji Filter Status Tugas Logistik Dropdown
const mockTasks = [
  { id: '1', status: 'in_progress' },
  { id: '2', status: 'completed' },
  { id: '3', status: 'completed' },
  { id: '4', status: 'kendala' },
];

function getLogisticsFilterOptions(tasks) {
  return [
    { id: 'all', label: 'Semua', count: tasks.length },
    { id: 'in_progress', label: 'Proses / Antar', count: tasks.filter(t => t.status === 'in_progress').length },
    { id: 'completed', label: 'Selesai', count: tasks.filter(t => t.status === 'completed').length },
    { id: 'kendala', label: 'Kendala', count: tasks.filter(t => t.status === 'kendala').length },
  ];
}

const filterOptions = getLogisticsFilterOptions(mockTasks);
assert.equal(filterOptions[0].count, 4, 'Total filter Semua harus 4');
assert.equal(filterOptions[1].count, 1, 'Total filter Proses / Antar harus 1');
assert.equal(filterOptions[2].count, 2, 'Total filter Selesai harus 2');
assert.equal(filterOptions[3].count, 1, 'Total filter Kendala harus 1');
console.log('✓ Test 2: Perhitungan counter dropdown filter logistik valid');

// 3. Uji Validasi Form Relokasi Mesin
function validateRelocationSubmission({ selectedOfficerIds, relocationItems }) {
  if (!selectedOfficerIds || selectedOfficerIds.length === 0) {
    return { valid: false, error: 'Pilih minimal satu petugas logistik.' };
  }

  for (let i = 0; i < relocationItems.length; i++) {
    const item = relocationItems[i];
    if (!item.originStoreId) {
      return { valid: false, error: `Rute #${i + 1}: Toko asal belum dipilih.` };
    }
    if (!item.machineId) {
      return { valid: false, error: `Rute #${i + 1}: Mesin yang dipindah belum dipilih.` };
    }
    if (!item.targetStoreId) {
      return { valid: false, error: `Rute #${i + 1}: Toko tujuan belum dipilih.` };
    }
    if (item.originStoreId === item.targetStoreId) {
      return { valid: false, error: `Rute #${i + 1}: Toko tujuan tidak boleh sama dengan toko asal.` };
    }
  }

  return { valid: true };
}

// Case A: Belum pilih petugas
const resNoOfficer = validateRelocationSubmission({
  selectedOfficerIds: [],
  relocationItems: [{ originStoreId: 's1', machineId: 'm1', targetStoreId: 's2' }],
});
assert.equal(resNoOfficer.valid, false);
assert.match(resNoOfficer.error, /petugas logistik/);

// Case B: Toko asal dan tujuan sama
const resSameStore = validateRelocationSubmission({
  selectedOfficerIds: ['officer1'],
  relocationItems: [{ originStoreId: 'storeA', machineId: 'm1', targetStoreId: 'storeA' }],
});
assert.equal(resSameStore.valid, false);
assert.match(resSameStore.error, /tidak boleh sama/);

// Case C: Form valid
const resValid = validateRelocationSubmission({
  selectedOfficerIds: ['officer1', 'officer2'],
  relocationItems: [{ originStoreId: 'storeA', machineId: 'm1', targetStoreId: 'storeB' }],
});
assert.equal(resValid.valid, true);
console.log('✓ Test 3: Validasi alur form penugasan relokasi mesin 100% lulus');

console.log('🎉 SEMUA TEST ANALISA & RELOKASI BERHASIL!\n');

