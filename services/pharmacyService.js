const express = require('express');
const { registerService, callService } = require('./discoveryClient');

const app = express();
const PORT = process.env.PORT || process.argv[2] || 8082;

app.use(express.json());

const queue = [];
let currentInstanceId = `pharmacy-service-${PORT}`;

app.get('/status', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        status: 'UP',
        port: Number(PORT),
        handledBy: currentInstanceId
    });
});

app.get('/antrean', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        handledBy: currentInstanceId,
        port: Number(PORT),
        totalAntrean: queue.length,
        antrean: queue
    });
});

app.post('/dispense', (req, res) => {
    const { resepId, namaPasien, daftarObat } = req.body;
    console.log(`[Pharmacy Service] Menerima resep di ${currentInstanceId} (Port ${PORT}): ${resepId} untuk ${namaPasien}`);

    const itemAntrean = {
        nomorAntrean: `APT-${queue.length + 101}`,
        resepId: resepId || 'RX-UNKNOWN',
        namaPasien: namaPasien || 'Pasien',
        daftarObat: daftarObat || [],
        status: 'SEDANG_DIRACIK',
        waktuMasuk: new Date().toISOString()
    };

    queue.push(itemAntrean);

    res.json({
        status: 'SUCCESS',
        service: 'Pharmacy Service',
        handledBy: currentInstanceId,
        instancePort: Number(PORT),
        pesan: 'Permintaan obat diterima dan sedang disiapkan',
        data: itemAntrean
    });
});

app.listen(PORT, () => {
    console.log(`Pharmacy Service berjalan di port ${PORT}`);
    const reg = registerService({ serviceName: 'pharmacy-service', host: 'localhost', port: PORT });
    currentInstanceId = reg.instanceId;
});
