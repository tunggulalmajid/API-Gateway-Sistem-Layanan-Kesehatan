const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
    console.log('====================================================');
    console.log('[MIGRATION] Memulai migrasi skema database MySQL...');
    console.log('====================================================');

    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'layanan_kesehatan';

    let conn;
    try {
        console.log(`[MIGRATION] Menghubungi MySQL di ${host}:${port}...`);
        conn = await mysql.createConnection({ host, port, user, password });

        console.log(`[MIGRATION] Membuat database '${database}' jika belum ada...`);
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await conn.query(`USE \`${database}\`;`);

        console.log(`[MIGRATION] Membuat tabel 'obat'...`);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS \`obat\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                \`kode_obat\` VARCHAR(50) UNIQUE NOT NULL,
                \`nama_obat\` VARCHAR(100) NOT NULL,
                \`stok\` INT NOT NULL DEFAULT 0,
                \`versi\` INT NOT NULL DEFAULT 1,
                \`diperbarui_pada\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);

        console.log(`[MIGRATION] Membuat tabel 'dispense_log'...`);
        await conn.query(`
            CREATE TABLE IF NOT EXISTS \`dispense_log\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                \`resep_id\` VARCHAR(100) NOT NULL,
                \`obat_id\` INT NOT NULL,
                \`nama_pasien\` VARCHAR(100) NOT NULL,
                \`jumlah\` INT NOT NULL,
                \`metode\` VARCHAR(50) NOT NULL,
                \`handled_by\` VARCHAR(100) NOT NULL,
                \`instance_port\` INT NOT NULL,
                \`status\` VARCHAR(20) NOT NULL,
                \`keterangan\` TEXT,
                \`dibuat_pada\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_obat_id (\`obat_id\`),
                INDEX idx_resep_id (\`resep_id\`),
                FOREIGN KEY (\`obat_id\`) REFERENCES \`obat\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        console.log('====================================================');
        console.log('[MIGRATION] Migrasi database berhasil diselesaikan!');
        console.log('====================================================\n');
    } catch (err) {
        console.error('[MIGRATION ERROR] Gagal menjalankan migrasi:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;

