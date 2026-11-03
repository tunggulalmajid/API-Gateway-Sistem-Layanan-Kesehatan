const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'layanan_kesehatan',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0
};

let pool = null;

function getPool() {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
}

async function query(sql, params) {
    const p = getPool();
    const [results] = await p.execute(sql, params);
    return results;
}

async function getConnection() {
    const p = getPool();
    return await p.getConnection();
}

async function testConnection() {
    try {
        const conn = await getConnection();
        await conn.ping();
        conn.release();
        return true;
    } catch (err) {
        return false;
    }
}

module.exports = {
    dbConfig,
    getPool,
    query,
    getConnection,
    testConnection
};

