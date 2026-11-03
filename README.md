# API Gateway, Service Discovery, Load Balancer & Konsistensi Data (Race Condition) - Sistem Layanan Kesehatan
**Mata Kuliah:** Sistem Terdistribusi  
**Program Studi:** S1 Teknologi Informasi, Fakultas Ilmu Komputer, Universitas Jember  
**Pola Desain & Konsep:**
- API Gateway Pattern & Dynamic Reverse Proxy
- Service Registry & Discovery (Eureka-like) dengan Heartbeat & Auto-Eviction
- Dual-Layer Load Balancer (Native Round-Robin) & Auto-Failover
- Konsistensi Data pada Database Tunggal (Single Shared Database)
- Penanganan Concurrency & Race Condition (*Lost Update / Overselling*):
  1. **Operasi Atomik (*Atomic Operation*)**
  2. **Transaksi Database (*Database Transaction with Row Locking*)**
  3. ***Optimistic Locking* dengan Kolom Versi (*Versioning*)**

---

## 1. Arsitektur Komunikasi, Load Balancer & Database

```mermaid
flowchart TD
    %% Definisi Style Node
    classDef clientStyle fill:#555555,stroke:#333333,stroke-width:2px,color:#ffffff;
    classDef gatewayStyle fill:#2196F3,stroke:#1976D2,stroke-width:2px,color:#ffffff;
    classDef registryStyle fill:#7C4DFF,stroke:#512DA8,stroke-width:2px,color:#ffffff;
    classDef serviceStyle fill:#FFC107,stroke:#FFA000,stroke-width:2px,color:#000000;
    classDef dbStyle fill:#009688,stroke:#00796B,stroke-width:2px,color:#ffffff;

    Client["Client"]:::clientStyle
    Gateway["API GATEWAY<br/>(Port 8000)"]:::gatewayStyle
    Registry["Registry Service<br/>(Port 8761)"]:::registryStyle

    subgraph ResepCluster["Klaster Resep"]
        R1["RESEP SERVICE 1<br/>(Port 8081)"]:::serviceStyle
        R2["RESEP SERVICE 2<br/>(Port 8085)"]:::serviceStyle
    end

    subgraph ApotekCluster["Klaster Apotek"]
        A1["APOTEK SERVICE 1<br/>(Port 8082)"]:::serviceStyle
        A2["APOTEK SERVICE 2<br/>(Port 8086)"]:::serviceStyle
    end

    RM["REKAM MEDIS SERVICE<br/>(Port 8084)"]:::serviceStyle
    Kasir["KASIR SERVICE<br/>(Port 8083)"]:::serviceStyle
    DB[("DATABASE MYSQL TERPUSAT<br/>(layanan_kesehatan)")]:::dbStyle

    %% Alur Klien & Gateway
    Client -- "REQUEST" --> Gateway
    Gateway -- "RESPONSE" --> Client

    %% Sinkronisasi & Discovery Gateway <-> Registry
    Gateway <-->|"Discovery & Sync"| Registry

    %% Service Registration & Heartbeat (Garis Oranye/Merah)
    R1 -.->|"Register & Heartbeat"| Registry
    R2 -.->|"Register & Heartbeat"| Registry
    A1 -.->|"Register & Heartbeat"| Registry
    A2 -.->|"Register & Heartbeat"| Registry
    RM -.->|"Register & Heartbeat"| Registry
    Kasir -.->|"Register & Heartbeat"| Registry

    %% Gateway Load Balancing ke Resep & Apotek & Kasir
    Gateway ==>|"Load Balancer (Round-Robin)"| R1
    Gateway ==>|"Load Balancer (Round-Robin)"| R2
    Gateway ==>|"Direct Proxy / LB"| A1
    Gateway ==>|"Direct Proxy / LB"| A2
    Gateway -->|"Direct Proxy"| Kasir

    %% East-West Inter-Service Communication (Resep -> Rekam Medis & Apotek)
    R1 & R2 -->|"Simpan Rekam Medis"| RM
    R1 & R2 ==>|"Client-Side LB"| A1
    R1 & R2 ==>|"Client-Side LB"| A2

    %% Database Concurrency (Race Condition Layer)
    A1 & A2 -->|"Akses Database Tunggal (Stok & Versi)"| DB
```

