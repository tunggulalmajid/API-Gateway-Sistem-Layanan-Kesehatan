const express = require('express');
const app = express();
const PORT = 8082;

app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        service: 'Pharmacy Service',
        status: 'UP',
        port: PORT
    });
});

app.post('/dispense', (req, res) => {
    console.log('[Pharmacy Service] Permintaan penyiapan obat diterima:', req.body);
    res.json({
        status: 'SUCCESS',
        service: 'Pharmacy Service',
        pesan: 'Obat sedang disiapkan oleh Apotek',
        antrean: 'APT-101'
    });
});

app.listen(PORT, () => {
    console.log(`Pharmacy Service berjalan di port ${PORT}`);
});
