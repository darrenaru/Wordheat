# Wordheat

Game tebak kata berbasis **kedekatan makna** dalam Bahasa Indonesia. Ada satu kata
rahasia; setiap tebakan diberi label suhu (Beku → Dingin → Sejuk → Hangat → Panas →
Panas Sekali → Tepat) sesuai seberapa dekat maknanya — bukan ejaannya.

Bisa dimainkan sendiri, lewat kata harian, atau **bareng orang lain** di ruang
multiplayer dengan kode undangan.

Implementasi dari [PRD.md](PRD.md) dan [DESIGN.md](DESIGN.md).

---

## Menjalankan

```bash
npm install
npm run dev          # server :8787 + client :5173 (buka http://localhost:5173)
```

Untuk mode produksi:

```bash
npm run build
npm start            # satu server di :8787 melayani API, WebSocket, dan halaman
```

Perintah lain:

| Perintah | Kegunaan |
|---|---|
| `npm run typecheck` | Type-check seluruh proyek |
| `npm run lexicon:check` | Ringkasan kosakata + sanity check pasangan kata |
| `npm run lexicon:check topi hujan` | Lihat 15 kata terdekat dari kata tertentu |
| `npm run embeddings:build [jumlahKata]` | Unduh ulang & saring vektor fastText (default 50.000 kata) |
| `npm run smoke` | Uji asap multiplayer lewat dua klien WebSocket (server harus hidup) |

---

## Mode permainan

**Main sendiri** — kata acak, tanpa batas waktu, dengan tombol petunjuk dan menyerah.

**Kata harian** — satu kata yang sama untuk semua pemain sepanjang hari (acuan WIB).
Dipilih deterministik dari tanggal, jadi server mana pun menghasilkan kata yang sama.

**Main bareng** — buat ruang, bagikan kode 5 huruf atau tautannya. Semua pemain
menebak kata yang sama secara bersamaan, ke satu **papan tebakan bersama**: setiap
tebakan siapa pun langsung terlihat semua orang, ditandai siapa yang menebaknya,
diurut dari yang paling dekat maknanya — jadi tim benar-benar menebak bareng-bareng,
bukan diam-diam berlomba sendiri. Kata rahasianya sendiri tetap tidak pernah dikirim
ke client sampai ronde berakhir. Host mengatur batas waktu, jatah tebakan, dan apakah
ronde berhenti pada pemenang pertama atau menunggu semua selesai.

---

## Mesin kedekatan makna

PRD merekomendasikan embedding fastText `cc.id.300`. File aslinya ±4,5 GB sehingga
tidak realistis dibundel, jadi yang disimpan di repo bukan file itu sendiri, melainkan
hasil saringannya:

- ±50.000 kata Bahasa Indonesia paling umum, masing-masing dengan vektor fastText asli
  300 dimensi (`server/src/semantic/data/embeddings.vec.bin` + `embeddings.words.txt`,
  ±60 MB total).
- Dihasilkan sekali lewat `npm run embeddings:build`, yang mengunduh
  `cc.id.300.vec.gz` resmi, menyaring token yang bukan kata Bahasa Indonesia bersih
  (angka, tanda baca, kata di `blocklist.txt`), lalu menyimpan hasilnya secara lokal.
  Perintah ini **tidak** perlu dijalankan lagi untuk mode dev/produksi biasa — hanya
  kalau mau mengganti ukuran kosakata.
- Kemiripan dihitung dengan **cosine similarity** atas vektor padat 300 dimensi;
  hasilnya deterministik dan cepat (dihitung sekali per kata target lalu di-cache) —
  syarat mutlak agar semua pemain di satu ronde melihat angka yang sama.
- Saat server jalan (`npm run dev`/`npm start`), tidak ada unduhan model atau
  panggilan API — hanya `readFileSync` atas berkas yang sudah disaring, jalan
  sepenuhnya offline.

### Kata target & alias

Kata yang boleh menjadi jawaban dikurasi terpisah di `targets.txt` (±980 kata konkret
dan umum, dibangun otomatis dari irisan lexicon kurasi lama dengan kosakata fastText
baru); server menolak start kalau ada target yang belum punya vektor. `aliases.txt`
memetakan bentuk lain yang lumrah diketik pemain (mis. singkatan) ke bentuk kanonik.

`server/src/semantic/data/lexicon.lex` adalah **arsip** dari lexicon semantik buatan
tangan versi sebelumnya (987 kata, fitur sparse manual) — sudah tidak dipakai server
saat runtime, tapi tetap dipakai `tools/build-embeddings.ts` sebagai daftar kata
terkurasi (konkret, aman) untuk menyusun ulang `targets.txt`/`aliases.txt` tiap kali
`npm run embeddings:build` dijalankan ulang.

