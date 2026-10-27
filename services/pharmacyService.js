const express = require('express');
const { registerService, callService } = require('./discoveryClient');

const app = express();
const PORT = 8082;

app.use(express.json());

const queue = [];

app.get('/status', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        status: 'UP',
        port: PORT
    });
});

app.get('/antrean', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        totalAntrean: queue.length,
        antrean: queue
    });
});

app.post('/dispense', (req, res) => {
    const { resepId, namaPasien, daftarObat } = req.body;
    console.log(`[Pharmacy Service] Menerima permintaan obat dari Prescription Service: ${resepId} untuk ${namaPasien}`);

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
        pesan: 'Permintaan obat diterima dari Prescription Service dan sedang disiapkan',
        data: itemAntrean
    });
});

app.listen(PORT, () => {
    console.log(`Pharmacy Service berjalan di port ${PORT}`);
    registerService({ serviceName: 'pharmacy-service', host: 'localhost', port: PORT });
});
