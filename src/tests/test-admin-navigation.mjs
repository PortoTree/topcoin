import assert from 'node:assert/strict';

console.log('🧪 Memulai Pengujian Struktur Navigasi Admin Cabang...');

// 1. Simulasikan konfigurasi item navigasi default untuk akun admin
function getAdminNavItems(assignedTask) {
  let taskIcon = 'ClipboardList';
  if (assignedTask === 'logistik' || assignedTask === 'driver') {
    taskIcon = 'Truck';
  } else if (assignedTask === 'marketing') {
    taskIcon = 'Store';
  }

  return [
    { id: 'admin_task', label: 'Tugas', icon: taskIcon },
    { id: 'omset', label: 'Omset', icon: 'TrendingUp' },
    { id: 'schedule', label: 'Jadwal', icon: 'CalendarDays' },
    { id: 'machines', label: 'Mesin', icon: 'Cpu' },
    { id: 'reports', label: 'Laporan', icon: 'ClipboardCheck' },
  ];
}

// 2. Simulasikan menu tambahan dalam drag-to-expand drawer
function getAdminExpandedMenuItems() {
  return [
    { id: 'reconciliation', label: 'Rekonsiliasi Kas', category: 'Finance' },
    { id: 'driver_dispatch', label: 'Tugas Logistik Dispatch', category: 'Logistics' },
    { id: 'monitoring', label: 'Live Monitoring Dropping', category: 'Monitoring' },
  ];
}

// Test 1: Harus ada tepat 5 navigasi default utama
const defaultItems = getAdminNavItems(null);
assert.equal(defaultItems.length, 5, 'Navigasi default admin harus memiliki 5 item');
assert.deepEqual(
  defaultItems.map((i) => i.label),
  ['Tugas', 'Omset', 'Jadwal', 'Mesin', 'Laporan'],
  'Label navigasi default harus: Tugas, Omset, Jadwal, Mesin, Laporan'
);
console.log('✓ Test 1: 5 Navigasi default utama sesuai spesifikasi');

// Test 2: Icon tugas dynamic sesuai penugasan admin
const logistikTask = getAdminNavItems('logistik');
assert.equal(logistikTask[0].icon, 'Truck', 'Icon tugas logistik harus Truck');

const marketingTask = getAdminNavItems('marketing');
assert.equal(marketingTask[0].icon, 'Store', 'Icon tugas marketing harus Store');

const pengelolaTask = getAdminNavItems('admin_cabang');
assert.equal(pengelolaTask[0].icon, 'ClipboardList', 'Icon tugas pengelola harus ClipboardList');
console.log('✓ Test 2: Icon Tugas dinamis sesuai assigned_task');

// Test 3: Menu tambahan drawer mencakup Rekonsiliasi Kas, Tugas Logistik Dispatch, Monitoring
const expandedItems = getAdminExpandedMenuItems();
assert.equal(expandedItems.some((m) => m.id === 'reconciliation'), true);
assert.equal(expandedItems.some((m) => m.id === 'driver_dispatch'), true);
assert.equal(expandedItems.some((m) => m.id === 'monitoring'), true);
console.log('✓ Test 3: Menu tambahan drawer lengkap');

console.log('🎉 SEMUA TEST STRUKTUR NAVIGASI ADMIN BERHASIL!\n');
