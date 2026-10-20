const GATEWAY = 'http://localhost:8000';
const REGISTRY = 'http://localhost:8761';

async function main() {
    console.log('====================================================');
    console.log('SIMULASI SERVICE DISCOVERY & API GATEWAY ROUTING');
    console.log('====================================================\n');

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

    console.log('\n3. UJI ROUTING DINAMIS KE SETIAP SERVICE VIA GATEWAY:');
    const rxStatus = await fetch(`${GATEWAY}/api/prescription/status`).then(r => r.json());
    console.log('GET /api/prescription/status   ->', rxStatus);

    const pharmStatus = await fetch(`${GATEWAY}/api/pharmacy/status`).then(r => r.json());
    console.log('GET /api/pharmacy/status       ->', pharmStatus);

    const cashierStatus = await fetch(`${GATEWAY}/api/cashier/status`).then(r => r.json());
    console.log('GET /api/cashier/status        ->', cashierStatus);

    const mrStatus = await fetch(`${GATEWAY}/api/medical-record/status`).then(r => r.json());
    console.log('GET /api/medical-record/status ->', mrStatus);

    console.log('\n4. DOKTER SUBMIT RESEP (DYNAMIC PROXY KE PRESCRIPTION SERVICE):');
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

    console.log('\n5. DATA DITERUSKAN KE APOTEK (DYNAMIC PROXY KE PHARMACY SERVICE):');
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

    console.log('\n6. DATA DITERUSKAN KE KASIR (DYNAMIC PROXY KE CASHIER SERVICE):');
    const cashierRes = await fetch(`${GATEWAY}/api/cashier/create-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            resepId: resepRes.data.idResep,
            namaPasien: dummyResep.namaPasien
        })
    }).then(r => r.json());
    console.log('POST /api/cashier/create-bill ->', cashierRes);

    console.log('\n7. DATA DITERUSKAN KE REKAM MEDIS (DYNAMIC PROXY KE MEDICAL RECORD SERVICE):');
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
    console.log('SIMULASI BERHASIL: SERVICE DISCOVERY & ROUTING SEMPURNA');
    console.log('====================================================');
}

main().catch(console.error);
