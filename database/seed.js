const { query } = require('./connection');

async function seed() {
    console.log('====================================================');
    console.log('[SEEDER] Memulai seeding data obat ke database...');
    console.log('====================================================');

    try {
        console.log('[SEEDER] Membersihkan riwayat transaksi lama...');
        await query('DELETE FROM dispense_log');

        console.log('[SEEDER] Memasukkan data master obat awal...');
        const initialMedicines = [
            { kode: 'KD-OBAT-001', nama: 'Paracetamol 500mg', stok: 1, versi: 1 },
            { kode: 'KD-OBAT-002', nama: 'Amoxicillin 500mg', stok: 5, versi: 1 },
            { kode: 'KD-OBAT-003', nama: 'Vitamin C 1000mg', stok: 10, versi: 1 }
        ];

        for (const item of initialMedicines) {
            await query(`
                INSERT INTO obat (kode_obat, nama_obat, stok, versi)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    nama_obat = VALUES(nama_obat),
                    stok = VALUES(stok),
                    versi = VALUES(versi)
            `, [item.kode, item.nama, item.stok, item.versi]);
        }

        const rows = await query('SELECT id, kode_obat, nama_obat, stok, versi FROM obat');
        console.log('[SEEDER] Data obat saat ini di database:');
        console.table(rows);

        console.log('====================================================');
        console.log('[SEEDER] Seeding data berhasil diselesaikan!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('[SEEDER ERROR] Gagal melakukan seeding:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    seed().then(() => process.exit(0));
}

module.exports = seed;

