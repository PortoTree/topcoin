import assert from 'node:assert';
import {
  calculateDroppingTotals,
  aggregateDroppingByStaff,
  getStaffOmsetTierColor,
  getDateRangeForFilter,
  formatRupiahSimple,
} from '../lib/omsetDroppingLogic.js';

console.log('🧪 Memulai Pengujian TDD: Logika Omset Dropping (Uang Bawaan & Potongan Operasional)...');

// Test 1: Format Rupiah Simple sesuai tampilan gambar (e.g. "Rp 10.000.000", "Rp 0")
console.log('--- Test 1: Format Rupiah Simple ---');
assert.strictEqual(formatRupiahSimple(10000000), 'Rp 10.000.000');
assert.strictEqual(formatRupiahSimple(9000000), 'Rp 9.000.000');
assert.strictEqual(formatRupiahSimple(1000000), 'Rp 1.000.000');
assert.strictEqual(formatRupiahSimple(400000), 'Rp 400.000');
assert.strictEqual(formatRupiahSimple(0), 'Rp 0');
assert.strictEqual(formatRupiahSimple(null), 'Rp 0');
assert.strictEqual(formatRupiahSimple(undefined), 'Rp 0');
console.log('✓ Test 1: Format Rupiah Simple lulus');

// Test 2: Logika Pewarnaan Tier Omset (Berdasarkan uang dibawa dropping)
console.log('--- Test 2: Logika Pewarnaan Tier Omset ---');
const tierHigh = getStaffOmsetTierColor(1000000);
assert.strictEqual(tierHigh.tier, 'high');
assert.ok(tierHigh.colorClass.includes('emerald'));

const tierMed = getStaffOmsetTierColor(400000);
assert.strictEqual(tierMed.tier, 'medium');
assert.ok(tierMed.colorClass.includes('amber'));

const tierLow = getStaffOmsetTierColor(100000);
assert.strictEqual(tierLow.tier, 'low');
assert.ok(tierLow.colorClass.includes('rose'));

const tierZero = getStaffOmsetTierColor(0);
assert.strictEqual(tierZero.tier, 'zero');
assert.ok(tierZero.colorClass.includes('slate'));
console.log('✓ Test 2: Logika Pewarnaan Tier Omset lulus');

// Test 3: Logika Perhitungan Total Omset (Uang dibawa dropping & Total Bersih setelah Operasional)
console.log('--- Test 3: Perhitungan Total Omset & Total Bersih ---');
const dummyDroppings = [
  // Toko A: kotor 6.000.000, jatah toko 600.000, uang dibawa dropping 5.400.000
  { id: 'd1', dropping_user_id: 'user-1', gross_omset: 6000000, store_share_amount: 600000, net_deposit_amount: 5400000 },
  // Toko B: kotor 4.000.000, jatah toko 400.000, uang dibawa dropping 3.600.000
  { id: 'd2', dropping_user_id: 'user-2', gross_omset: 4000000, store_share_amount: 400000, net_deposit_amount: 3600000 },
  // Toko C: 0
  { id: 'd3', dropping_user_id: 'user-1', gross_omset: 0, store_share_amount: 0, net_deposit_amount: 0 },
];

// Kasus 3A: Tanpa potongan operasional (operasional = 0)
const totalsNoExpense = calculateDroppingTotals(dummyDroppings, 0);
// Total Omset adalah uang yang dibawa dropping (5.400.000 + 3.600.000 = 9.000.000)
assert.strictEqual(totalsNoExpense.totalBroughtByDropping, 9000000);
// Total Bersih = 9.000.000 - 0 = 9.000.000
assert.strictEqual(totalsNoExpense.totalNetProfit, 9000000);
assert.strictEqual(totalsNoExpense.totalGross, 10000000); // kotor mesin

// Kasus 3B: Dengan potongan operasional (misal operasional = 500.000)
const totalsWithExpense = calculateDroppingTotals(dummyDroppings, 500000);
assert.strictEqual(totalsWithExpense.totalBroughtByDropping, 9000000);
// Total Bersih = 9.000.000 - 500.000 = 8.500.000
assert.strictEqual(totalsWithExpense.totalNetProfit, 8500000);
assert.strictEqual(totalsWithExpense.operationalExpense, 500000);
console.log('✓ Test 3: Perhitungan Total Omset & Total Bersih lulus');

// Test 4: Agregasi Omset per Petugas Dropping (Uang Bawaan / net_deposit_amount)
console.log('--- Test 4: Agregasi Omset per Petugas Dropping ---');
const dummyStaff = [
  { id: 'user-1', full_name: 'Budi Dropping', role: 'dropping' },
  { id: 'user-2', full_name: 'Andi Dropping', role: 'dropping' },
  { id: 'user-3', full_name: 'Citra Dropping', role: 'dropping' },
];

const aggregated = aggregateDroppingByStaff(dummyStaff, dummyDroppings);
assert.strictEqual(aggregated.length, 3);

// Urutan default: uang dibawa dropping (totalNet) terbesar di atas
assert.strictEqual(aggregated[0].staffId, 'user-1');
assert.strictEqual(aggregated[0].totalNet, 5400000); // uang dibawa Budi
assert.strictEqual(aggregated[0].statusColor.tier, 'high');

assert.strictEqual(aggregated[1].staffId, 'user-2');
assert.strictEqual(aggregated[1].totalNet, 3600000); // uang dibawa Andi
assert.strictEqual(aggregated[1].statusColor.tier, 'high');

assert.strictEqual(aggregated[2].staffId, 'user-3');
assert.strictEqual(aggregated[2].totalNet, 0); // uang dibawa Citra
assert.strictEqual(aggregated[2].statusColor.tier, 'zero');
console.log('✓ Test 4: Agregasi Omset per Petugas Dropping lulus');

// Test 5: Penentuan Rentang Tanggal Filter ('today', '7days', '30days', 'custom')
console.log('--- Test 5: Penentuan Rentang Tanggal Filter ---');
const todayStr = '2026-10-31';
const rangeToday = getDateRangeForFilter('today', todayStr);
assert.strictEqual(rangeToday.startDate, todayStr);
assert.strictEqual(rangeToday.endDate, todayStr);

const range7Days = getDateRangeForFilter('7days', todayStr);
assert.strictEqual(range7Days.endDate, todayStr);
assert.strictEqual(range7Days.startDate, '2026-10-25');

const rangeCustom = getDateRangeForFilter('custom', todayStr, '2026-10-28');
assert.strictEqual(rangeCustom.startDate, '2026-10-28');
assert.strictEqual(rangeCustom.endDate, '2026-10-28');
console.log('✓ Test 5: Penentuan Rentang Tanggal Filter lulus');

console.log('🎉 SEMUA PENGUJIAN TDD OMSET DROPPING BERHASIL!');
