# API Gateway & Service Discovery - Sistem Layanan Kesehatan
**Mata Kuliah:** Sistem Terdistribusi  
**Pola Desain:** API Gateway Pattern, Service Registry & Discovery (Eureka-like), Dynamic Reverse Proxy, Heartbeat & TTL Eviction

---

## 1. Arsitektur Service Discovery & Pemetaan Port

Sistem tidak lagi menggunakan IP dan port hardcoded pada API Gateway. Setiap microservice mendaftarkan diri secara dinamis ke **Service Registry (Port 8761)** saat booting dan mengirimkan heartbeat setiap 5 detik.

| Komponen / Service | Port | Tipe | Rute Akses via Gateway (Port 8000) |
| :--- | :---: | :---: | :--- |
| **Service Registry (Eureka-like)** | **`8761`** | Registry Server | `http://localhost:8761/services` |
| **API Gateway** | **`8000`** | Dynamic Gateway | `http://localhost:8000/` |
| **Prescription Service** | **`8081`** | Microservice | `/api/prescription/*` |
| **Pharmacy Service** | **`8082`** | Microservice | `/api/pharmacy/*` |
| **Cashier Service** | **`8083`** | Microservice | `/api/cashier/*` |
| **Medical Record Service** | **`8084`** | Microservice | `/api/medical-record/*` |

---

## 2. Struktur Direktori Proyek

```
API-Gateway-Sistem-Layanan-Kesehatan/
├── package.json                 # Skrip npm dan dependensi
├── registryService.js           # Service Registry Server (Port 8761)
├── gateway.js                   # Dynamic API Gateway (Port 8000)
├── simulate.js                  # Skrip simulasi pengujian alur
└── services/
    ├── discoveryClient.js       # Reusable Client SDK (Register & Heartbeat)
    ├── prescriptionService.js   # Microservice Resep (Port 8081)
    ├── pharmacyService.js       # Microservice Apotek (Port 8082)
    ├── cashierService.js        # Microservice Kasir (Port 8083)
    └── medicalRecordService.js  # Microservice Rekam Medis (Port 8084)
```

---

## 3. Cara Menjalankan

### Menjalankan Seluruh Sistem (Registry + Gateway + 4 Services):
```bash
npm run start:all
```

### Atau Menjalankan Secara Terpisah:
```bash
# Terminal 1 - Service Registry (Wajib jalan pertama)
npm run start:registry

# Terminal 2 - API Gateway
npm run start:gateway

# Terminal 3 - Prescription Service
npm run start:prescription

# Terminal 4 - Pharmacy Service
npm run start:pharmacy

# Terminal 5 - Cashier Service
npm run start:cashier

# Terminal 6 - Medical Record Service
npm run start:medical-record
```

---

## 4. Cara Pengujian & Simulasi

Buka terminal baru, jalankan:
```bash
npm run simulate
```

Alur yang diuji oleh skrip:
1. Pengecekan daftar service terdaftar di Service Registry (`GET http://localhost:8761/services`).
2. Pengecekan status Gateway dan live discovery (`GET http://localhost:8000/`).
3. Pengujian proxy dinamis ke setiap microservice melalui nama service.
4. Simulasi dokter submit resep dan penerusan data ke Apotek, Kasir, dan Rekam Medis.