1. **North-South Traffic (Klien ke Gateway ke Service):**  
   API Gateway mendistribusikan request secara bergantian (*Round-Robin*) ke instance aktif.
2. **East-West Traffic (Service-to-Service):**  
   Prescription Service mencari instance Pharmacy Service via Service Registry dan menyeimbangkan beban antar instance apotek.
3. **Database Bersama (Single Database Concurrency):**  
   Seluruh instance Pharmacy Service mengakses database tunggal yang sama. Ketika beberapa request membeli stok terakhir secara bersamaan, potensi **Race Condition** dapat terjadi jika tidak ditangani dengan benar.

---

## 2. Pemetaan Port & Instance Cluster

| Komponen / Service | Port | Peran |
| :--- | :---: | :--- |
| **Service Registry (Eureka-like)** | **`8761`** | Pusat pendaftaran instance & liveness heartbeat |
| **API Gateway (Load Balancer)** | **`8000`** | Single Point of Entry & Round-Robin Proxy Router |
| **Prescription Service (Instance 1)** | **`8081`** | Pemroses resep & pengorkestrasi antar-layanan |
| **Prescription Service (Instance 2)** | **`8085`** | Penyeimbang beban resep (Horizontal Scaling) |
| **Pharmacy Service (Instance 1)** | **`8082`** | Penyiapan obat & transaksi database (Node 1) |
| **Pharmacy Service (Instance 2)** | **`8086`** | Penyiapan obat & transaksi database (Node 2) |
| **Cashier Service** | **`8083`** | Penerbitan faktur tagihan pembayaran |
| **Medical Record Service** | **`8084`** | Pencatatan arsip rekam medis pasien (EMR) |
| **MySQL Database Server** | **`3306`** | Database relasional terpusat (`layanan_kesehatan`) |

---

## 3. Konfigurasi Lingkungan (`.env`)

Sistem menggunakan file `.env` untuk kredensial database dan konfigurasi jaringan. Contoh isi `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=layanan_kesehatan
DB_CONNECTION_LIMIT=10

REGISTRY_URL=http://localhost:8761
GATEWAY_URL=http://localhost:8000
```

---

## 4. Persiapan Database: Migration & Seeder

Pastikan service MySQL di **Laragon / XAMPP** Anda sudah dalam status **Started** (Port 3306).

Jalankan perintah otomatis berikut:
```bash
# 1. Jalankan migrasi dan seeder data awal sekaligus
npm run db:setup
```

Atau secara terpisah:
```bash
# Menjalankan migrasi skema tabel
npm run db:migrate

# Mengisi data master obat awal (Paracetamol stok = 1, versi = 1)
npm run db:seed

# Mereset stok obat untuk simulasi ulang
npm run db:reset
```

---

## 5. Cara Menjalankan Sistem

### Menjalankan Klaster Penuh (Multi-Instance + Load Balancer):
```bash
npm run start:cluster
```
Perintah ini akan menjalankan 8 proses sekaligus:
- Service Registry (8761)
- API Gateway (8000)
- Prescription Service 1 (8081) & 2 (8085)
- Pharmacy Service 1 (8082) & 2 (8086)
- Cashier Service (8083)
- Medical Record Service (8084)

---

## 6. Pengujian & Demonstrasi Tugas

### A. Uji Materi Utama: Race Condition & Solusi Konsistensi Data
Buka terminal baru, jalankan:
```bash
npm run simulate:race
```
Skrip ini akan menembakkan **3 request pembelian serentak** untuk **1 stok terakhir obat Paracetamol** ke 4 skenario berbeda secara berurutan:

1. **Skenario Rentan (*Vulnerable Check-Then-Act*)**:
   - Membuktikan terjadinya **Race Condition / Overselling**.
   - Ketiga request sama-sama membaca stok = 1, sehingga lebih dari 1 transaksi berhasil mendapatkan barang padahal stok hanya 1.
2. **Solusi 1: Operasi Atomik (*Atomic Operation*)**:
   - Menerapkan query:
     ```sql
     UPDATE obat SET stok = stok - 1 WHERE id = 1 AND stok >= 1;
     ```
   - Hanya tepat 1 request yang berhasil (`affectedRows = 1`), sedangkan request lainnya ditolak (`affectedRows = 0`).
