const GATEWAY = 'http://localhost:8000';

async function main() {
    console.log('====================================================');
    console.log('SIMULASI ROUTING API GATEWAY (PORT 8000)');
    console.log('====================================================\n');

    console.log('1. CEK STATUS SETIAP MICROSERVICE VIA GATEWAY:');
    
    const rxStatus = await fetch(`${GATEWAY}/api/prescription/status`).then(r => r.json());
    console.log('GET /api/prescription/status  ->', rxStatus);

    const pharmStatus = await fetch(`${GATEWAY}/api/pharmacy/status`).then(r => r.json());
    console.log('GET /api/pharmacy/status      ->', pharmStatus);

    const cashierStatus = await fetch(`${GATEWAY}/api/cashier/status`).then(r => r.json());
    console.log('GET /api/cashier/status       ->', cashierStatus);

    const mrStatus = await fetch(`${GATEWAY}/api/medical-record/status`).then(r => r.json());
    console.log('GET /api/medical-record/status->', mrStatus);

    console.log('\n2. DOKTER SUBMIT RESEP (PROXY KE PORT 8081):');
    const dummyResep = {
        namaPasien: 'Budi Santoso',
        dokter: 'dr. Andi',
        diagnosis: 'Demam & Radang Tenggorokan',
        daftarObat: ['Paracetamol 500mg', 'Amoxicillin 500mg']
    };

    const resepRes = await fetch(`${GATEWAY}/api/prescription/submit-resep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dummyResep)
    }).then(r => r.json());
    console.log('POST /api/prescription/submit-resep ->', resepRes);

    console.log('\n3. DATA DITERUSKAN KE APOTEK (PROXY KE PORT 8082):');
    const pharmRes = await fetch(`${GATEWAY}/api/pharmacy/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resepId: resepRes.data.idResep,
            namaPasien: dummyResep.namaPasien,
            daftarObat: dummyResep.daftarObat
        })
    }).then(r => r.json());
    console.log('POST /api/pharmacy/dispense ->', pharmRes);

    console.log('\n4. DATA DITERUSKAN KE KASIR (PROXY KE PORT 8083):');
    const cashierRes = await fetch(`${GATEWAY}/api/cashier/create-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resepId: resepRes.data.idResep,
            namaPasien: dummyResep.namaPasien
        })
    }).then(r => r.json());
    console.log('POST /api/cashier/create-bill ->', cashierRes);

    console.log('\n5. DATA DITERUSKAN KE REKAM MEDIS (PROXY KE PORT 8084):');
    const mrRes = await fetch(`${GATEWAY}/api/medical-record/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resepId: resepRes.data.idResep,
            namaPasien: dummyResep.namaPasien,
            dokter: dummyResep.dokter,
            diagnosis: dummyResep.diagnosis
        })
    }).then(r => r.json());
    console.log('POST /api/medical-record/records ->', mrRes);

    console.log('\n====================================================');
    console.log('SIMULASI SELESAI: SELURUH ROUTING BERFUNGSI DENGAN BAIK');
    console.log('====================================================');
}

main().catch(console.error);
