# API Gateway & Service Discovery - Sistem Layanan Kesehatan
**Mata Kuliah:** Sistem Terdistribusi  
**Pola Desain:** API Gateway Pattern, Service Registry & Discovery (Eureka-like), Inter-Service Communication (Service-to-Service), Heartbeat & TTL Eviction

---

## 1. Arsitektur Komunikasi Sistem

Sistem menerapkan **dua tingkatan Service Discovery**:
1. **North-South Traffic (Client ke Gateway ke Service):**  
   Klien hanya mengakses API Gateway (Port 8000). Gateway mencari alamat service tujuan secara dinamis ke Service Registry (Port 8761).
2. **East-West Traffic (Service-to-Service):**  
   Setiap microservice bertindak sebagai *Service Provider* (didaftarkan) sekaligus *Service Consumer* (mencari service lain). Saat dokter menerbitkan resep, **Prescription Service** secara otomatis mencari dan menghubungi **Apotek**, **Kasir**, dan **Rekam Medis** melalui Service Registry tanpa hardcoded IP/port.

| Komponen / Service | Port | Peran |
| :--- | :---: | :--- |
| **Service Registry (Eureka-like)** | **`8761`** | Pusat pendaftaran & health check instance aktif |
| **API Gateway** | **`8000`** | Single Point of Entry & Dynamic Reverse Proxy |
| **Prescription Service** | **`8081`** | Menerima resep & mengorkestrasi ke service lain via Discovery |
| **Pharmacy Service** | **`8082`** | Menerima resep dari Prescription Service untuk penyiapan obat |
| **Cashier Service** | **`8083`** | Menerima rincian biaya dari Prescription Service untuk penagihan |
| **Medical Record Service** | **`8084`** | Menerima diagnosis & resep untuk arsip rekam medis (EMR) |

---

## 2. Struktur Direktori Proyek

```
API-Gateway-Sistem-Layanan-Kesehatan/
├── package.json                 # Skrip npm dan dependensi
├── registryService.js           # Service Registry Server (Port 8761)
├── gateway.js                   # Dynamic API Gateway (Port 8000)
├── simulate.js                  # Skrip simulasi pengujian alur inter-service
└── services/
    ├── discoveryClient.js       # SDK Provider (Register & Heartbeat) & Consumer (Call Service)
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

Alur yang disimulasikan:
1. Pengecekan status Service Registry di `http://localhost:8761/services`.
2. Pengecekan Gateway di `http://localhost:8000/`.
3. Pengecekan kesehatan setiap service melalui Gateway.
4. Dokter mengirimkan resep ke Gateway (`POST /api/prescription/submit-resep`).
5. **Prescription Service** secara otomatis mencari alamat dan menghubungi:
   - Apotek via `POST /dispense`
   - Kasir via `POST /create-bill`
   - Rekam Medis via `POST /records`
6. Verifikasi bahwa data antrean apotek, faktur kasir, dan arsip rekam medis benar-benar tersimpan di masing-masing service.
