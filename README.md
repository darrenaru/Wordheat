# Wordheat

Game tebak kata harian dalam Bahasa Indonesia. Pemain mencari satu kata
rahasia; setiap tebakan dijawab dengan peringkat kedekatan makna, dan kata
rahasianya ada di peringkat 1.

Yang membedakannya dari permainan sinonim: peringkat dihitung dari kedekatan
konteks pemakaian kata, bukan kemiripan arti kamus. Karena itu "dokter",
"pasien", dan "klinik" berkumpul di peringkat berdekatan, begitu pula
"tutup" dengan "buka" — lawan kata pun muncul di konteks yang sama.

```
leher   -> tengkuk, bahu, pundak, pergelangan
janin   -> kehamilan, fetus, bayi, plasenta, rahim
hidung  -> pesek, mulut, telinga
```

Dua mode:

- **Sendiri** — satu kata harian, progres tersimpan di perangkat.
- **Bersama** — host membuat room dan mendapat kode empat huruf. Pemain lain
  masuk lewat kode itu, menunggu di ruang tunggu, lalu berburu kata yang sama.
  Tebakan siapa pun muncul di papan bersama dengan namanya, dan yang lebih dulu
  sampai peringkat 1 menang.

Profil bersifat opsional: main sendiri dan ikut room lewat kode tetap bisa
tanpa mendaftar. Profil dibutuhkan untuk berteman dan saling mengundang.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
```

Data puzzle sudah tersedia di `data/`, jadi aplikasinya langsung bisa
dimainkan tanpa menjalankan pipeline.

## Cara kerjanya

### Mesin semantik

Kedekatan makna diambil dari **fastText cc.id.300** — vektor 300 dimensi yang
dilatih pada Common Crawl dan Wikipedia Bahasa Indonesia. Peringkat sebuah
kata adalah posisinya ketika seluruh kosakata diurutkan menurut kemiripan
kosinus terhadap kata rahasia.

Berkas sumbernya 1,2 GB, tetapi token di dalamnya terurut menurut frekuensi.
Pipeline memanfaatkan itu: aliran unduhan dihentikan setelah kata-kata umum
terkumpul, sehingga hanya sekitar 190 MB yang benar-benar ditarik dan seluruh
proses selesai di bawah satu menit.

### Pembersihan kosakata

Kosakata mentah penuh derau yang merusak permainan. Tiga saringan dipakai,
semuanya diukur dari data alih-alih ditebak:

| Masalah | Penanganan |
| --- | --- |
| Bentuk berklitik (`rumahku`, `nyaringnya`) | Dibuang bila kemiripan vektornya terhadap kata dasar ≥ 0,55 — ini membuang `rumahku` tetapi mempertahankan `bangku`, yang bukan bentuk berklitik dari `bang`. |
| Reduplikasi jamak (`kucing-kucing`) | Dibuang bila kemiripannya terhadap kata dasar ≥ 0,72. Ambang ini memisahkan jamak (`orang-orang` 0,82) dari reduplikasi leksikal sejati (`kupu-kupu` 0,67, `laba-laba` 0,23), yang tetap dipertahankan. |
| Nama diri (`jakarta`, `latvia`) | fastText membedakan huruf besar-kecil dan mengurutkan token menurut frekuensi. Kalau bentuk tersering sebuah kata ternyata berkapital, kata itu nama diri. |

Hasilnya **56.734 kata** yang bisa ditebak.

Varian berimbuhan (`memasak` di samping `masak`) sengaja **dipertahankan**:
tidak ada ambang yang bisa memisahkan `memasak`↔`masak` (0,74) dari
`makanan`↔`makan` (0,72) tanpa ikut membuang kata umum. Kosakata tebakan yang
longgar juga lebih ramah bagi pemain. Sebagai gantinya, **kata rahasia**
dibatasi ke bentuk dasar menurut stemmer Sastrawi, sehingga jawabannya tidak
pernah berupa kata berimbuhan yang kata dasarnya sudah ada di daftar.

### Bentuk data

Peringkat disimpan sebagai `Uint16` per indeks kosakata: satu puzzle hanya
113 KB, dan menjawab satu tebakan cukup membaca satu angka pada offset yang
sudah diketahui — tanpa penyusunan peta saat berkas dimuat.

Kata rahasia dan tabel peringkat tidak pernah menyeberang ke browser. Klien
hanya menerima peringkat untuk kata yang benar-benar ditebak pemain.

### Room multiplayer

Room disimpan di memori proses, tanpa basis data: permainannya berumur pendek
dan tidak berharga untuk disimpan permanen. Konsekuensinya harus disadari
sebelum menyebarkan aplikasi ini — **room hilang saat server dimulai ulang, dan
penyebaran ke banyak instance butuh penyimpanan bersama seperti Redis.** Untuk
satu proses `next start`, apa adanya sudah cukup.

Perubahan keadaan disiarkan lewat Server-Sent Events. Koneksi aliran itu
sekaligus jadi penanda kehadiran: selama terbuka, pemainnya dianggap ada di
room. Menutup tab akan mengeluarkan pemain setelah tenggang 12 detik — cukup
lama supaya menyegarkan halaman tidak terbaca sebagai keluar-lalu-masuk. Host
yang pergi menyerahkan kendali ke pemain terlama berikutnya, agar room tidak
terkunci selamanya di ruang tunggu.

Kode room memakai alfabet tanpa huruf dan angka yang mudah tertukar saat
dibacakan lewat suara: tidak ada `O`/`0`, `I`/`1`, `S`/`5`, `B`/`8`, `Z`/`2`.

### Profil, teman, dan undangan

Room boleh hilang saat restart; daftar teman tidak boleh. Karena itu akun
disimpan di **SQLite bawaan Node** (`node:sqlite`) — tanpa dependensi baru dan
tanpa kompilasi native. Berkasnya `data/wordheat.db`, tidak ikut versi.

Pembagian penyimpanannya disengaja:

| Data | Disimpan di | Alasan |
| --- | --- | --- |
| Profil, teman, permintaan | SQLite | harus bertahan selamanya |
| Room, pemain, papan bersama | memori proses | umurnya menit, mati bersama permainannya |
| Peringkat 56.734 kata per puzzle | berkas biner | `Uint16` di offset tetap; baris database justru lebih lambat dan lebih besar |
| Undangan room | memori proses | tidak berguna lagi setelah room-nya usai |

**Tidak ada kata sandi.** Identitas dipegang cookie sesi HttpOnly di perangkat,
ditambah kode pemulihan sekali-tampil untuk masuk dari perangkat lain. Untuk
permainan kasual, meminta kata sandi berarti ikut menanggung penyimpanan sandi,
alur reset, dan pengumpulan surel — padahal tidak ada yang perlu dilindungi
selain nama dan daftar teman. Yang tersimpan di server hanya sidik jari SHA-256
dari kode pemulihan dan token sesi, sehingga bocornya berkas basis data tidak
langsung memberi siapa pun akses masuk.

Tabel `credentials` sengaja dipisah dari `accounts` supaya satu akun bisa punya
beberapa cara masuk. **Menambah login Google nanti cukup menyisipkan satu baris
dengan `kind='google'` dan `identifier` berisi klaim `sub`** — profil, teman,
dan riwayat pemainnya tidak ikut tersentuh. `UNIQUE(kind, identifier)` mencegah
satu akun Google terikat ke dua profil.

Pertemanan disimpan sebagai pasangan terurut dengan `CHECK (a_id < b_id)`,
sehingga satu hubungan mustahil tercatat dua kali dengan urutan terbalik.
Mengirim permintaan ke orang yang sudah lebih dulu mengirim permintaan ke kita
langsung dijadikan pertemanan — dua permintaan yang saling menunggu tidak
masuk akal.

Migrasi dijalankan ulang setiap kali `lib/db.ts` dimuat, bukan hanya saat
koneksi dibuat. Koneksinya sengaja bertahan di `globalThis` supaya room tidak
hilang saat kode berubah — dan kalau migrasi ikut terikat ke pembuatan
koneksi, kolom baru tidak akan pernah terpasang selama proses pengembangan
masih hidup, lalu penyimpanannya gagal diam-diam. Migrasinya idempoten, jadi
aman diulang.

Permintaan pertemanan dan undangan sampai lewat **saluran SSE pribadi per
akun** (`/api/me/stream`), dipasang sekali di layout lewat satu provider.
Membuka aliran per komponen akan menabrak batas koneksi serentak browser
berbarengan dengan aliran room.

### Landing page

Susunannya mengikuti apa yang paling sering dibutuhkan lebih dulu: pemain yang
baru dikirimi kode oleh temannya datang untuk satu hal saja, jadi **input kode
room ditaruh paling atas** — sebelum pilihan mode apa pun.

Di bawahnya, tiap mode permainan adalah satu kartu. Kartu dibangkitkan dari
array `cards` di `components/Landing.tsx` lewat komponen `ModeCard`, sehingga
**menambah fitur baru cukup menambah satu entri**:

```tsx
{
  icon: TrophyIcon,
  title: "Papan peringkat",
  description: "…",
  action: "Lihat",
  accent: "var(--accent-warm)",
  href: "/leaderboard",
}
```

Grid-nya `sm:grid-cols-2`, jadi kartu ketiga dan keempat mengalir sendiri tanpa
menyusun ulang tata letak. Ikonnya digambar tangan di `components/icons.tsx`
alih-alih memakai pustaka ikon: yang dibutuhkan cuma segelintir bentuk, dan
ketebalan garisnya harus sama persis dengan sisa antarmuka.

Warna aksen kartu memakai `--accent-warm` / `--accent-hot`, bukan token warna
langsung, karena oranye bara nyaris hilang di atas kertas krem. Di tema terang
`--accent-warm` beralih ke anggur `#7a1a4a` — masih satu keluarga dengan ramp
suhu, tetapi terbaca.

