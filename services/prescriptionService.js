const express = require('express');
const app = express();
const PORT = 8081;

app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        service: 'Prescription Service',
        status: 'UP',
        port: PORT
    });
});

app.post('/submit-resep', (req, res) => {
    console.log('[Prescription Service] Resep diterima:', req.body);
    res.json({
        status: 'SUCCESS',
        service: 'Prescription Service',
        pesan: 'Resep berhasil diterima oleh Prescription Service',
        data: {
            idResep: 'RX-1001',
            namaPasien: req.body.namaPasien || 'Pasien Dummy',
            dokter: req.body.dokter || 'dr. Dummy',
            diagnosis: req.body.diagnosis || 'Pemeriksaan Umum',
            daftarObat: req.body.daftarObat || ['Paracetamol 500mg', 'Amoxicillin 500mg']
        }
    });
});

app.listen(PORT, () => {
    console.log(`Prescription Service berjalan di port ${PORT}`);
});