3. **Solusi 2: Transaksi Database (*Database Transaction with Row Locking*)**:
   - Menerapkan transaksi ACID:
     ```sql
     START TRANSACTION;
     SELECT id, nama_obat, stok FROM obat WHERE id = 1 FOR UPDATE;
     -- Kurangi stok dan catat pesanan dalam 1 unit atomik
     COMMIT;
     ```
   - Row-locking memastikan transaksi dijalankan secara serial sehingga integritas data terlindungi.
4. **Solusi 3: Optimistic Locking dengan Versi (*Versioning*)**:
   - Menerapkan query conditional update versi:
     ```sql
     UPDATE obat SET stok = stok - 1, versi = versi + 1 WHERE id = 1 AND versi = ?;
     ```
   - Request pertama berhasil meng-increment versi (misal versi 1 -> 2).
   - Request kedua dan ketiga ditolak dengan status **Konflik Versi (*Version Mismatch / Stale Data*)**.

### B. Demonstrasi Load Balancer (Round-Robin & Auto-Failover):
```bash
npm run demo:lb
```
Membuktikan distribusi beban 50:50 antar instance serta toleransi kegagalan saat ada instance yang dimatikan.

### C. Alur Standar Integrasi Antar-Layanan:
```bash
npm run simulate
```
Membuktikan orkestrasi penerbitan resep dokter yang otomatis didistribusikan ke Apotek, Kasir, dan Rekam Medis.


---

## 7. Diagram Alur: Race Condition & 3 Solusi Konsistensi Data

### A. Diagram Terjadinya Race Condition (Lost Update / Overselling)
Pada skenario rentan (*Check-Then-Act*), Service #1 dan Service #2 membaca stok secara bersamaan sebelum ada yang menuliskan perubahan ke database. Keduanya menghitung sisa stok `1 - 1 = 0`, keduanya mengupdate database, dan keduanya mengembalikan status sukses:

```mermaid
sequenceDiagram
    autonumber
    actor Klien1 as Pembeli 1
    actor Klien2 as Pembeli 2
    participant GW as API Gateway (Port 8000)
    participant S1 as Pharmacy Inst 1 (Port 8082)
    participant S2 as Pharmacy Inst 2 (Port 8086)
    participant DB as MySQL Database (Stok = 1)

    Note over DB: Kondisi Awal: Stok Paracetamol = 1

    par Request Simultan
        Klien1->>GW: POST /dispense (Beli 1 pcs)
        GW->>S1: Rute ke Service #1
    and
        Klien2->>GW: POST /dispense (Beli 1 pcs)
        GW->>S2: Rute ke Service #2
    end

    S1->>DB: 1. SELECT stok FROM obat (Hasil: Stok = 1)
    S2->>DB: 2. SELECT stok FROM obat (Hasil: Stok = 1)

    Note over S1: 3. Hitung di memori: 1 - 1 = 0
    Note over S2: 4. Hitung di memori: 1 - 1 = 0

    S1->>DB: 5. UPDATE obat SET stok = 0
    DB-->>S1: OK (Stok = 0)
    S1-->>GW: Pesanan Berhasil!
    GW-->>Klien1: 200 OK (Pesanan Berhasil)

    S2->>DB: 6. UPDATE obat SET stok = 0 (Menimpa nilai lama)
    DB-->>S2: OK (Stok = 0)
    S2-->>GW: Pesanan Berhasil!
    GW-->>Klien2: 200 OK (Pesanan Berhasil)

    Note over DB,Klien2: ANOMALI: Stok hanya 1, tetapi berhasil dijual ke 2 pembeli! (Overselling)
```

---

### B. Diagram Solusi 1: Operasi Atomik (Atomic Operation)
Operasi pengecekan dan pengurangan stok disatukan dalam satu query atomik di level engine database: `UPDATE obat SET stok = stok - 1 WHERE id = 1 AND stok >= 1`.

