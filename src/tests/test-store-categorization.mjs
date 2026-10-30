// Test script to verify store categorization logic: Cadangan, Petugas Dropping, and Bekas
import assert from 'node:assert';

console.log('🧪 Memulai Pengujian Logika Kategori Toko (Store Categorization)...');

function categorizeStores({ stores, machines, droppingUsers, relocatedStoreIds }) {
  const machineByStoreId = new Map();
  for (const m of machines) {
    if (m.current_store_id) {
      machineByStoreId.set(m.current_store_id, m);
    }
  }

  const droppingUserById = new Map();
  for (const u of droppingUsers) {
    droppingUserById.set(u.id, u);
  }

  return stores.map((store) => {
    const machine = machineByStoreId.get(store.id);
    const hasMachineNow = Boolean(store.current_machine_id && machine);

    if (hasMachineNow && machine) {
      const droppingUser = machine.assigned_dropping_id
        ? droppingUserById.get(machine.assigned_dropping_id)
        : null;
      return {
        id: store.id,
        name: store.name,
        category: 'PETUGAS',
        droppingStaffName: droppingUser?.full_name ?? 'PETUGAS',
        machineCode: machine.machine_code,
        hasMachineColumn: true,
      };
    }

    const isRelocated = relocatedStoreIds.has(store.id);
    const wasEverInstalled = isRelocated || store.status === 'nonaktif' || Boolean(store.delivered_at);
    if (!hasMachineNow && wasEverInstalled) {
      return {
        id: store.id,
        name: store.name,
        category: 'BEKAS',
        droppingStaffName: null,
        machineCode: null,
        hasMachineColumn: false, // Disembunyikan (hide) jika tidak ada mesin
      };
    }

    return {
      id: store.id,
      name: store.name,
      category: 'CADANGAN',
      droppingStaffName: null,
      machineCode: null,
      hasMachineColumn: false, // Disembunyikan (hide) jika tidak ada mesin
    };
  });
}

// Data Dummy Simulasi
const droppingUsers = [
  { id: 'user-naufal', full_name: 'Naufal Rizky', role: 'dropping' },
  { id: 'user-budi', full_name: 'Budi Santoso', role: 'dropping' },
];

const machines = [
  { id: 'm-1', machine_code: 'NAUFAL-01', assigned_dropping_id: 'user-naufal', current_store_id: 'store-1' },
  { id: 'm-2', machine_code: 'BUDI-01', assigned_dropping_id: 'user-budi', current_store_id: 'store-2' },
];

const stores = [
  // 1. Toko yang memiliki mesin terpasang dipegang Naufal
  { id: 'store-1', name: 'Toko Berkah 1', current_machine_id: 'm-1', status: 'terpasang', delivered_at: '2026-10-01' },
  // 2. Toko yang memiliki mesin terpasang dipegang Budi
  { id: 'store-2', name: 'Toko Berkah 2', current_machine_id: 'm-2', status: 'terpasang', delivered_at: '2026-10-05' },
  // 3. Toko baru dari marketing (belum pernah pasang mesin)
  { id: 'store-3', name: 'Toko Cadangan Baru', current_machine_id: null, status: 'proses', created_at: '2026-10-25' },
  // 4. Toko yang mesinnya sudah direlokasi ke tempat lain (pernah ada task relokasi selesai)
  { id: 'store-4', name: 'Toko Mantan Mitra', current_machine_id: null, status: 'nonaktif', delivered_at: '2026-09-01' },
];

const relocatedStoreIds = new Set(['store-4']);

const results = categorizeStores({ stores, machines, droppingUsers, relocatedStoreIds });

// TEST 1: Toko 1 masuk kategori petugas dropping Naufal dengan nomor mesin tampil
console.log('Test 1: Toko terpasang mesin Naufal...');
const res1 = results.find((r) => r.id === 'store-1');
assert.strictEqual(res1.category, 'PETUGAS');
assert.strictEqual(res1.droppingStaffName, 'Naufal Rizky');
assert.strictEqual(res1.machineCode, 'NAUFAL-01');
assert.strictEqual(res1.hasMachineColumn, true);
console.log('✅ Test 1 Passed: Toko terpasang masuk kategori nama staf dropping & nomor mesin tampil');

// TEST 2: Toko 2 masuk kategori petugas dropping Budi
console.log('Test 2: Toko terpasang mesin Budi...');
const res2 = results.find((r) => r.id === 'store-2');
assert.strictEqual(res2.category, 'PETUGAS');
assert.strictEqual(res2.droppingStaffName, 'Budi Santoso');
assert.strictEqual(res2.machineCode, 'BUDI-01');
console.log('✅ Test 2 Passed: Toko terpasang mesin Budi valid');

// TEST 3: Toko dari marketing tanpa mesin otomatis masuk CADANGAN & kolom nomor mesin di-hide
console.log('Test 3: Toko dari marketing tanpa mesin...');
const res3 = results.find((r) => r.id === 'store-3');
assert.strictEqual(res3.category, 'CADANGAN');
assert.strictEqual(res3.machineCode, null);
assert.strictEqual(res3.hasMachineColumn, false, 'Nomor mesin wajib di-hide jika tidak ada mesin terpasang');
console.log('✅ Test 3 Passed: Toko marketing masuk kategori CADANGAN & kolom nomor mesin di-hide');

// TEST 4: Toko relokasi masuk kategori BEKAS & kolom nomor mesin di-hide
console.log('Test 4: Toko relokasi masuk kategori BEKAS...');
const res4 = results.find((r) => r.id === 'store-4');
assert.strictEqual(res4.category, 'BEKAS');
assert.strictEqual(res4.machineCode, null);
assert.strictEqual(res4.hasMachineColumn, false, 'Nomor mesin wajib di-hide untuk toko bekas');
console.log('✅ Test 4 Passed: Toko relokasi otomatis masuk kategori BEKAS');

console.log('\n🎉 SEMUA 4 PENGUJIAN LOGIKA KATEGORI TOKO LULUS 100%!');
