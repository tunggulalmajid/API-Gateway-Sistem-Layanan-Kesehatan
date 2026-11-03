const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:8000';
const REGISTRY = process.env.REGISTRY_URL || 'http://localhost:8761';
const { query, testConnection } = require('./database/connection');
const resetStock = require('./database/reset');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest(testName, endpoint, totalRequests = 3) {
    console.log(`\n========================================================================================`);
    console.log(`PENGUJIAN: ${testName.toUpperCase()}`);
    console.log(`Endpoint : ${GATEWAY}${endpoint}`);
    console.log(`========================================================================================`);

    // 1. Reset stok obat ID 1 (Paracetamol) ke stok = 1, versi = 1
    await resetStock(1, 1, 1);
    const [initialState] = await query('SELECT id, nama_obat, stok, versi FROM obat WHERE id = 1');
    console.log(`[KONDISI AWAL] ${initialState.nama_obat} | Stok di DB: ${initialState.stok} | Versi di DB: ${initialState.versi}`);
    console.log(`[AKSI] Mengirimkan ${totalRequests} request secara BERSAMAAN (Simultan / Konkuren) via Gateway LB...\n`);

    const patients = ['Budi Santoso', 'Siti Rahmawati', 'Joko Widodo', 'Dewi Lestari'];
    const startTime = performance.now();

    // 2. Kirim N request secara bersamaan menggunakan Promise.all
    const promises = [];
    for (let i = 1; i <= totalRequests; i++) {
        const payload = {
            resepId: `RX-RACE-${testName.slice(0, 4).toUpperCase()}-00${i}`,
            namaPasien: patients[i - 1] || `Pasien ${i}`,
            obatId: 1,
            jumlah: 1
        };

        const p = fetch(`${GATEWAY}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(async (res) => {
            const body = await res.json().catch(() => ({}));
            return {
                reqNumber: i,
                namaPasien: payload.namaPasien,
                httpStatus: res.status,
                ok: res.ok,
                handledBy: body.handledBy || 'Unknown',
                instancePort: body.instancePort || 'Unknown',
                pesan: body.pesan || res.statusText,
                data: body
            };
        }).catch(err => ({
            reqNumber: i,
            namaPasien: payload.namaPasien,
            httpStatus: 0,
            ok: false,
            handledBy: 'Error',
            instancePort: 'Error',
            pesan: err.message
        }));

        promises.push(p);
    }

    const results = await Promise.all(promises);
    const duration = Math.round(performance.now() - startTime);

    // 3. Tampilkan hasil setiap request
    console.log('+---------+-----------------+--------------+-------------+---------------------+----------------------------------------------------+');
    console.log('| Req No  | Nama Pasien     | HTTP Status  | Server Port | Instance ID         | Respon Sistem                                      |');
    console.log('+---------+-----------------+--------------+-------------+---------------------+----------------------------------------------------+');
    for (const r of results) {
        const statusLabel = r.ok ? '200 OK (SUKSES)' : `${r.httpStatus} (DITOLAK)`;
        console.log(
            `| #${r.reqNumber.toString().padEnd(6)} | ${r.namaPasien.padEnd(15)} | ${statusLabel.padEnd(12)} | Port ${r.instancePort.toString().padEnd(6)} | ${r.handledBy.padEnd(19)} | ${r.pesan.slice(0, 50).padEnd(50)} |`
        );
    }
    console.log('+---------+-----------------+--------------+-------------+---------------------+----------------------------------------------------+');

    // 4. Verifikasi kondisi akhir database riil
    const [finalState] = await query('SELECT id, nama_obat, stok, versi FROM obat WHERE id = 1');
    const logs = await query('SELECT id, nama_pasien, status, keterangan FROM dispense_log ORDER BY id ASC');
    const successCount = results.filter(r => r.ok).length;
    const failedCount = results.filter(r => !r.ok).length;

    console.log(`\n[ANALISIS HASIL DB]`);
    console.log(` • Total Request Masuk   : ${totalRequests}`);
    console.log(` • Transaksi Berhasil    : ${successCount}`);
    console.log(` • Transaksi Ditolak     : ${failedCount}`);
    console.log(` • Stok Akhir di DB      : ${finalState.stok} (Awal: 1)`);
    console.log(` • Versi Akhir di DB     : ${finalState.versi}`);
    console.log(` • Riwayat di dispense_log: ${logs.length} catatan tersimpan`);

    let statusKesimpulan = '';
    let isRaceCondition = false;

    if (successCount > 1) {
        isRaceCondition = true;
        statusKesimpulan = '❌ ANOMALI TERJADI: RACE CONDITION / OVERSELLING! (Stok 1 berhasil dijual ke lebih dari 1 orang)';
    } else if (successCount === 1 && finalState.stok === 0) {
        statusKesimpulan = '✅ KONSISTENSI DATA TERJAGA: Hanya 1 transaksi berhasil, sisa pesanan ditolak dengan tepat.';
    } else {
        statusKesimpulan = '⚠️ Hasil tidak terduga.';
    }

    console.log(`[KESIMPULAN] ${statusKesimpulan}`);
    console.log(`Waktu eksekusi konkurensi: ${duration} ms\n`);

    return {
        testName,
        totalRequests,
        successCount,
        failedCount,
        finalStock: finalState.stok,
        finalVersion: finalState.versi,
        isRaceCondition
    };
}

