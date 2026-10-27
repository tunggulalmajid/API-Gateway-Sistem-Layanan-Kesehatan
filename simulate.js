const GATEWAY = 'http://localhost:8000';
const REGISTRY = 'http://localhost:8761';

async function main() {
    console.log('==================================================================');
    console.log('SIMULASI INTEGRASI SERVICE DISCOVERY & KOMUNIKASI ANTAR-LAYANAN');
    console.log('==================================================================\n');

    console.log('1. CEK SERVICE REGISTRY (PORT 8761):');
    try {
        const regRes = await fetch(`${REGISTRY}/services`).then(r => r.json());
        console.log('GET http://localhost:8761/services ->\n', JSON.stringify(regRes, null, 2));
    } catch (err) {
        console.error('Service Registry tidak dapat dihubungi:', err.message);
        return;
    }

    console.log('\n2. CEK STATUS GATEWAY & DISCOVERED SERVICES (PORT 8000):');
    const gwRes = await fetch(`${GATEWAY}/`).then(r => r.json());
    console.log('GET http://localhost:8000/ ->\n', JSON.stringify(gwRes, null, 2));

    console.log('\n3. CEK KESEHATAN SETIAP SERVICE VIA GATEWAY:');
    const rxStatus = await fetch(`${GATEWAY}/api/prescription/status`).then(r => r.json());
    console.log('GET /api/prescription/status   ->', rxStatus);

    const pharmStatus = await fetch(`${GATEWAY}/api/pharmacy/status`).then(r => r.json());
    console.log('GET /api/pharmacy/status       ->', pharmStatus);

    const cashierStatus = await fetch(`${GATEWAY}/api/cashier/status`).then(r => r.json());
    console.log('GET /api/cashier/status        ->', cashierStatus);

    const mrStatus = await fetch(`${GATEWAY}/api/medical-record/status`).then(r => r.json());
    console.log('GET /api/medical-record/status ->', mrStatus);

    console.log('\n4. DOKTER SUBMIT RESEP (MEMICU SERVICE-TO-SERVICE VIA DISCOVERY):');
    const dummyResep = {
        idPasien: 'RM-2026-88',
        namaPasien: 'Budi Santoso',
        dokter: 'dr. Andi Pratama, Sp.A',
        diagnosis: 'Infeksi Saluran Pernapasan & Faringitis',
        daftarObat: [
            'Amoxicillin 500mg - 3x1 setelah makan',
            'Paracetamol 500mg - 3x1 jika demam'
        ],
        catatan: 'Habiskan antibiotik dan banyak istirahat'
    };

    console.log('Mengirim POST /api/prescription/submit-resep via Gateway...');
    const resepRes = await fetch(`${GATEWAY}/api/prescription/submit-resep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dummyResep)
    }).then(r => r.json());
    console.log('Hasil Respons Orkestrasi Prescription Service ->\n', JSON.stringify(resepRes, null, 2));

    console.log('\n5. VERIFIKASI HASIL PENERUSAN PADA SETIAP SERVICE:');

    const queueRes = await fetch(`${GATEWAY}/api/pharmacy/antrean`).then(r => r.json());
    console.log('GET /api/pharmacy/antrean       -> Antrean Apotek:', queueRes.totalAntrean, 'item');

    const invRes = await fetch(`${GATEWAY}/api/cashier/invoices`).then(r => r.json());
    console.log('GET /api/cashier/invoices       -> Invoice Kasir :', invRes.totalInvoice, 'item');

    const recRes = await fetch(`${GATEWAY}/api/medical-record/records`).then(r => r.json());
    console.log('GET /api/medical-record/records -> Rekam Medis   :', recRes.totalRecords, 'arsip');

    console.log('\n==================================================================');
    console.log('SIMULASI BERHASIL: SERVICE-TO-SERVICE DISCOVERY BERJALAN SEMPURNA');
    console.log('==================================================================');
}

main().catch(console.error);