### Logo

Tanda gambarnya satu path berbentuk kilat dengan warna `#FF319F` — persis token
`flare`, ujung terpanas ramp suhu. Logo dan mekanik permainannya jadi memakai
bahasa warna yang sama tanpa perlu disesuaikan.

Tanda itu hidup di tiga tempat, masing-masing dengan alasannya:

- `components/Logo.tsx` — SVG sebaris, dipakai antarmuka. Ditulis sebaris,
  bukan memuat berkas dari `public/`, supaya warnanya diwarisi dari CSS dan
  tidak ada permintaan jaringan tambahan untuk tanda seukuran teks.
- `app/icon.svg` — ikon tab. Diberi latar gelap tetap: krom browser warnanya
  tidak bisa kita ketahui, dan tanda merah muda setipis ini hilang di atas
  latar terang.
- `public/logo.svg` — berkas berdiri sendiri untuk pemakaian di luar aplikasi.
  `stroke="black"` dari berkas asli dibuang; itu artefak ekspor yang jadi
  pinggiran kotor saat tandanya mengecil.

`components/Wordmark.tsx` menyatukan tanda dengan tulisan sebagai satu kunci,
sehingga perbandingan keduanya sama persis di setiap halaman alih-alih diketik
ulang dan pelan-pelan bergeser. Kunci itu duduk di kiri atas setiap halaman,
termasuk halaman depan; hero halaman depan sengaja hanya berisi tulisan besar,
karena dua tanda yang sama dalam satu layar justru saling melemahkan.

