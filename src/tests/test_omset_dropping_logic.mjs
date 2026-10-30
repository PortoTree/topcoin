import assert from 'node:assert';
import {
  calculateDroppingTotals,
  aggregateDroppingByStaff,
  getStaffOmsetTierColor,
  getDateRangeForFilter,
  formatRupiahSimple,
} from '../lib/omsetDroppingLogic.js';

console.log('🧪 Memulai Pengujian TDD: Logika Omset Dropping & Agregasi Petugas...');

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

// Test 2: Logika Pewarnaan Tier Omset (Hijau, Kuning/Oranye, Merah, Abu-abu)
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

// Test 3: Logika Perhitungan Total Omset (Gross & Net)
console.log('--- Test 3: Perhitungan Total Omset ---');
const dummyDroppings = [
  { id: 'd1', dropping_user_id: 'user-1', gross_omset: 6000000, store_share_amount: 600000, net_deposit_amount: 5400000 },
  { id: 'd2', dropping_user_id: 'user-2', gross_omset: 4000000, store_share_amount: 400000, net_deposit_amount: 3600000 },
  { id: 'd3', dropping_user_id: 'user-1', gross_omset: 0, store_share_amount: 0, net_deposit_amount: 0 },
];

const totals = calculateDroppingTotals(dummyDroppings);
assert.strictEqual(totals.totalGross, 10000000);
assert.strictEqual(totals.totalNet, 9000000);
assert.strictEqual(totals.totalShare, 1000000);
console.log('✓ Test 3: Perhitungan Total Omset lulus');

// Test 4: Agregasi Omset per Petugas Dropping (termasuk petugas yang 0 transaksi)
console.log('--- Test 4: Agregasi Omset per Petugas Dropping ---');
const dummyStaff = [
  { id: 'user-1', full_name: 'Budi Dropping', role: 'dropping' },
  { id: 'user-2', full_name: 'Andi Dropping', role: 'dropping' },
  { id: 'user-3', full_name: 'Citra Dropping', role: 'dropping' },
];

const aggregated = aggregateDroppingByStaff(dummyStaff, dummyDroppings);
assert.strictEqual(aggregated.length, 3);

// Urutan default: omset terbesar di atas
assert.strictEqual(aggregated[0].staffId, 'user-1');
assert.strictEqual(aggregated[0].totalGross, 6000000);
assert.strictEqual(aggregated[0].totalNet, 5400000);
assert.strictEqual(aggregated[0].statusColor.tier, 'high');

assert.strictEqual(aggregated[1].staffId, 'user-2');
assert.strictEqual(aggregated[1].totalGross, 4000000);
assert.strictEqual(aggregated[1].totalNet, 3600000);
assert.strictEqual(aggregated[1].statusColor.tier, 'high');

assert.strictEqual(aggregated[2].staffId, 'user-3');
assert.strictEqual(aggregated[2].totalGross, 0);
assert.strictEqual(aggregated[2].totalNet, 0);
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
// 7 hari ke belakang dari 31 Okt 2026 adalah 25 Okt 2026
assert.strictEqual(range7Days.startDate, '2026-10-25');

const rangeCustom = getDateRangeForFilter('custom', todayStr, '2026-10-28');
assert.strictEqual(rangeCustom.startDate, '2026-10-28');
assert.strictEqual(rangeCustom.endDate, '2026-10-28');
console.log('✓ Test 5: Penentuan Rentang Tanggal Filter lulus');

console.log('🎉 SEMUA PENGUJIAN TDD OMSET DROPPING BERHASIL!');