async function main() {
    console.log('========================================================================================');
    console.log('SIMULASI & PEMBUKTIAN KONSISTENSI DATA & RACE CONDITION PADA SISTEM TERDISTRIBUSI');
    console.log('Mata Kuliah: Sistem Terdistribusi - S1 Teknologi Informasi Fasilkom Universitas Jember');
    console.log('========================================================================================\n');

    // Cek koneksi Database
    console.log('1. MEMERIKSA KONEKSI DATABASE MYSQL...');
    const isDbOk = await testConnection();
    if (!isDbOk) {
        console.error('❌ Database MySQL tidak dapat dihubungi!');
        console.error('   Pastikan server MySQL di Laragon / XAMPP / Port 3306 sudah AKTIF.');
        console.error('   Dan pastikan Anda sudah menjalankan: npm run db:setup\n');
        process.exit(1);
    }
    console.log('   ✅ Terhubung ke database MySQL.\n');

    // Cek Gateway & Registry
    console.log('2. MEMERIKSA STATUS API GATEWAY & KLASTER PHARMACY SERVICE...');
    try {
        const gwRes = await fetch(`${GATEWAY}/`).then(r => r.json());
        const pharmCluster = gwRes.clusters && gwRes.clusters['pharmacy-service'];
        const totalPharm = pharmCluster ? pharmCluster.totalInstances : 0;
        console.log(`   ✅ API Gateway aktif di ${GATEWAY}`);
        console.log(`   ✅ Klaster Pharmacy Service terdeteksi: ${totalPharm} instance aktif.`);
        if (totalPharm === 0) {
            console.error('   ❌ Belum ada instance pharmacy-service yang terdaftar di Service Registry!');
            console.error('   👉 Pastikan klaster sudah dijalankan di terminal lain dengan: npm run start:cluster\n');
            process.exit(1);
        }
    } catch (err) {
        console.error(`❌ Gagal menghubungi API Gateway (${GATEWAY}): ${err.message}`);
        console.error('   Pastikan seluruh sistem sudah dijalankan dengan: npm run start:cluster\n');
        process.exit(1);
    }

    console.log('\n========================================================================================');
    console.log('MEMULAI PENELITIAN & EKSPERIMEN KONKURENSI (3 PEMBELI BERSAMAAN UNTUK 1 STOK TERAKHIR)');
    console.log('========================================================================================');

    const summaryReport = [];

    // Uji 1: Rentan (Membuktikan Permasalahan Race Condition)
    const res1 = await runTest(
        'Skenario Rentan (Check-Then-Act Tanpa Isolasi)',
        '/api/pharmacy/dispense/vulnerable',
        3
    );
    summaryReport.push(res1);
    await sleep(1500);

    // Uji 2: Solusi 1 - Atomic Operation (Slide 6-7)
    const res2 = await runTest(
        'Solusi 1: Operasi Atomik (Atomic Query UPDATE ... WHERE stok >= ?)',
        '/api/pharmacy/dispense/atomic',
        3
    );
    summaryReport.push(res2);
    await sleep(1500);

    // Uji 3: Solusi 2 - Database Transaction (Slide 8)
    const res3 = await runTest(
        'Solusi 2: Database Transaction (BEGIN ... FOR UPDATE ... COMMIT)',
        '/api/pharmacy/dispense/transaction',
        3
    );
    summaryReport.push(res3);
    await sleep(1500);

    // Uji 4: Solusi 3 - Optimistic Locking (Slide 9-11)
    const res4 = await runTest(
        'Solusi 3: Optimistic Locking (Versioning Column & Conflict Detection)',
        '/api/pharmacy/dispense/optimistic',
        3
    );
    summaryReport.push(res4);

    // Rekapitulasi Tabel Komparatif
    console.log('========================================================================================================================');
    console.log('REKAPITULASI HASIL EKSPERIMEN KONSISTENSI DATA (3 REQUEST KONKUREN DENGAN STOK AWAL = 1)');
    console.log('========================================================================================================================');
    console.log('+------------------------------------------+------------+---------+--------+------------+-------------+--------------------+');
    console.log('| Metode / Skenario                        | Stok Awal  | Sukses  | Gagal  | Stok Akhir | Versi Akhir | Status Konsistensi |');
    console.log('+------------------------------------------+------------+---------+--------+------------+-------------+--------------------+');
    for (const s of summaryReport) {
        const status = s.isRaceCondition ? '❌ Terjadi Oversell ' : '✅ Terproteksi Aman ';
        console.log(
            `| ${s.testName.slice(0, 40).padEnd(40)} | ${'1'.padEnd(10)} | ${s.successCount.toString().padEnd(7)} | ${s.failedCount.toString().padEnd(6)} | ${s.finalStock.toString().padEnd(10)} | ${s.finalVersion.toString().padEnd(11)} | ${status.padEnd(18)} |`
        );
    }
    console.log('+------------------------------------------+------------+---------+--------+------------+-------------+--------------------+');
    console.log('\n[KESIMPULAN ILMIAH SISTEM TERDISTRIBUSI]:');
    console.log('1. Pada skenario rentan, pembacaan terpisah (SELECT lalu UPDATE) di beberapa node menghasilkan Lost Update / Overselling.');
    console.log('2. Atomic Operation memanfaatkan kemampuan storage engine database untuk memodifikasi baris secara atomik tanpa overhead.');
    console.log('3. Database Transaction dengan row-lock menjamin serializability penuh pada transaksi multi-langkah.');
    console.log('4. Optimistic Locking sangat efektif untuk sistem terdistribusi skala besar dengan mendeteksi konflik versi tanpa menahan lock lama.');
    console.log('========================================================================================================================\n');

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});

