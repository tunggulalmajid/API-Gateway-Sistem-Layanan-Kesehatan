const express = require('express');
const app = express();
const PORT = 8083;

app.use(express.json());

app.get('/status', (req, res) => {
    res.json({
        service: 'Cashier Service',
        status: 'UP',
        port: PORT
    });
});

app.post('/create-bill', (req, res) => {
    console.log('[Cashier Service] Permintaan tagihan diterima:', req.body);
    res.json({
        status: 'SUCCESS',
        service: 'Cashier Service',
        pesan: 'Tagihan berhasil dibuat oleh Kasir',
        nomorInvoice: 'INV-2001',
        totalTagihan: 210000
    });
});

app.listen(PORT, () => {
    console.log(`Cashier Service berjalan di port ${PORT}`);
});
