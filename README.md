# API Gateway - Sistem Layanan Kesehatan (Rumah Sakit)
**Mata Kuliah:** Sistem Terdistribusi  
**Pola Desain:** API Gateway Pattern, Reverse Proxy, Path Rewriting

---

## 1. Arsitektur & Daftar Service

| Service | Port | Endpoint Melalui Gateway (Port 8000) | Target Microservice |
| :--- | :---: | :--- | :--- |
| **API Gateway** | **`8000`** | `http://localhost:8000` | Gateway Utama |
| **Prescription Service** | **`8081`** | `/api/prescription/*` | `http://localhost:8081/*` |
| **Pharmacy Service** | **`8082`** | `/api/pharmacy/*` | `http://localhost:8082/*` |
| **Cashier Service** | **`8083`** | `/api/cashier/*` | `http://localhost:8083/*` |
| **Medical Record Service** | **`8084`** | `/api/medical-record/*` | `http://localhost:8084/*` |

---

## 2. Struktur Direktori

```
API-Gateway-Sistem-Layanan-Kesehatan/
├── package.json
├── gateway.js
├── simulate.js
└── services/
    ├── prescriptionService.js   (Port 8081)
    ├── pharmacyService.js       (Port 8082)
    ├── cashierService.js        (Port 8083)
    └── medicalRecordService.js  (Port 8084)
```

---

## 3. Cara Menjalankan

### Menjalankan Gateway dan Semua Service Sekaligus:
```bash
npm run start:all
```

### Atau Menjalankan Secara Terpisah:
```bash
# Terminal 1 - API Gateway
npm run start:gateway

# Terminal 2 - Prescription Service
npm run start:prescription

# Terminal 3 - Pharmacy Service
npm run start:pharmacy

# Terminal 4 - Cashier Service
npm run start:cashier

# Terminal 5 - Medical Record Service
npm run start:medical-record
```

---

## 4. Menjalankan Simulasi

Pada terminal baru, jalankan:
```bash
npm run simulate
```

Skrip ini akan menyimulasikan:
1. Pengecekan status (health check) ke 4 service melalui API Gateway.
2. Pengiriman data resep dokter ke `POST /api/prescription/submit-resep`.
3. Penerusan data resep ke Apotek via `POST /api/pharmacy/dispense`.
4. Penerusan data ke Kasir via `POST /api/cashier/create-bill`.
5. Penerusan data ke Rekam Medis via `POST /api/medical-record/records`.
