const express = require('express');
const { registerService, callService } = require('./discoveryClient');

const app = express();
const PORT = process.env.PORT || process.argv[2] || 8084;

app.use(express.json());

const records = [];
let currentInstanceId = `medical-record-service-${PORT}`;

app.get('/status', (req, res) => {
    res.json({
        service: 'Medical Record Service',
        status: 'UP',
        port: Number(PORT),
        handledBy: currentInstanceId
    });
});

app.get('/records', (req, res) => {
    res.json({
        service: 'Medical Record Service',
        handledBy: currentInstanceId,
        port: Number(PORT),
        totalRecords: records.length,
        records: records
    });
});

app.get('/records/:patientId', (req, res) => {
    const { patientId } = req.params;
    const filtered = records.filter(r => r.idPasien.toLowerCase() === patientId.toLowerCase());
    res.json({
        service: 'Medical Record Service',
        handledBy: currentInstanceId,
        port: Number(PORT),
        idPasien: patientId,
        total: filtered.length,
        data: filtered
    });
});

app.post('/records', (req, res) => {
    const { resepId, idPasien, namaPasien, dokter, diagnosis, daftarObat, catatan } = req.body;
    console.log(`[Medical Record Service] Menerima rekam medis di ${currentInstanceId} (Port ${PORT}) untuk ${namaPasien}`);

    const recordData = {
        recordId: `EMR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        resepId: resepId || 'NON-RESEP',
        idPasien: idPasien || 'RM-UNKNOWN',
        namaPasien: namaPasien || 'Pasien',
        dokter: dokter || 'dr. Jaga',
        diagnosis: diagnosis || 'Umum',
        daftarObat: daftarObat || [],
        catatan: catatan || 'Kondisi stabil',
        dicatatPada: new Date().toISOString()
    };

    records.push(recordData);

    res.json({
        status: 'SUCCESS',
        service: 'Medical Record Service',
        handledBy: currentInstanceId,
        instancePort: Number(PORT),
        pesan: 'Data rekam medis berhasil diarsipkan ke dalam sistem EMR',
        data: recordData
    });
});

app.listen(PORT, () => {
    console.log(`Medical Record Service berjalan di port ${PORT}`);
    const reg = registerService({ serviceName: 'medical-record-service', host: 'localhost', port: PORT });
    currentInstanceId = reg.instanceId;
});
