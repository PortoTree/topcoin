import assert from 'node:assert';
import {
  getStoreMapCategory,
  getStaffColor,
  getNavigationUrls,
  filterValidMapStores,
} from '../features/maps/utils/mapLogic.js';

console.log('🧪 Memulai Pengujian Map Logic (TDD: Red -> Green)...');

// Test 1: filterValidMapStores
{
  const stores = [
    { id: '1', name: 'Toko Valid 1', latitude: -7.2575, longitude: 112.7521 },
    { id: '2', name: 'Toko Tanpa Koordinat', latitude: null, longitude: null },
    { id: '3', name: 'Toko Koordinat String Invalid', latitude: 'abc', longitude: 112.7 },
    { id: '4', name: 'Toko Koordinat Di luar batas', latitude: 95.0, longitude: 200.0 },
    { id: '5', name: 'Toko Valid 2', latitude: -8.1579, longitude: 112.5841 },
  ];

  const valid = filterValidMapStores(stores);
  assert.strictEqual(valid.length, 2, 'Harus hanya ada 2 toko valid');
  assert.strictEqual(valid[0].id, '1');
  assert.strictEqual(valid[1].id, '5');
  console.log('✅ Test 1: filterValidMapStores Lulus');
}

// Test 2: getNavigationUrls
{
  const nav = getNavigationUrls(-7.257512, 112.752134, 'Toko Berkah');
  assert.ok(nav.googleMaps.includes('-7.257512,112.752134'), 'URL Google Maps harus memuat koordinat');
  assert.ok(nav.googleMaps.startsWith('https://www.google.com/maps/dir/'), 'URL Google Maps harus untuk arah navigasi');
  assert.ok(nav.waze.includes('-7.257512,112.752134'), 'URL Waze harus memuat lat,lng');
  console.log('✅ Test 2: getNavigationUrls Lulus');
}

// Test 3: getStaffColor
{
  const color1 = getStaffColor('Naufal');
  const color2 = getStaffColor('Naufal');
  const colorBudi = getStaffColor('Budi Santoso');

  assert.strictEqual(color1, color2, 'Staff yang sama harus selalu menghasilkan warna yang sama persisten');
  assert.notStrictEqual(color1, colorBudi, 'Staff yang berbeda harus menghasilkan variasi warna');
  assert.ok(color1.startsWith('#'), 'Warna harus format hex');
  console.log('✅ Test 3: getStaffColor Lulus');
}

// Test 4: getStoreMapCategory
{
  const machines = [
    { id: 'm1', machine_code: 'M-001', assigned_dropping_id: 'u1' },
  ];
  const droppingUsers = [
    { id: 'u1', full_name: 'Naufal Dropping' },
  ];
  const relocatedSet = new Set(['s-bekas']);

  // Kasus A: Toko dengan mesin aktif
  const storeAktif = { id: 's1', current_machine_id: 'm1' };
  const catAktif = getStoreMapCategory(storeAktif, machines, droppingUsers, relocatedSet);
  assert.strictEqual(catAktif.category, 'PETUGAS');
  assert.strictEqual(catAktif.droppingStaffName, 'Naufal Dropping');
  assert.strictEqual(catAktif.badgeText, 'DRP: Naufal');

  // Kasus B: Toko cadangan
  const storeCadangan = { id: 's2', current_machine_id: null };
  const catCadangan = getStoreMapCategory(storeCadangan, machines, droppingUsers, relocatedSet);
  assert.strictEqual(catCadangan.category, 'CADANGAN');
  assert.strictEqual(catCadangan.badgeText, 'Cadangan');

  // Kasus C: Toko bekas relokasi
  const storeBekas = { id: 's-bekas', current_machine_id: null };
  const catBekas = getStoreMapCategory(storeBekas, machines, droppingUsers, relocatedSet);
  assert.strictEqual(catBekas.category, 'BEKAS');
  assert.strictEqual(catBekas.badgeText, 'Bekas');

  console.log('✅ Test 4: getStoreMapCategory Lulus');
}

console.log('🎉 SEMUA PENGUJIAN MAP LOGIC LULUS 100%!');
