const express = require('express');
const { registerService, callService } = require('./discoveryClient');

const app = express();
const PORT = process.env.PORT || process.argv[2] || 8083;

app.use(express.json());

const invoices = [];
let currentInstanceId = `cashier-service-${PORT}`;

app.get('/status', (req, res) => {
    res.json({
        service: 'Cashier Service',
        status: 'UP',
        port: Number(PORT),
        handledBy: currentInstanceId
    });
});

app.get('/invoices', (req, res) => {
    res.json({
        service: 'Cashier Service',
        handledBy: currentInstanceId,
        port: Number(PORT),
        totalInvoice: invoices.length,
        invoices: invoices
    });
});

app.post('/create-bill', (req, res) => {
    const { resepId, idPasien, namaPasien, daftarObat } = req.body;
    console.log(`[Cashier Service] Menerima instruksi penagihan di ${currentInstanceId} (Port ${PORT}) untuk ${namaPasien}`);

    const jumlahObat = Array.isArray(daftarObat) ? daftarObat.length : 1;
    const biayaObat = jumlahObat * 45000;
    const jasaDokter = 150000;
    const biayaAdmin = 15000;
    const totalTagihan = biayaObat + jasaDokter + biayaAdmin;

    const dataInvoice = {
        nomorInvoice: `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        resepId: resepId || 'NON-RESEP',
        idPasien: idPasien || 'RM-UNKNOWN',
        namaPasien: namaPasien || 'Pasien',
        rincian: {
            jasaDokter,
            biayaObat,
            biayaAdmin
        },
        totalTagihan,
        statusPembayaran: 'BELUM_LUNAS',
        dibuatPada: new Date().toISOString()
    };

    invoices.push(dataInvoice);

    res.json({
        status: 'SUCCESS',
        service: 'Cashier Service',
        handledBy: currentInstanceId,
        instancePort: Number(PORT),
        pesan: 'Faktur tagihan berhasil diterbitkan oleh Kasir',
        data: dataInvoice
    });
});

app.listen(PORT, () => {
    console.log(`Cashier Service berjalan di port ${PORT}`);
    const reg = registerService({ serviceName: 'cashier-service', host: 'localhost', port: PORT });
    currentInstanceId = reg.instanceId;
});
