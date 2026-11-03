const express = require('express');
const { registerService } = require('./discoveryClient');
const { query, getConnection, testConnection } = require('../database/connection');
const resetStock = require('../database/reset');

const app = express();
const PORT = process.env.PORT || process.argv[2] || 8082;

app.use(express.json());

const queue = [];
let currentInstanceId = `pharmacy-service-${PORT}`;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Status & Health Check
app.get('/status', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        service: 'Pharmacy Service',
        status: 'UP',
        port: Number(PORT),
        handledBy: currentInstanceId,
        database: dbConnected ? 'CONNECTED' : 'DISCONNECTED'
    });
});

// Antrean In-Memory
app.get('/antrean', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        handledBy: currentInstanceId,
        port: Number(PORT),
        totalAntrean: queue.length,
        antrean: queue
    });
});

// Cek Stok Obat di Database
app.get('/stok/:id?', async (req, res) => {
    try {
        const obatId = req.params.id || 1;
        const rows = await query('SELECT id, kode_obat, nama_obat, stok, versi, diperbarui_pada FROM obat WHERE id = ?', [obatId]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'ERROR', pesan: `Obat dengan ID ${obatId} tidak ditemukan` });
        }
        res.json({
            status: 'SUCCESS',
            service: 'Pharmacy Service',
            handledBy: currentInstanceId,
            port: Number(PORT),
            obat: rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// Reset Stok Obat untuk Pengujian
app.post('/reset-stok', async (req, res) => {
    try {
        const obatId = req.body.obatId || 1;
        const initialStock = req.body.stok !== undefined ? req.body.stok : 1;
        const initialVersi = req.body.versi !== undefined ? req.body.versi : 1;

        const updated = await resetStock(obatId, initialStock, initialVersi);
        res.json({
            status: 'SUCCESS',
            pesan: `Stok obat ID ${obatId} berhasil direset ke ${initialStock} (versi ${initialVersi})`,
            data: updated
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// =========================================================================
// SKENARIO 1: VULNERABLE DISPENSE (MEMBUKTIKAN RACE CONDITION / OVERSELLING)
// Sesuai Slide 4 & 5: Check-Then-Act tanpa isolasi transaksi
// =========================================================================
app.post('/dispense/vulnerable', async (req, res) => {
    const { resepId = 'RX-UNKNOWN', namaPasien = 'Pasien', obatId = 1, jumlah = 1 } = req.body;
    console.log(`\n[${currentInstanceId}] [VULNERABLE] Memproses pesanan obat ID ${obatId} (qty: ${jumlah}) untuk ${namaPasien}`);

    try {
        // Langkah 1: Baca stok obat dari database
        const rows = await query('SELECT id, nama_obat, stok, versi FROM obat WHERE id = ?', [obatId]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'FAILED', pesan: 'Obat tidak ditemukan' });
        }
        const item = rows[0];
        console.log(`[${currentInstanceId}] [VULNERABLE] 1. Membaca stok di DB: ${item.stok}`);

        // Langkah 2: Simulasi jeda komputasi/latensi jaringan (Race Condition Window)
        // Di jeda inilah request konkuren lain membaca nilai stok yang sama persis
        await sleep(60);

        // Langkah 3: Pengecekan stok di memori aplikasi
        if (item.stok >= jumlah) {
            const stokBaru = item.stok - jumlah;
            console.log(`[${currentInstanceId}] [VULNERABLE] 2. Stok mencukupi (${item.stok} >= ${jumlah}). Menghitung sisa stok: ${stokBaru}`);

            // Langkah 4: Simpan stok baru ke database
            await query('UPDATE obat SET stok = ? WHERE id = ?', [stokBaru, obatId]);
            console.log(`[${currentInstanceId}] [VULNERABLE] 3. Database diupdate menjadi stok = ${stokBaru}`);

            // Langkah 5: Simpan log transaksi pesanan
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'VULNERABLE', ?, ?, 'SUCCESS', ?)
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT, `Berhasil (Stok terbaca: ${item.stok}, update ke: ${stokBaru})`]);

            return res.json({
                status: 'SUCCESS',
                metode: 'VULNERABLE (Check-Then-Act)',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Pesanan berhasil diproses',
                stokAwalTerbaca: item.stok,
                stokAkhirDisimpan: stokBaru
            });
        } else {
            console.log(`[${currentInstanceId}] [VULNERABLE] 2. Stok tidak cukup (${item.stok} < ${jumlah})`);
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'VULNERABLE', ?, ?, 'FAILED', 'Stok tidak cukup')
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT]);

            return res.status(409).json({
                status: 'FAILED',
                metode: 'VULNERABLE (Check-Then-Act)',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Stok tidak cukup',
                stokTersedia: item.stok
            });
        }
    } catch (err) {
        console.error(`[${currentInstanceId}] [VULNERABLE ERROR]`, err.message);
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// =========================================================================
// SKENARIO 2: ATOMIC OPERATION DISPENSE (SOLUSI 1)
// Sesuai Slide 6 & 7: UPDATE ... SET stok = stok - ? WHERE id = ? AND stok >= ?
// =========================================================================
app.post('/dispense/atomic', async (req, res) => {
    const { resepId = 'RX-UNKNOWN', namaPasien = 'Pasien', obatId = 1, jumlah = 1 } = req.body;
    console.log(`\n[${currentInstanceId}] [ATOMIC] Memproses pengurangan stok atomik ID ${obatId} (qty: ${jumlah}) untuk ${namaPasien}`);

    try {
        // Query atomic langsung mengurangi stok HANYA JIKA stok >= jumlah
        const result = await query(
            'UPDATE obat SET stok = stok - ? WHERE id = ? AND stok >= ?',
            [jumlah, obatId, jumlah]
        );

        if (result.affectedRows === 1) {
            console.log(`[${currentInstanceId}] [ATOMIC] Berhasil mengurangi stok secara atomik! (affectedRows: 1)`);

            // Ambil sisa stok terbaru
            const [updated] = await query('SELECT stok FROM obat WHERE id = ?', [obatId]);

            // Simpan log pesanan
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'ATOMIC', ?, ?, 'SUCCESS', ?)
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT, `Berhasil dikurangi secara atomik. Sisa stok: ${updated.stok}`]);

            return res.json({
                status: 'SUCCESS',
                metode: 'ATOMIC_OPERATION',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Pesanan berhasil (Atomic Update sukses)',
                sisaStok: updated.stok
            });
        } else {
            console.log(`[${currentInstanceId}] [ATOMIC] Gagal: Stok tidak mencukupi di level query database (affectedRows: 0)`);

            // Simpan log kegagalan
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'ATOMIC', ?, ?, 'FAILED', 'Atomic check gagal: Stok tidak cukup')
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT]);

            return res.status(409).json({
                status: 'FAILED',
                metode: 'ATOMIC_OPERATION',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Stok tidak cukup atau telah habis dipesan pengguna lain'
            });
        }
    } catch (err) {
        console.error(`[${currentInstanceId}] [ATOMIC ERROR]`, err.message);
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// =========================================================================
// SKENARIO 3: DATABASE TRANSACTION DISPENSE (SOLUSI 2)
// Sesuai Slide 8: START TRANSACTION -> SELECT ... FOR UPDATE -> COMMIT / ROLLBACK
// =========================================================================
app.post('/dispense/transaction', async (req, res) => {
    const { resepId = 'RX-UNKNOWN', namaPasien = 'Pasien', obatId = 1, jumlah = 1 } = req.body;
    console.log(`\n[${currentInstanceId}] [TRANSACTION] Memulai transaksi database untuk obat ID ${obatId} oleh ${namaPasien}`);

    let conn;
    try {
        conn = await getConnection();
        await conn.beginTransaction();
        console.log(`[${currentInstanceId}] [TRANSACTION] 1. BEGIN TRANSACTION & acquiring row lock (FOR UPDATE)...`);

        // SELECT ... FOR UPDATE mengunci baris obat sampai transaksi ini selesai (COMMIT/ROLLBACK)
        const [rows] = await conn.execute(
            'SELECT id, nama_obat, stok FROM obat WHERE id = ? FOR UPDATE',
            [obatId]
        );

        if (rows.length === 0 || rows[0].stok < jumlah) {
            const available = rows.length > 0 ? rows[0].stok : 0;
            console.log(`[${currentInstanceId}] [TRANSACTION] 2. Stok tidak mencukupi (${available} < ${jumlah}). Rolling back...`);
            await conn.rollback();
            conn.release();

            // Simpan log penolakan di luar transaksi
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'TRANSACTION', ?, ?, 'FAILED', 'Stok tidak cukup (Rolled back)')
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT]);

            return res.status(409).json({
                status: 'FAILED',
                metode: 'DATABASE_TRANSACTION',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Stok tidak cukup (Transaksi dibatalkan / Rollback)',
                stokTersedia: available
            });
        }

        const sisaStok = rows[0].stok - jumlah;
        // Langkah kurangi stok
        await conn.execute('UPDATE obat SET stok = ? WHERE id = ?', [sisaStok, obatId]);

        // Langkah catat riwayat transaksi dalam satu kesatuan unit atomik
        await conn.execute(`
            INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
            VALUES (?, ?, ?, ?, 'TRANSACTION', ?, ?, 'SUCCESS', ?)
        `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT, `Transaksi berhasil. Sisa stok: ${sisaStok}`]);

        // Commit seluruh perubahan secara atomik
        await conn.commit();
        conn.release();
        console.log(`[${currentInstanceId}] [TRANSACTION] 3. COMMIT TRANSACTION berhasil! Sisa stok: ${sisaStok}`);

        return res.json({
            status: 'SUCCESS',
            metode: 'DATABASE_TRANSACTION',
            handledBy: currentInstanceId,
            instancePort: Number(PORT),
            pesan: 'Pesanan berhasil diproses via Transaksi ACID',
            sisaStok: sisaStok
        });
    } catch (err) {
        if (conn) {
            try {
                await conn.rollback();
                conn.release();
            } catch (rbErr) {}
        }
        console.error(`[${currentInstanceId}] [TRANSACTION ERROR]`, err.message);
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// =========================================================================
// SKENARIO 4: OPTIMISTIC LOCKING DISPENSE (SOLUSI 3)
// Sesuai Slide 9–11: UPDATE ... SET stok = ?, versi = versi + 1 WHERE id = ? AND versi = ?
// =========================================================================
app.post('/dispense/optimistic', async (req, res) => {
    const { resepId = 'RX-UNKNOWN', namaPasien = 'Pasien', obatId = 1, jumlah = 1 } = req.body;
    console.log(`\n[${currentInstanceId}] [OPTIMISTIC] Memproses pesanan optimis ID ${obatId} oleh ${namaPasien}`);

    try {
        // Langkah 1: Membaca data obat beserta kolom 'versi'
        const rows = await query('SELECT id, nama_obat, stok, versi FROM obat WHERE id = ?', [obatId]);
        if (rows.length === 0) {
            return res.status(404).json({ status: 'FAILED', pesan: 'Obat tidak ditemukan' });
        }
        const item = rows[0];
        console.log(`[${currentInstanceId}] [OPTIMISTIC] 1. Membaca data: Stok = ${item.stok}, Versi = ${item.versi}`);

        if (item.stok < jumlah) {
            return res.status(409).json({
                status: 'FAILED',
                metode: 'OPTIMISTIC_LOCKING',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Stok tidak cukup',
                stokTersedia: item.stok
            });
        }

        // Simulasi context switch / window peluang race condition
        await sleep(50);

        // Langkah 2: Mengupdate stok sekaligus meng-increment versi HANYA JIKA versi di DB masih sama
        const updateResult = await query(`
            UPDATE obat 
            SET stok = stok - ?, versi = versi + 1 
            WHERE id = ? AND versi = ? AND stok >= ?
        `, [jumlah, obatId, item.versi, jumlah]);

        if (updateResult.affectedRows === 1) {
            const [newVersionRow] = await query('SELECT stok, versi FROM obat WHERE id = ?', [obatId]);
            console.log(`[${currentInstanceId}] [OPTIMISTIC] 2. Berhasil mengupdate! Versi baru: ${newVersionRow.versi}`);

            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'OPTIMISTIC_LOCK', ?, ?, 'SUCCESS', ?)
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT, `Versi lama: ${item.versi}, Versi baru: ${newVersionRow.versi}`]);

            return res.json({
                status: 'SUCCESS',
                metode: 'OPTIMISTIC_LOCKING',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Pesanan berhasil divalidasi dengan Optimistic Lock',
                versiSebelum: item.versi,
                versiBaru: newVersionRow.versi,
                sisaStok: newVersionRow.stok
            });
        } else {
            console.log(`[${currentInstanceId}] [OPTIMISTIC] 2. DITOLAK: Versi di database telah berubah oleh proses lain!`);

            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'OPTIMISTIC_LOCK', ?, ?, 'FAILED', ?)
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT, `Konflik Versi Terdeteksi (Versi dibaca: ${item.versi})`]);

            return res.status(409).json({
                status: 'FAILED',
                metode: 'OPTIMISTIC_LOCKING',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Pesanan ditolak: Terjadi konflik pembaruan data (Versi data di database telah berubah oleh transaksi lain)',
                versiTerbaca: item.versi
            });
        }
    } catch (err) {
        console.error(`[${currentInstanceId}] [OPTIMISTIC ERROR]`, err.message);
        res.status(500).json({ status: 'ERROR', pesan: err.message });
    }
});