### Avatar

Avatar dibangkitkan [DiceBear](https://www.dicebear.com/styles/adventurer/)
gaya *adventurer*, jadi tidak ada berkas yang perlu diunggah — profil cukup
menyimpan konfigurasinya. Pemain bisa mengatur rambut (45 varian + tanpa),
alis (15), mata (26), mulut (30), detail wajah, kacamata, anting, warna kulit,
warna rambut, dan warna latar.

**Dirender sendiri lewat `/api/avatar`**, bukan menautkan ke api.dicebear.com.
Alasannya konkret: pemilih avatar menampilkan puluhan pratinjau sekaligus, dan
itu tidak pantas dilemparkan ke layanan orang lain. Sekalian, avatar tetap
muncul tanpa koneksi keluar dan tanpa batas laju.

Bidang yang tidak diisi sengaja dibiarkan **ikut benih**, bukan dipaksa ke
nilai bawaan. Dengan begitu profil lama tetap tampil sama, dan pemain yang cuma
mengganti rambut tidak kehilangan wajah acaknya. Karena itu `null` dan
`undefined` punya arti berbeda di seluruh lapisan avatar: `null` berarti
"sengaja ditiadakan", `undefined` berarti "ikut benih".

Gambar disajikan dengan `Cache-Control: immutable` — susunan parameter yang
sama selalu menghasilkan gambar yang sama. Konsekuensinya, perbaikan pada cara
render tidak akan terlihat sampai alamatnya berubah, jadi ada
`RENDER_VERSION` di `lib/avatar.ts` yang ikut masuk ke URL. **Naikkan angka itu
setiap kali hasil gambar berubah untuk parameter yang sama.**

Warna latar memakai palet DESIGN.md supaya avatar menyatu dengan antarmuka;
warna kulit dan rambut memakai palet bawaan DiceBear.

Kolom kiri studio (`components/AvatarStudio.tsx`) **sengaja tidak menggulir** —
pemisahnya garis, bukan batang gulir. Konsekuensinya isinya wajib muat, jadi
ukuran pratinjau dibatasi sisa ruang setelah bagian tetap di bawahnya:
`min(11rem, calc(70vh - 270px))`. Angka 270px itu tinggi bagian tetapnya (dua
baris warna, tombol acak, dan Kembalikan). **Kalau menambah isi ke kolom itu,
naikkan angkanya** — persentase layar saja tidak cukup, karena bagian tetap
tidak ikut mengecil ketika jendela dipendekkan.

Penanda terpilih pada petak warna digambar ke dalam (`ring-inset`), bukan
membesarkan petaknya. Petak pertama menempel di tepi kolom, jadi apa pun yang
menjulur keluar akan terpotong.

## Membangkitkan ulang data

Butuh Python 3.12+ dan sekitar 200 MB unduhan.

```bash
pip install -r pipeline/requirements.txt PySastrawi

python pipeline/fetch_lexicon.py      # wordlist KBBI penyaring
python pipeline/build_vectors.py      # vektor kata  (~30 detik)
python pipeline/select_secrets.py     # kandidat kata rahasia
python pipeline/build_puzzles.py --count 30 --start 2026-08-15 --clean
```

Memeriksa kualitas ranking sebuah kata:

```bash
python pipeline/inspect_similarity.py dokter kucing --top 20
```

Menentukan kata rahasia sendiri alih-alih mengacak:

```bash
python pipeline/build_puzzles.py --words kucing gunung sepeda --start 2026-09-01
```

## Struktur

```
app/
  page.tsx          landing: pilih mode, buat room, masuk lewat kode
  solo/             permainan harian sendiri
  room/[code]/      ruang tunggu dan papan bersama
  profile/          profil, avatar, dan pengelolaan teman
  api/guess         menilai satu tebakan
  api/hint          kata yang peringkatnya separuh jalan dari tebakan terbaik
  api/reveal        membuka jawaban ketika pemain menyerah
  api/room/*        buat, gabung, mulai, tebak, dan aliran keadaan room
  api/auth          buat profil, masuk dengan kode pemulihan, keluar
  api/profile       ubah username, nama tampilan, dan avatar
  api/friends       tambah, terima, tolak, hapus teman
  api/friends/invite mengundang teman ke room
  api/me/stream     saluran pribadi: permintaan teman dan undangan
components/       papan permainan, baris tebakan, kartu mode, avatar, profil, tema
lib/              skala suhu, data puzzle, room, akun, basis data, tema
pipeline/         pembangkit data berbasis Python
data/             kosakata, berkas peringkat, dan basis data akun
DESIGN.md         token desain yang dipakai antarmuka
```

## Catatan desain

Nama produk dijadikan mekanik visual. Setiap baris tebakan adalah alat ukur
suhu: lebar isiannya memakai skala logaritmik
`t = 1 − ln(peringkat) / ln(56.734)`, karena rasa "dekat" pada manusia bersifat
logaritmik — selisih peringkat 5 ke 50 terasa jauh lebih besar daripada 5.000
ke 5.045. Peringkat 1.000 mengisi 37% baris, bukan 98%.

Elemen tanda tangannya: latar halaman ikut memanas mengikuti tebakan terdekat
pemain, dan berkilat sekali saat kata rahasianya ketemu.

### Dua tema, dua ramp

Tema gelap adalah bawaan. Keduanya tidak berbagi ramp warna, karena masing-masing
menyandikan panas dengan cara berbeda:

- **Gelap** — panas adalah **kecerahan**. Ramp mengikuti urutan pijar benda
  hitam: `#3b142a` bara mati → `#ff319f` nyala → `#ffc48a` putih panas. Baris
  yang panas juga memancarkan pendar, karena cahaya butuh kegelapan untuk
  terlihat.
- **Terang** — urutan itu tidak bisa dipakai; oranye muda justru paling lemah
  kontrasnya terhadap krem. Jadi panas disandikan lewat **saturasi** dan ramp
  berhenti di `#ff319f`, sementara pendarnya dimatikan supaya tidak terbaca
  sebagai kotor.

Kedua warna dihitung sekaligus lalu ditulis sebagai variabel CSS terpisah,
dan stylesheet yang memilih. Berganti tema jadi tidak perlu menunggu React
menghitung ulang, dan skrip sinkron di `<head>` mencegah kedip saat memuat.

### Kontras yang benar di sepanjang ramp

Teks pada baris digambar dua kali di posisi yang sama persis, lalu lapisan
keduanya dipotong tepat di tepi isian memakai `clip-path`. Satu properti CSS
bertipe (`@property --fill`) menggerakkan lebar isian sekaligus batas
potongnya, sehingga keduanya mustahil keluar dari sinkron saat beranimasi.

Warna lapisan kedua tidak ditetapkan begitu saja: untuk tiap tingkat suhu,
dipilih antara krem dan hampir-hitam mana yang rasio kontras WCAG-nya lebih
tinggi terhadap warna isian di titik itu. Hasilnya kata yang panjang terlihat
terbelah oleh batas panas yang merambat melewatinya — dan tetap terbaca di
kedua sisinya.
