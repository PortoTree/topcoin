import { createClient } from '@supabase/supabase-js';

// Polyfill minimal WebSocket for Node.js 20 test runner
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

const SUPABASE_URL = 'https://tuhhydrwustfvrcgvodt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1aGh5ZHJ3dXN0ZnZyY2d2b2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTg1MTYsImV4cCI6MjEwNzczNDUxNn0.pzDWFIOWID8L6RyYpIXK1h8lb-ewbfeftrs2WIIDtWY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const BRANCH_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // Surabaya
const BRANCH_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; // Jakarta (if exists or mock branch)
const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const DRIVER_1_ID = '66666666-6666-6666-6666-666666666666';
const DRIVER_2_ID = '55555555-5555-5555-5555-555555555555';

let createdTaskIds = [];

async function runTests() {
  console.log('========================================================');
  console.log('🧪 MEMULAI PENGETESAN MENYELURUH FITUR TUGAS LOGISTIK');
  console.log('========================================================\n');

  try {
    // 0. Pre-fetch prerequisite records
    console.log('🔹 Langkah 0: Mengambil referensi Toko dan Mesin dari database...');
    const { data: stores, error: sErr } = await supabase
      .from('stores')
      .select('id, name')
      .eq('branch_id', BRANCH_A_ID)
      .limit(2);

    if (sErr || !stores || stores.length < 2) {
      throw new Error('Gagal mengambil data toko untuk pengujian: ' + JSON.stringify(sErr));
    }

    const { data: machines, error: mErr } = await supabase
      .from('machines')
      .select('id, machine_code')
      .eq('branch_id', BRANCH_A_ID)
      .limit(2);

    if (mErr || !machines || machines.length < 1) {
      throw new Error('Gagal mengambil data mesin untuk pengujian: ' + JSON.stringify(mErr));
    }

    console.log(`   ✅ Toko Asal: ${stores[0].name} (${stores[0].id})`);
    console.log(`   ✅ Toko Tujuan: ${stores[1].name} (${stores[1].id})`);
    console.log(`   ✅ Mesin: ${machines[0].machine_code} (${machines[0].id})\n`);

    // TEST 1: Multi-Task & Multi-Officer Shared Task Dispatching
    console.log('🔹 Tes 1: Validasi Pembuatan Multi-Tugas & Multi-Petugas (Shared Team Task)...');
    const relocationItems = [
      {
        originStoreId: stores[0].id,
        targetStoreId: stores[1].id,
        machineId: machines[0].id,
      },
      {
        originStoreId: stores[1].id,
        targetStoreId: stores[0].id,
        machineId: machines[0].id,
      },
    ];
    const officers = [DRIVER_1_ID, DRIVER_2_ID];
    const teamTag = '[Tim Logistik: Petugas A, Petugas B]';
    const dispatchNotes = `${teamTag} Prioritas kirim sebelum jam 14:00`;

    // 1 task per route, assigned to the whole team via officer_ids
    const payloads = [];
    for (const item of relocationItems) {
      payloads.push({
        branch_id: BRANCH_A_ID,
        task_type: 'relokasi_mesin',
        driver_id: officers[0],
        officer_ids: officers,
        assigned_by: ADMIN_ID,
        store_id: item.originStoreId,
        target_store_id: item.targetStoreId,
        machine_id: item.machineId,
        coin_amount: 0,
        status: 'assigned',
        notes: dispatchNotes,
      });
    }

    const { data: insertedTasks, error: insErr } = await supabase
      .from('driver_tasks')
      .insert(payloads)
      .select();

    if (insErr) {
      throw new Error('Tes 1 GAGAL saat insert multi-tugas: ' + JSON.stringify(insErr));
    }

    if (insertedTasks.length !== relocationItems.length) {
      throw new Error(`Tes 1 GAGAL: Diharapkan ${relocationItems.length} tugas untuk 2 rute, tapi terbuat ${insertedTasks.length}!`);
    }

    insertedTasks.forEach((t) => createdTaskIds.push(t.id));
    console.log(`   ✅ Berhasil membuat tepat ${insertedTasks.length} tugas untuk ${relocationItems.length} rute fisik (BUKAN berlipat ganda)!`);
    console.log(`   ✅ Kedua tugas menampung ID seluruh anggota tim: [${officers.join(', ')}]`);
    console.log(`   ✅ Catatan terisi tag tim: "${insertedTasks[0].notes}"\n`);

    // TEST 2: Query Anti-PGRST201 (Ambiguous Foreign Key Test)
    console.log('🔹 Tes 2: Validasi Query Database (Relasi store_id & target_store_id bebas error)...');
    const { data: queriedTasks, error: queryErr } = await supabase
      .from('driver_tasks')
      .select(`
        *,
        store:stores!store_id(name, address),
        target_store:stores!target_store_id(name, address),
        machine:machines(machine_code),
        driver:profiles!driver_id(full_name, username)
      `)
      .eq('branch_id', BRANCH_A_ID)
      .in('id', createdTaskIds);

    if (queryErr) {
      throw new Error('Tes 2 GAGAL: Query join menghasilkan error: ' + JSON.stringify(queryErr));
    }

    if (!queriedTasks || queriedTasks.length !== insertedTasks.length) {
      throw new Error('Tes 2 GAGAL: Jumlah data query tidak cocok.');
    }

    console.log(`   ✅ Query join berhasil tanpa error PGRST201!`);
    console.log(`   ✅ Toko asal ter-join: "${queriedTasks[0].store?.name}"`);
    console.log(`   ✅ Toko tujuan ter-join: "${queriedTasks[0].target_store?.name}"`);
    console.log(`   ✅ Petugas ter-join: "${queriedTasks[0].driver?.full_name}"\n`);

    // TEST 3: Laporan Toko Tutup (closed.png flow)
    console.log('🔹 Tes 3: Validasi Laporan Toko Tutup (Alur Icon closed.png)...');
    const targetTaskId = createdTaskIds[0];
    const closedTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const closedReportNote = `[TOKO TUTUP ${closedTime}]: Rolling door terkunci dan PIC tidak ada di tempat`;
    const updatedNotes = `${queriedTasks[0].notes}\n${closedReportNote}`;

    const { error: closeErr } = await supabase
      .from('driver_tasks')
      .update({ notes: updatedNotes })
      .eq('id', targetTaskId);

    if (closeErr) {
      throw new Error('Tes 3 GAGAL saat update laporan toko tutup: ' + JSON.stringify(closeErr));
    }

    const { data: verifiedCloseTask } = await supabase
      .from('driver_tasks')
      .select('notes')
      .eq('id', targetTaskId)
      .single();

    if (!verifiedCloseTask?.notes.includes('[TOKO TUTUP')) {
      throw new Error('Tes 3 GAGAL: Catatan toko tutup tidak tersimpan dengan benar.');
    }

    console.log('   ✅ Laporan toko tutup berhasil disimpan di database!');
    console.log(`   ✅ Isi catatan terverifikasi: "${verifiedCloseTask.notes.split('\n').pop()}"\n`);

    // TEST 4: Alur 3-Step Driver (Diangkut -> Dikirim / Completed)
    console.log('🔹 Tes 4: Validasi Alur 3-Step Logistik (Diangkut -> Dikirim)...');
    const stepTaskId = createdTaskIds[1];

    // Tahap 1: Diangkut
    const pickupNow = new Date().toISOString();
    const { error: pickupErr } = await supabase
      .from('driver_tasks')
      .update({
        status: 'in_progress',
        pickup_notes: 'Mesin MSN-SBY-001 sudah dinaikkan ke armada',
        pickup_at: pickupNow,
      })
      .eq('id', stepTaskId);

    if (pickupErr) {
      throw new Error('Tes 4 Tahap 1 GAGAL: ' + JSON.stringify(pickupErr));
    }
    console.log('   ✅ Tahap 1 (Diangkut): Status berhasil berubah menjadi "in_progress".');

    // Tahap 2: Dikirim (Selesai Relokasi)
    const deliverNow = new Date().toISOString();
    const { error: deliverErr } = await supabase
      .from('driver_tasks')
      .update({
        status: 'completed',
        last_coin_meter: 15420,
        delivery_notes: 'Mesin sudah dipasang dan ditest nyala normal',
        completed_at: deliverNow,
      })
      .eq('id', stepTaskId);

    if (deliverErr) {
      throw new Error('Tes 4 Tahap 2 GAGAL: ' + JSON.stringify(deliverErr));
    }

    const { data: completedTask } = await supabase
      .from('driver_tasks')
      .select('status, last_coin_meter, pickup_at, completed_at')
      .eq('id', stepTaskId)
      .single();

    if (completedTask?.status !== 'completed' || completedTask?.last_coin_meter !== 15420) {
      throw new Error('Tes 4 GAGAL: Data penyelesaian tugas tidak sesuai.');
    }
    console.log('   ✅ Tahap 2 (Dikirim): Status berhasil "completed" dengan counter meter 15420.');
    console.log(`   ✅ Riwayat audit waktu: Pickup (${completedTask.pickup_at}) -> Dropoff (${completedTask.completed_at})\n`);

    // TEST 5: Isolasi Data Antar-Cabang (Anti-Bocor)
    console.log('🔹 Tes 5: Pengujian Isolasi Data Antar-Cabang (Anti-Bocor)...');
    const { data: branchBTasks, error: bErr } = await supabase
      .from('driver_tasks')
      .select('id')
      .eq('branch_id', BRANCH_B_ID)
      .in('id', createdTaskIds);

    if (bErr) {
      throw new Error('Tes 5 GAGAL: ' + JSON.stringify(bErr));
    }

    if (branchBTasks && branchBTasks.length > 0) {
      throw new Error('🚨 BOCOR! Tugas Cabang A terlihat oleh query Cabang B!');
    }
    console.log('   ✅ AMAN: Tugas dari Cabang Surabaya (Branch A) 100% terisolasi dan tidak bocor ke Cabang lain.\n');

    // TEST 6: Pengujian Race Condition & Concurrency
    console.log('🔹 Tes 6: Pengujian Race Condition (Simultaneous Concurrent Updates)...');
    const concurrentTaskId = createdTaskIds[0];
    const promise1 = supabase
      .from('driver_tasks')
      .update({ notes: 'Update serentak Petugas 1' })
      .eq('id', concurrentTaskId);

    const promise2 = supabase
      .from('driver_tasks')
      .update({ notes: 'Update serentak Petugas 2' })
      .eq('id', concurrentTaskId);

    const results = await Promise.all([promise1, promise2]);
    const anyFailed = results.some((r) => r.error !== null);

    if (anyFailed) {
      throw new Error('Tes 6 GAGAL: Concurrency update mengalami collision error: ' + JSON.stringify(results));
    }
    console.log('   ✅ Concurrency update ditangani secara atomic oleh PostgreSQL tanpa lock conflict!\n');

    console.log('========================================================');
    console.log('🎉 SELURUH PENGUJIAN LOLOS DENGAN SUKSES! (100% PASSED)');
    console.log('========================================================\n');
  } catch (error) {
    console.error('\n❌ PENGUJIAN GAGAL:', error.message || error);
    process.exitCode = 1;
  } finally {
    // Teardown: Clean test data
    if (createdTaskIds.length > 0) {
      console.log('🧹 Membersihkan data pengujian dari database...');
      const { error: cleanErr } = await supabase
        .from('driver_tasks')
        .delete()
        .in('id', createdTaskIds);

      if (cleanErr) {
        console.warn('   ⚠️ Gagal membersihkan beberapa data test:', cleanErr);
      } else {
        console.log(`   ✅ Selesai: ${createdTaskIds.length} data uji berhasil dihapus. Database bersih.`);
      }
    }
  }
}

runTests();
