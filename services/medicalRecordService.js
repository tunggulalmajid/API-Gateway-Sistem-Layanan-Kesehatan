const express = require('express');
const { registerService } = require('./discoveryClient');

const app = express();
const PORT = 8084;

app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        service: 'Medical Record Service',
        status: 'UP',
        port: PORT
    });
});

app.post('/records', (req, res) => {
    console.log('[Medical Record Service] Pencatatan rekam medis diterima:', req.body);
    res.json({
        status: 'SUCCESS',
        service: 'Medical Record Service',
        pesan: 'Data rekam medis berhasil dicatat di sistem EMR',
        recordId: 'EMR-3001'
    });
});

app.listen(PORT, () => {
    console.log(`Medical Record Service berjalan di port ${PORT}`);
    registerService({ serviceName: 'medical-record-service', host: 'localhost', port: PORT });
});
