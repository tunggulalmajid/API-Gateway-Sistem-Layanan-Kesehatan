const express = require('express');
const { registerService, callService } = require('./discoveryClient');

const app = express();
const PORT = 8081;

app.use(express.json());

const prescriptions = [];

app.get('/status', (req, res) => {
    res.json({
        service: 'Prescription Service',
        status: 'UP',
        port: PORT
    });
});

app.get('/daftar-resep', (req, res) => {
    res.json({
        service: 'Prescription Service',
        total: prescriptions.length,
        data: prescriptions
    });
});

app.post('/submit-resep', async (req, res) => {
    const { idPasien, namaPasien, dokter, diagnosis, daftarObat, catatan } = req.body;

    const idResep = `RX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const resepData = {
        idResep,
        idPasien: idPasien || 'RM-101',
        namaPasien: namaPasien || 'Pasien Dummy',
        dokter: dokter || 'dr. Umum',
        diagnosis: diagnosis || 'Pemeriksaan Klinis',
        daftarObat: daftarObat || ['Paracetamol 500mg', 'Amoxicillin 500mg'],
        catatan: catatan || 'Diminum sesuai aturan',
        diterbitkanPada: new Date().toISOString()
    };

    prescriptions.push(resepData);
    console.log(`[Prescription Service] Resep ${idResep} diterbitkan untuk ${resepData.namaPasien}`);
    console.log(`[Prescription Service] Memulai distribusi ke Apotek, Kasir, dan Rekam Medis via Service Discovery...`);

    const [resApotek, resKasir, resRekamMedis] = await Promise.all([
        callService('pharmacy-service', '/dispense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resepId: idResep,
                namaPasien: resepData.namaPasien,
                daftarObat: resepData.daftarObat
            })
        }),
        callService('cashier-service', '/create-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resepId: idResep,
                idPasien: resepData.idPasien,
                namaPasien: resepData.namaPasien,
                daftarObat: resepData.daftarObat
            })
        }),
        callService('medical-record-service', '/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resepId: idResep,
                idPasien: resepData.idPasien,
                namaPasien: resepData.namaPasien,
                dokter: resepData.dokter,
                diagnosis: resepData.diagnosis,
                daftarObat: resepData.daftarObat,
                catatan: resepData.catatan
            })
        })
    ]);

    res.json({
        status: 'SUCCESS',
        service: 'Prescription Service',
        pesan: 'Resep berhasil diterbitkan dan otomatis didistribusikan ke Apotek, Kasir, dan Rekam Medis melalui Service Discovery',
        resep: resepData,
        distribusiLayanan: {
            apotek: resApotek,
            kasir: resKasir,
            rekamMedis: resRekamMedis
        }
    });
});

app.listen(PORT, () => {
    console.log(`Prescription Service berjalan di port ${PORT}`);
    registerService({ serviceName: 'prescription-service', host: 'localhost', port: PORT });
});
