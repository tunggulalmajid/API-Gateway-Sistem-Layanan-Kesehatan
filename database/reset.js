const { query } = require('./connection');

async function resetStock(obatId = 1, initialStock = 1, initialVersi = 1) {
    try {
        await query('DELETE FROM dispense_log');
        await query('UPDATE obat SET stok = ?, versi = ? WHERE id = ?', [initialStock, initialVersi, obatId]);
        const [updated] = await query('SELECT id, kode_obat, nama_obat, stok, versi FROM obat WHERE id = ?', [obatId]);
        return updated;
    } catch (err) {
        console.error('[RESET ERROR] Gagal mereset data:', err.message);
        throw err;
    }
}

if (require.main === module) {
    resetStock().then(res => {
        console.log('[RESET] Data obat berhasil direset:');
        console.log(res);
        process.exit(0);
    });
}

module.exports = resetStock;