### Suhu dan peringkat

Label suhu ditentukan terutama oleh **peringkat**, bukan nilai cosine mentah — skala
cosine berbeda antar kata target, sehingga peringkat terasa lebih adil. Nilai cosine
tetap dipakai sebagai penahan ringan untuk kasus ekstrem. Panjang heat meter diikat ke
band suhu yang sama, jadi bar dan label tidak pernah bertentangan.

Contoh keluaran `npm run lexicon:check`:

```
topi       ~ kepala     sim=0.295 rank=146 Hangat
topi       ~ sepatu     sim=0.423 rank= 21 Panas Sekali
topi       ~ makan      sim=0.131 rank=  - Beku
kucing     ~ anjing     sim=0.650 rank=  3 Panas Sekali
dokter     ~ obat       sim=0.360 rank= 70 Panas
```

---

## Arsitektur

```
shared/types.ts             Kontrak HTTP + WebSocket, dipakai server dan client
server/src/
  semantic/                 Loader embedding, mesin cosine, pemetaan suhu
    data/                   embeddings.vec.bin, targets.txt, blocklist.txt, aliases.txt
    tools/build-embeddings.ts  Script build sekali-jalan (unduh & saring fastText)
  game/                     Sesi solo, kata harian, manajemen ruang
  http/api.ts               REST untuk mode solo
  ws/gateway.ts             WebSocket untuk mode multiplayer
client/src/
  screens/                  Beranda, solo, ruang, studio avatar, aturan main
  components/               Heat meter, riwayat tebakan, daftar pemain, UI dasar
  lib/                      Client API, socket sambung-ulang, avatar, router
scripts/smoke-multiplayer.ts  Uji asap dua klien
```

**Kata rahasia tidak pernah dikirim ke client** sebelum ronde selesai. Skor dihitung
sepenuhnya di server, jadi tidak bisa dimanipulasi dari sisi pemain.

### Ketahanan koneksi

Pemain diidentifikasi lewat `id` yang bertahan di `localStorage`, sehingga reload atau
jaringan yang putus sebentar mengembalikan pemain ke kursinya lengkap dengan riwayat
tebakan ronde berjalan. Dua hal yang ditangani khusus:

- Socket lama yang baru menutup *setelah* pemain menyambung ulang tidak boleh mencabut
  koneksi penggantinya — tanpa penjagaan ini setiap reconnect menendang dirinya sendiri.
- Penutupan yang disengaja server (profil dibuka di tab lain, atau dikeluarkan host)
  memakai kode 4001/4002 supaya client tahu harus berhenti, bukan mencoba lagi.

---

## Desain

Mengikuti DESIGN.md: dark mode sebagai basis, Inter, spacing kelipatan 8, lebar konten
680 px, dan spektrum suhu biru → merah yang hanya muncul sebagai sinyal informasi di
elemen kecil.

Suhu tidak pernah disampaikan lewat warna saja — selalu ada label teks, angka
peringkat, dan panjang bar. Angka memakai tabular figures agar tidak melompat saat
berubah.

Avatar memakai [DiceBear](https://dicebear.com) (5 gaya, latar dari palet token).
Paket DiceBear lebih besar dari seluruh sisa aplikasi, jadi dimuat sebagai chunk
terpisah: bundle awal 177 kB (57 kB gzip), avatar menyusul dengan placeholder inisial
sementara.

---

## Batasan yang diketahui

- Semua keadaan disimpan di memori. Restart server menghapus ruang dan sesi solo yang
  sedang berjalan. Untuk produksi multi-instance perlu Redis atau sejenisnya.
- Kualitas kedekatan makna dibatasi kosakata yang sudah disaring (±50.000 kata); kata
  di luar daftar ditolak sebagai "tidak ada di kamus". Memperluasnya berarti
  menjalankan ulang `npm run embeddings:build` dengan angka target lebih besar.
- Kosakata mentah dari fastText (hasil crawl web) belum tentu bersih 100% — beberapa
  kata asing/nama diri/istilah teknis bisa lolos filter otomatis; `blocklist.txt`
  jadi jaring pengaman untuk kata kasar/eksplisit/sensitif yang lolos.
- Leaderboard lintas ronde baru berupa skor kumulatif per ruang, belum ada papan
  peringkat global atau statistik pribadi (Fase 2 di PRD).