// =========================================================================
// DEFAULT DISPENSE ENDPOINT (Production Safe Mode via Atomic Operation)
// =========================================================================
app.post('/dispense', async (req, res) => {
    const { resepId = 'RX-UNKNOWN', namaPasien = 'Pasien', daftarObat = [], obatId = 1, jumlah = 1 } = req.body;
    console.log(`[${currentInstanceId}] Menerima permintaan obat dari Prescription Service: ${resepId} untuk ${namaPasien}`);

    try {
        const result = await query(
            'UPDATE obat SET stok = stok - ? WHERE id = ? AND stok >= ?',
            [jumlah, obatId, jumlah]
        );

        const itemAntrean = {
            nomorAntrean: `APT-${queue.length + 101}`,
            resepId,
            namaPasien,
            daftarObat,
            status: result.affectedRows === 1 ? 'SEDANG_DIRACIK' : 'DITOLAK_STOK_HABIS',
            waktuMasuk: new Date().toISOString()
        };
        queue.push(itemAntrean);

        if (result.affectedRows === 1) {
            await query(`
                INSERT INTO dispense_log (resep_id, obat_id, nama_pasien, jumlah, metode, handled_by, instance_port, status, keterangan)
                VALUES (?, ?, ?, ?, 'DEFAULT_ATOMIC', ?, ?, 'SUCCESS', 'Dispensasi resep berhasil')
            `, [resepId, obatId, namaPasien, jumlah, currentInstanceId, PORT]);

            return res.json({
                status: 'SUCCESS',
                service: 'Pharmacy Service',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Permintaan obat diterima dan sedang disiapkan',
                data: itemAntrean
            });
        } else {
            return res.status(409).json({
                status: 'FAILED',
                service: 'Pharmacy Service',
                handledBy: currentInstanceId,
                instancePort: Number(PORT),
                pesan: 'Stok obat tidak mencukupi di apotek',
                data: itemAntrean
            });
        }
    } catch (err) {
        // Fallback jika database offline: simpan ke in-memory antrean
        const itemAntrean = {
            nomorAntrean: `APT-${queue.length + 101}`,
            resepId,
            namaPasien,
            daftarObat,
            status: 'SEDANG_DIRACIK (FALLBACK MEMORY)',
            waktuMasuk: new Date().toISOString()
        };
        queue.push(itemAntrean);
        return res.json({
            status: 'SUCCESS',
            service: 'Pharmacy Service',
            handledBy: currentInstanceId,
            instancePort: Number(PORT),
            pesan: 'Permintaan obat diterima (Mode Memory Fallback)',
            data: itemAntrean
        });
    }
});

app.listen(PORT, () => {
    console.log(`Pharmacy Service berjalan di port ${PORT}`);
    const reg = registerService({ serviceName: 'pharmacy-service', host: 'localhost', port: PORT });
    currentInstanceId = reg.instanceId;
});