```mermaid
sequenceDiagram
    autonumber
    actor Klien1 as Pembeli 1
    actor Klien2 as Pembeli 2
    participant S1 as Pharmacy Inst 1
    participant S2 as Pharmacy Inst 2
    participant DB as MySQL Database (Stok = 1)

    par Request Simultan
        Klien1->>S1: Beli 1 pcs
    and
        Klien2->>S2: Beli 1 pcs
    end

    S1->>DB: UPDATE obat SET stok = stok - 1 WHERE id = 1 AND stok >= 1
    Note over DB: Engine DB memproses atomik (Row Lock internal):<br/>Stok berkurang jadi 0, affectedRows = 1
    DB-->>S1: affectedRows = 1 (BERHASIL)
    S1-->>Klien1: 200 OK (Pesanan Berhasil)

    S2->>DB: UPDATE obat SET stok = stok - 1 WHERE id = 1 AND stok >= 1
    Note over DB: Kondisi stok >= 1 TIDAK terpenuhi:<br/>Tidak ada baris berubah, affectedRows = 0
    DB-->>S2: affectedRows = 0 (GAGAL)
    S2-->>Klien2: 409 Conflict (Stok Tidak Cukup)
```

---

### C. Diagram Solusi 2: Database Transaction (Pessimistic Row Locking)
Menggunakan transaksi ACID dengan klausa `SELECT ... FOR UPDATE` untuk mengunci baris data secara eksklusif.

```mermaid
sequenceDiagram
    autonumber
    actor Klien1 as Pembeli 1
    actor Klien2 as Pembeli 2
    participant S1 as Pharmacy Inst 1
    participant S2 as Pharmacy Inst 2
    participant DB as MySQL Database (Stok = 1)

    S1->>DB: BEGIN TRANSACTION
    S1->>DB: SELECT stok FROM obat WHERE id = 1 FOR UPDATE
    Note over DB: Baris id = 1 DIKUNCI EKSKLUSIF oleh S1

    S2->>DB: BEGIN TRANSACTION
    S2->>DB: SELECT stok FROM obat WHERE id = 1 FOR UPDATE
    Note over S2,DB: S2 DITAHAN (WAITING LOCK) sampai transaksi S1 selesai

    Note over S1: Stok cukup (1 >= 1)
    S1->>DB: UPDATE obat SET stok = 0 WHERE id = 1
    S1->>DB: INSERT INTO dispense_log (SUCCESS)
    S1->>DB: COMMIT TRANSACTION
    Note over DB: Kunci baris DILEPAS. Stok sekarang = 0.
    S1-->>Klien1: 200 OK (Pesanan Berhasil)

    Note over S2,DB: S2 mendapatkan kunci baris
    DB-->>S2: Hasil SELECT: Stok = 0
    Note over S2: Stok habis (0 < 1) -> Batalkan transaksi!
    S2->>DB: ROLLBACK TRANSACTION
    S2-->>Klien2: 409 Conflict (Stok Habis / Transaksi Dibatalkan)
```

---

### D. Diagram Solusi 3: Optimistic Locking (Versioning Column)
Menggunakan kolom `versi` sebagai penanda apakah data telah dimodifikasi oleh proses lain saat jeda pembacaan dan penyimpanan.

```mermaid
sequenceDiagram
    autonumber
    actor Klien1 as Pembeli 1
    actor Klien2 as Pembeli 2
    participant S1 as Pharmacy Inst 1
    participant S2 as Pharmacy Inst 2
    participant DB as MySQL Database (Stok = 1, Versi = 1)

    par Membaca Bersamaan
        S1->>DB: SELECT stok, versi FROM obat WHERE id = 1
        DB-->>S1: Stok = 1, Versi = 1
    and
        S2->>DB: SELECT stok, versi FROM obat WHERE id = 1
        DB-->>S2: Stok = 1, Versi = 1
    end

    Note over S1: S1 lebih cepat mengeksekusi update
    S1->>DB: UPDATE obat SET stok = 0, versi = 2 WHERE id = 1 AND versi = 1
    Note over DB: Versi cocok (1 == 1):<br/>Stok jadi 0, Versi jadi 2, affectedRows = 1
    DB-->>S1: affectedRows = 1 (SUKSES)
    S1-->>Klien1: 200 OK (Pesanan Berhasil)

    Note over S2: S2 mencoba mengupdate dengan versi yang dimilikinya (versi 1)
    S2->>DB: UPDATE obat SET stok = 0, versi = 2 WHERE id = 1 AND versi = 1
    Note over DB: Versi di DB sekarang adalah 2 (1 != 2):<br/>Query TIDAK cocok, affectedRows = 0
    DB-->>S2: affectedRows = 0 (KONFLIK DETEKSI)
    S2-->>Klien2: 409 Conflict (Konflik Data Basi / Version Mismatch)
```
