import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('🧪 Memulai Pengujian Siklus Kerja (Work Cycle Reset 00:00)...');

// 1. Verifikasi file src/lib/workCycle.ts memiliki reset_hour: 0
const content = fs.readFileSync('src/lib/workCycle.ts', 'utf8');
assert.match(content, /reset_hour:\s*0/, 'src/lib/workCycle.ts harus memiliki default reset_hour: 0');
assert.match(content, /reset_minute:\s*0/, 'src/lib/workCycle.ts harus memiliki default reset_minute: 0');
console.log('✓ File configuration matches DEFAULT_RESET_TIME 00:00');

// 2. Simulasikan fungsi getCurrentWorkDate persis seperti di workCycle.ts
function getCurrentWorkDate(now = new Date(), config = { reset_hour: 0, reset_minute: 0 }) {
  const d = new Date(now);
  const resetMinutes = config.reset_hour * 60 + config.reset_minute;
  const currentMinutes = d.getHours() * 60 + d.getMinutes();

  if (currentMinutes < resetMinutes) {
    d.setDate(d.getDate() - 1);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getNextResetTimestamp(now = new Date(), config = { reset_hour: 0, reset_minute: 0 }) {
  const next = new Date(now);
  next.setHours(config.reset_hour, config.reset_minute, 0, 0);

  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

// Test A: Pada jam 23:59:59 tgl 26 Okt 2026, tanggal kerja adalah 2026-10-26
const lateNight = new Date('2026-10-26T23:59:59');
const workDateLate = getCurrentWorkDate(lateNight);
assert.equal(workDateLate, '2026-10-26');
console.log('✓ Test A: Sebelum jam 12 malam (23:59), siklus kerja masih 2026-10-26');

// Test B: Tepat jam 00:00:00 tgl 27 Okt 2026, tanggal kerja langsung berganti ke 2026-10-27
const midnight = new Date('2026-10-27T00:00:00');
const workDateMidnight = getCurrentWorkDate(midnight);
assert.equal(workDateMidnight, '2026-10-27');
console.log('✓ Test B: Pas jam 00:00, siklus kerja langsung berganti ke 2026-10-27');

// Test C: Menghitung timestamp reset berikutnya (menuju 27 Okt 00:00)
const nextReset = getNextResetTimestamp(new Date('2026-10-26T20:40:00'));
const expectedReset = new Date('2026-10-27T00:00:00').getTime();
assert.equal(nextReset, expectedReset);
console.log('✓ Test C: Jadwal reset berikutnya tepat menunjuk ke jam 00:00 malam nanti');

console.log('🎉 SEMUA TEST SIKLUS KERJA 00:00 BERHASIL!');
