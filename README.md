# Work Sample Test - Fullstack Development & Business Systems
**Nama:** Muammar Aufar Prasetya
**Posisi:** System Developer

//-----------------------------------------------//
Soal #1: Optimasi Performa & State Management React
//-----------------------------------------------//

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
2. Stable References: Menggunakan *hook* `useCallback` pada fungsi mutasi (*updater function*) seperti `onUpdate` agar referensi fungsinya tidak berubah pada setiap *re-render* komponen induk.
3. Memoization Membungkus komponen anak (seperti `ProductRow`) dengan `React.memo` sehingga hanya komponen dengan *props* yang benar-benar berubah yang akan di-*render* ulang. Data dan fungsi yang diteruskan juga dibungkus dalam `useMemo`.

---

## Soal #2: Arsitektur Backend, Autentikasi JWT, & High-Concurrency Scaling
*(Jawaban akan ditulis di sini)*

---

## Soal #3: Strategi Integrasi API, Webhook Reliability, & Resiliency
*(Jawaban akan ditulis di sini)*

---

## Soal #4: Evaluasi TCO & Trade-off Monolith vs Microservices
*(Jawaban akan ditulis di sini)*

---

## Soal #5: Prioritisasi Feature, Metrik Software, & Handling Tech Debt
*(Jawaban akan ditulis di sini)*
