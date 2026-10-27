# API Gateway, Service Discovery & Load Balancer - Sistem Layanan Kesehatan
**Mata Kuliah:** Sistem Terdistribusi  
**Pola Desain:** API Gateway Pattern, Service Registry & Discovery (Eureka-like), Dual-Layer Load Balancer (Native Round-Robin), Inter-Service Communication, Auto-Failover & High Availability

---

## 1. Arsitektur Komunikasi & Load Balancing

Sistem menerapkan arsitektur terdistribusi lengkap dengan **Service Discovery** dan **Dual-Layer Load Balancer (Murni / Zero-Library)**:

```
[ Klien / Dokter ]
        │
        ▼ (Port 8000)
┌────────────────────────────────────────────────────────┐
│               API GATEWAY (LOAD BALANCER 1)            │
│       Algoritma: Round-Robin (Native / Zero-Library)   │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
   ┌───────────────────────┐ ┌───────────────────────┐
   │ Prescription Inst 1   │ │ Prescription Inst 2   │
   │      (Port 8081)      │ │      (Port 8085)      │
   └───────────┬───────────┘ └───────────┬───────────┘
               │ (Client-Side LB 2)      │ (Client-Side LB 2)
         ┌─────┴──────────────┐    ┌─────┴──────────────┐
         ▼                    ▼    ▼                    ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│  Pharmacy Inst 1  │ │  Pharmacy Inst 2  │ │  Cashier Service  │
│    (Port 8082)    │ │    (Port 8086)    │ │    (Port 8083)    │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

1. **Layer 1: Gateway Load Balancer (North-South Traffic):**  
   API Gateway mendistribusikan request penerbitan resep dokter secara berurutan (*Round-Robin*) bergantian ke **Port 8081** dan **Port 8085**.
2. **Layer 2: Client-Side Load Balancer (East-West Inter-Service Traffic):**  
   Prescription Service mendistribusikan permintaan racikan obat secara berurutan bergantian ke Apotek 1 (**Port 8082**) dan Apotek 2 (**Port 8086**).
3. **Auto-Failover (Zero Downtime):**  
   Jika salah satu instance mengalami *crash* atau dimatikan, Load Balancer mendeteksi penolakan koneksi dan otomatis mengalihkan request ke instance pasangannya yang masih aktif tanpa terjadi error di sisi klien.

---

## 2. Pemetaan Port & Instance Cluster

| Komponen / Service | Port | Peran |
| :--- | :---: | :--- |
| **Service Registry (Eureka-like)** | **`8761`** | Pusat pendaftaran instance & liveness heartbeat |
| **API Gateway (Load Balancer Layer 1)** | **`8000`** | Single Point of Entry & Round-Robin Proxy Router |
| **Prescription Service (Instance 1)** | **`8081`** | Pemroses resep & pengorkestrasi antar-layanan |
| **Prescription Service (Instance 2)** | **`8085`** | Penyeimbang beban resep (Horizontal Scaling) |
| **Pharmacy Service (Instance 1)** | **`8082`** | Penyiapan obat & peracikan farmasi |
| **Pharmacy Service (Instance 2)** | **`8086`** | Penyeimbang beban farmasi (Horizontal Scaling) |
| **Cashier Service** | **`8083`** | Penerbitan faktur tagihan pembayaran |
| **Medical Record Service** | **`8084`** | Pencatatan arsip rekam medis pasien (EMR) |

---

## 3. Cara Menjalankan

### A. Menjalankan Klaster Penuh (Multi-Instance Load Balancer):
Jalankan seluruh 8 server dalam satu perintah:
```bash
npm run start:cluster
```

### B. Menjalankan Single-Instance Standar:
```bash
npm run start:all
```

---

## 4. Cara Pengujian & Demonstrasi Tugas

### A. Demonstrasi Pembuktian Load Balancer (Rekomendasi untuk Nilai Maksimal)
Buka terminal terpisah, lalu jalankan:
```bash
npm run demo:lb
```
Skrip ini akan:
1. Menampilkan daftar klaster aktif di Service Registry.
2. Mengirim 6 request beruntun ke API Gateway.
3. Menampilkan tabel ASCII yang membuktikan beban terbagi 50% ke Port 8081 dan 50% ke Port 8085.
4. Membuktikan bahwa Apotek juga menerima beban bergantian (Port 8082 dan Port 8086).

### B. Demonstrasi Uji Ketahanan (*Failover & High Availability*):
1. Dalam kondisi sistem `start:cluster` berjalan, matikan Instance 2 (Port 8085) dengan menekan `Ctrl+C` pada prosesnya.
2. Jalankan kembali:
   ```bash
   npm run demo:lb
   ```
3. Perhatikan hasilnya: Seluruh 6 request tetap **100% SUKSES** tanpa error, karena Load Balancer secara otomatis mengalihkan seluruh traffic ke Instance 1 (Port 8081).
4. Nyalakan kembali Port 8085, dan beban otomatis terbagi rata kembali (*Self-Healing*).
