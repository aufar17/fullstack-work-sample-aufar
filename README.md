# Work Sample Test - Fullstack Development & Business Systems
**Nama:** Muammar Aufar Prasetya
**Posisi:** System Developer

---

## Soal #1: Optimasi Performa & State Management React

---

a. Diagnosa Teknis
Penyebab utama *unnecessary re-render* pada dataset 5.000+ baris adalah mekanisme *default* React yang melakukan rekonsiliasi ke seluruh komponen turunan (*children*) setiap kali terjadi perubahan *state* pada komponen induk (*parent*). Jika satu item mengalami perubahan stok, komponen induk penyimpan *state* daftar produk akan berubah, memicu 5.000 evaluasi ulang di Virtual DOM. Ini membebani *main thread* browser dan menyebabkan *lag* yang parah.

b. Cara Menjalankan Aplikasi (Mini App)
Aplikasi telah diimplementasikan dalam folder `/src`. Untuk menjalankannya secara lokal:
1. Jalankan `npm install`
2. Jalankan `npm run dev`
3. Buka tautan lokal yang muncul di terminal (biasanya http://localhost:5173)

c. Strategi State Management
Strategi yang saya terapkan agar *update* item individual tidak memicu *re-render global* adalah:
1. Virtualization: Menggunakan pustaka `react-window` untuk membatasi *rendering* DOM hanya pada baris yang terlihat di *viewport*.
```
<List
  className="pd-list"
  defaultHeight={LIST_HEIGHT}
  rowCount={products.length}
  rowHeight={ROW_HEIGHT}
  rowComponent={ProductRow}
  rowProps={rowProps}
  overscanCount={10}
  style={{
    height: LIST_HEIGHT,
    overflow: 'auto',
    position: 'relative',
  }}
/>
```
3. Stable References: Menggunakan *hook* `useCallback` pada fungsi mutasi (*updater function*) seperti `onUpdate` agar referensi fungsinya tidak berubah pada setiap *re-render* komponen induk.

```
 const onUpdate = useCallback((id) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, stock: Math.max(0, p.stock - 1) } : p
      )
    );
  }, []);

```
5. Memoization Membungkus komponen anak (seperti `ProductRow`) dengan `React.memo` sehingga hanya komponen dengan *props* yang benar-benar berubah yang akan di-*render* ulang. Data dan fungsi yang diteruskan juga dibungkus dalam `useMemo`.
```
const ProductRow = memo(({ index, style, ariaAttributes, products, onUpdate }) => {
  const product = products[index];
  const isOutOfStock = product.stock <= 0;

  return (
    <div className="pd-row" style={style} {...ariaAttributes}>
      <span className="pd-row-name">{product.name}</span>
      <span className="pd-row-stock">
        <span
          className={`pd-row-stock-dot${isOutOfStock ? ' pd-row-stock-dot--empty' : ''}`}
        />
        Stock: <strong>{product.stock}</strong>
      </span>
      <button
        className={`pd-btn ${isOutOfStock ? 'pd-btn--disabled' : 'pd-btn--primary'}`}
        onClick={() => onUpdate(product.id)}
        disabled={isOutOfStock}
        aria-label={`Update stock for ${product.name}`}
      >
        {isOutOfStock ? 'Out' : '− Update'}
      </button>
    </div>
  );
});

 const rowProps = useMemo(
    () => ({ products, onUpdate }),
    [products, onUpdate]
  );
```

---

## Soal #2: Arsitektur Backend, Autentikasi JWT, & High-Concurrency Scaling

### Pemilihan Tech Stack
Untuk menangani *traffic spike* ribuan permintaan per detik saat Flash Sale, saya memilih **Go (Golang)** dengan kombinasi **PostgreSQL** dan **Redis**. Alasannya praktis: Go sangat ringan dan goroutine-nya luar biasa efisien untuk menangani konkurensi tinggi tanpa memakan banyak memori. PostgreSQL kuat untuk integritas data transaksional, sedangkan Redis bertugas sebagai *caching layer* berkecepatan tinggi.

### Penanganan Token Revocation JWT
Karena JWT bersifat *stateless*, me-revoke token saat *logout* sering jadi dilema. Pendekatan saya adalah menggunakan skema **Denylist (Blacklist) di Redis**. 
* Saat *user logout*, ID token (JTI - *JWT ID*) dimasukkan ke dalam Redis dengan nilai waktu kedaluwarsa (TTL) yang persis sama dengan sisa waktu *expired* JWT tersebut.
* Setiap kali ada *request* masuk, *middleware* backend hanya perlu mengecek apakah JTI ada di Redis. 
* Cara ini tidak merusak sifat *stateless* JWT karena kita tidak perlu menyimpan semua token yang valid di *database*, melainkan hanya mencegat token spesifik yang sudah dibuang secara sementara di *memory* super cepat.

### Strategi Penanganan Race Condition (Flash Sale)
Ketika 100 *user* memperebutkan 1 sisa barang yang sama, kita harus menghindari *over-selling*. Solusinya adalah menerapkan **Pessimistic Locking** di tingkat *database* SQL.
* Saat transaksi masuk, backend menjalankan *query* `SELECT * FROM products WHERE id = X FOR UPDATE`.
* Instruksi `FOR UPDATE` ini akan mengunci (*lock*) baris data produk tersebut. 
* 99 *request* lainnya yang datang sepersekian milidetik kemudian akan dipaksa mengantre oleh *database* sampai *request* pertama selesai melakukan `UPDATE` stok dan melakukan *commit* transaksi. Jika stok habis oleh *user* pertama, 99 *user* lainnya akan langsung mendapat *response* "Stok Habis".

### Diagram Arsitektur (Mermaid.js)

graph TD
    Client[Client App] -->|HTTPS| API_Gateway[API Gateway / Load Balancer]
    API_Gateway --> Go_App[Golang Backend Service]
    Go_App -->|Check JWT Blacklist| Redis[(Redis Cache)]
    Go_App -->|Pessimistic Lock & Checkout| Postgres[(PostgreSQL DB)]


---

## Soal #3: Strategi Integrasi API, Webhook Reliability, & Resiliency

### Mekanisme Idempotency Webhook
Untuk mencegah transaksi terproses ganda saat ada *glitch* jaringan dari Payment Gateway, setiap *endpoint* Webhook harus *idempotent*. 
* Kami mewajibkan adanya `Idempotency-Key` (bisa menggunakan *Transaction ID* dari *gateway*) di *header* atau *payload*.
* Sebelum mengubah status pembayaran, sistem akan mengecek tabel `processed_webhooks` di DB. Jika ID tersebut sudah berstatus 'SUCCESS', backend langsung merespons dengan HTTP `200 OK` tanpa menyentuh logika saldo atau pemesanan lagi. 

### Fallback & Retry Mechanism
Jika Webhook gagal atau *timeout*, kita tidak bisa membiarkan *user* menggantung. 
* Strategi utamanya adalah menggunakan **Cron Job / Background Worker** yang berjalan setiap 3-5 menit.
* *Worker* ini akan menyapu (*polling*) tabel transaksi mencari order yang usianya lebih dari 5 menit tapi statusnya masih 'PENDING'.
* Sistem kemudian secara proaktif memanggil API "Check Payment Status" milik Payment Gateway untuk melakukan sinkronisasi status terbaru secara manual.

### Real-time Sync ke Frontend
Meminta frontend React untuk melakukan *Long Polling* sangat membebani server. Di sisi lain, *WebSocket* terlalu berlebihan karena sifatnya *bidirectional* (dua arah).
* Pilihan terbaik di sini adalah **Server-Sent Events (SSE)**.
* Melalui SSE, klien membuka satu koneksi HTTP yang tahan lama. Begitu backend menerima *update* Webhook dari Payment Gateway, backend langsung "mendorong" status sukses tersebut searah ke React. *User experience* akan terasa instan tanpa membuang *resource* server.

---

## Soal #4: Evaluasi TCO & Trade-off Monolith vs Microservices

### Analisis Total Cost of Ownership (TCO)
Untuk sebuah aplikasi tahap awal-menengah dengan biaya server yang saat ini hanya $150/bulan, usulan langsung bermigrasi ke *Cloud-Native Microservices* (seperti Kubernetes, AWS Lambda, dll.) adalah keputusan bisnis yang **sangat tidak menguntungkan**. Biaya minimum untuk membuat klaster Kubernetes (EKS/GKE) ditambah *managed database* yang terpisah per layanan akan langsung melambungkan tagihan bulanan menjadi sedikitnya $500-$1000+, tanpa memberikan nilai tambah langsung pada pendapatan saat ini.

### Hidden Costs Arsitektur Microservices
Ada beberapa biaya tersembunyi (*hidden costs*) yang sering diremehkan saat pindah ke Microservices:
* **Infrastruktur Jaringan:** Biaya *egress* antar-servis (komunikasi jaringan) dan kebutuhan *tooling observability* yang mahal (seperti Datadog) untuk melacak *error* yang melompat-lompat antar servis.
* **Operational Effort (Tim Engineering):** Beban kognitif *developer* akan melonjak tajam. Tim yang tadinya fokus membuat fitur harus mulai pusing mengurus *CI/CD pipeline* yang rumit, Docker *orchestration*, dan *network latency*.

### Rekomendasi Arsitektur Kompromi
Sebagai jalan tengah yang efisien, saya sangat merekomendasikan **Modular Monolith**. 
* Secara infrastruktur, aplikasi tetap di-*deploy* sebagai satu kesatuan (*monolith*) sehingga biaya server tetap murah di angka $150/bulan.
* Namun secara *codebase*, kami memisahkan *domain* (misalnya: modul `User`, `Order`, `Payment`) secara ketat (tidak boleh ada pemanggilan *database* lintas modul secara langsung).
* Jika suatu saat *startup* meledak dan butuh *scale-out*, kita bisa memecah modul tersebut menjadi *microservices* betulan dengan sangat mudah dan terukur. Kecepatan rilis fitur (*deliver feature*) terjaga tanpa membakar uang investor.

---

## Soal #5: Prioritisasi Feature, Metrik Software (LTV/CAC), & Handling Tech Debt

### 1. Komunikasi Dampak Technical Debt kepada Stakeholder Non-Teknis
Sebagai Lead/Senior Developer, saya akan menghindari penggunaan jargon teknis (seperti *memory leak* atau *spaghetti code*) dan menerjemahkan ancaman *tech debt* ini ke dalam **Risiko Bisnis**. Saya akan menjelaskan kepada Product Manager bahwa memaksakan 3 fitur baru di atas sistem yang rapuh berisiko menyebabkan server *down*. 

Jika server *down* saat fitur baru diluncurkan, maka biaya *marketing* yang sudah dikeluarkan untuk mengakuisisi *user* (CAC) akan hangus sia-sia karena *user* tidak bisa menyelesaikan transaksi

### 2. Hubungan Kualitas Codebase dengan Churn Rate & LTV
Kualitas *codebase* dan reliabilitas sistem memiliki korelasi langsung dan signifikan terhadap metrik bisnis:
*   **Churn Rate:** Sistem yang penuh bug, lambat, atau sering down akan menciptakan User Experience (UX) yang buruk. Pelanggan yang frustrasi akan langsung meninggalkan aplikasi atau beralih ke kompetitor, sehingga *Churn Rate* (tingkat kehilangan pelanggan) akan melonjak tajam dan berkurangnya kepercayaan terhadap aplikasi.
*   **Customer Lifetime Value (LTV):** LTV adalah total pendapatan yang bisa kita dapatkan dari satu pelanggan selama mereka menggunakan aplikasi kita. Tingginya *Churn Rate* akibat sistem yang buruk akan memperpendek umur pelanggan. Jika LTV turun hingga lebih rendah dari biaya akuisisinya (CAC), maka secara *unit economics*, perusahaan akan rugi setiap kali mendapatkan pengguna baru.

### 3. Framework Prioritisasi Sprint (Resolusi Konflik)
Untuk menyeimbangkan kebutuhan bisnis (target CAC) dan stabilitas sistem (menyelesaikan ancaman *down*), saya akan menggunakan kerangka kerja pembagian kapasitas (*Capacity Allocation Framework*) dengan porsi **70/30 atau 80/20**:
*   **70% Kapasitas Tim (New Features):** Difokuskan untuk membangun 1 atau 2 fitur dari 3 fitur yang diminta PM. Kami akan meminta PM untuk mengurutkan fitur mana yang paling berdampak langsung terhadap penurunan CAC, dan menunda 1 fitur sisanya ke *sprint* berikutnya.
*   **30% Kapasitas Tim (Tech Debt Refactoring):** Didedikasikan secara ketat untuk menambal titik-titik krisis pada *backend* dan React yang paling berpotensi membuat server mati. Refactoring difokuskan hanya pada "area berdarah" (*critical path*), bukan perbaikan kosmetik kode secara keseluruhan.
