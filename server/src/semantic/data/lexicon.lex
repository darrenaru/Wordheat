# ============================================================================
# LEXICON SEMANTIK — Bahasa Indonesia (ARSIP, tidak dipakai server saat runtime)
# ============================================================================
# Mesin kedekatan makna sekarang memakai vektor embedding fastText (lihat
# server/src/semantic/embeddings.ts), bukan lagi fitur sparse buatan tangan
# di file ini. File ini disimpan karena masih dipakai sebagai daftar kata
# terkurasi (konkret, umum, aman) oleh server/src/semantic/tools/build-embeddings.ts
# untuk menyusun ulang targets.txt/aliases.txt tiap kali embedding dibangun ulang.
#
# Format lama (referensi saja):
#   @ <fitur...>   -> fitur yang diwarisi baris kata di bawahnya
#   kata, kata     -> daftar kata
#   + kata: <fitur>-> fitur tambahan khusus satu kata
#   ~ kanonik -> alias, alias
# Bobot: 3 = fitur inti, 2 = kuat (default), 1 = kaitan lemah.
# ============================================================================


# ---------------------------------------------------------------------------
# HEWAN
# ---------------------------------------------------------------------------

@ hewan3 makhluk2 mamalia2 darat1
sapi, kambing, kuda, babi, kelinci, tikus, gajah, harimau, singa, monyet, beruang, rusa, kerbau, domba, serigala, jerapah, zebra, unta, tupai, kucing, anjing
+ sapi: ternak3 susu2 daging2 sawah1
+ kambing: ternak3 daging2
+ kuda: ternak2 kendaraan1 cepat1 balap1
+ babi: ternak3 daging2
+ tikus: kecil2 kotor2 hama2 rumah1
+ gajah: besar3 liar2 hutan2 belalai1
+ harimau: buas3 liar3 hutan2 kucing1
+ singa: buas3 liar3 raja1
+ monyet: liar2 hutan2 pohon2 pintar1
+ beruang: buas2 liar2 hutan2 besar2
+ kerbau: ternak3 sawah2 petani1
+ domba: ternak3 wol1
+ serigala: buas3 liar2 hutan2 anjing1
+ kucing: peliharaan3 rumah2 kecil1
+ anjing: peliharaan3 rumah2 setia1 jaga1

@ hewan3 makhluk2 burung3 terbang2
ayam, bebek, burung, elang, merpati, angsa, bangau, gagak, nuri, pinguin
+ ayam: ternak3 daging2 telur3
+ bebek: ternak3 telur2 air2 renang2
+ angsa: air2 renang2 putih1
+ elang: buas3 liar2 langit2 tajam1
+ merpati: peliharaan2 surat1 damai1
+ bangau: air2 sawah2
+ nuri: peliharaan2 warna2 bicara1
+ pinguin: dingin3 air2 renang2

@ hewan3 makhluk2 air3 laut2 renang2
ikan, hiu, paus, lumba-lumba, udang, kepiting, cumi, kerang, gurita, penyu
+ ikan: makanan2 protein2 nelayan2
+ hiu: buas3 besar2 tajam1
+ paus: besar3 mamalia1
+ lumba-lumba: pintar2 mamalia1 ramah1
+ udang: makanan3 kecil1
+ kepiting: makanan2 pantai2 capit1
+ cumi: makanan2 tinta1
+ kerang: makanan2 pantai2 cangkang1
+ gurita: tangan1 tinta1
+ penyu: pantai2 telur1 lambat1 reptil2

@ hewan3 makhluk2 reptil3 darat1
ular, buaya, kadal, cicak, komodo, kura-kura
+ ular: buas2 racun3 panjang2 takut2
+ buaya: buas3 air2 sungai2 tajam1
+ cicak: rumah2 kecil2 dinding2
+ kadal: kecil1 liar1
+ komodo: buas2 besar2 langka1
+ kura-kura: lambat3 peliharaan1 cangkang2

@ hewan3 makhluk2 serangga3 kecil3
semut, nyamuk, lalat, lebah, kupu-kupu, belalang, capung, laba-laba, kecoa, ulat, cacing
+ semut: manis1 gigit1 kerja1
+ nyamuk: gigit2 darah2 penyakit2 hama2
+ lalat: kotor3 hama2 penyakit1
+ lebah: madu3 sengat2 bunga2 kerja1
+ kupu-kupu: indah3 warna2 bunga2 terbang2
+ belalang: hijau1 sawah2 lompat2
+ capung: terbang2 air1
+ laba-laba: jaring3 takut1
+ kecoa: kotor3 hama2 dapur1 takut1
+ ulat: daun2 kecil2 kupu-kupu1
+ cacing: tanah3 kecil2 panjang1

@ hewan3 makhluk2 amfibi2 air2
katak
+ katak: lompat2 sawah2 hijau1


# ---------------------------------------------------------------------------
# TUMBUHAN
# ---------------------------------------------------------------------------

@ tumbuhan3 makhluk2 alam2 hijau1
pohon, bunga, daun, akar, batang, ranting, rumput, biji, duri, kaktus, bambu, lumut, benih
+ pohon: besar2 kayu3 hutan2 tinggi2 teduh2
+ bunga: indah3 wangi2 warna2 hadiah1
+ daun: hijau3 pohon2 tipis1
+ akar: tanah3 bawah2 pohon2
+ batang: pohon2 kayu2 panjang1
+ ranting: pohon2 kayu1 kecil1
+ rumput: tanah2 hijau3 halaman2 taman1
+ biji: kecil3 buah2 tanam2
+ benih: kecil2 tanam3 petani2
+ duri: tajam3 sakit1
+ kaktus: duri2 kering2 gurun2
+ bambu: tinggi2 kayu2 panjang2 kerajinan1
+ lumut: basah2 hijau3 batu1

@ tumbuhan2 bunga3 indah3 wangi2 warna2 taman2
mawar, melati, anggrek, tulip, kamboja
+ mawar: merah2 duri2 cinta2 hadiah2
+ melati: putih2 kecil1 adat1
+ anggrek: langka1 mahal1
+ tulip: mahal1
+ kamboja: putih1 adat1

@ makanan3 buah3 tumbuhan2 manis2 sehat2 segar2
kelapa, pisang, mangga, jeruk, apel, semangka, durian, rambutan, nanas, anggur, melon, pepaya, stroberi, alpukat, jambu, salak
+ kelapa: pohon2 pantai2 air2 minyak1 santan2
+ pisang: kuning2 murah1
+ jeruk: asam2 oranye2 vitamin2
+ semangka: besar2 merah2 air2
+ durian: bau3 mahal2 tajam1
+ nanas: asam2 kuning1 tajam1
+ anggur: kecil2 ungu1 mahal1
+ stroberi: merah2 asam1 kecil1
+ alpukat: hijau2 lembut1 jus1

@ makanan3 sayur3 tumbuhan2 sehat3 dapur2 hijau1
wortel, kentang, tomat, bayam, kangkung, kubis, terong, timun, jagung, cabai, bawang, sawi, brokoli, labu, buncis
+ wortel: oranye2 akar1 mata1
+ kentang: akar1 goreng2 karbohidrat2
+ tomat: merah2 asam1 bulat1
+ cabai: pedas3 merah2 bumbu3
+ bawang: bumbu3 bau2 tajam1
+ jagung: kuning2 karbohidrat2 rebus1
+ labu: besar1 oranye1 bulat1


# ---------------------------------------------------------------------------
# MAKANAN & MINUMAN
# ---------------------------------------------------------------------------

@ makanan3 dapur2 masak2
nasi, roti, mie, bakso, soto, sate, rendang, tempe, tahu, telur, daging, keju, mentega, sup, bubur, kue, biskuit, cokelat, permen, sambal, kecap, madu, bakmi, kerupuk, pempek, martabak
+ nasi: karbohidrat3 pokok3 putih2 padi2
+ roti: karbohidrat3 tepung2 gandum1 pagi1
+ mie: karbohidrat3 tepung2 panjang1
+ bakso: bulat2 daging2 kuah2 warung2
+ soto: kuah3 hangat2 warung2
+ sate: daging3 bakar2 tusuk2 warung2
+ rendang: daging3 pedas2 adat2 lama1
+ tempe: kedelai2 protein2 goreng2 murah2
+ tahu: kedelai2 protein2 putih2 lembut1 goreng2
+ telur: ayam3 protein3 bulat2 goreng1
+ daging: protein3 hewan2 mahal1 bakar1
+ keju: susu3 asin1 mahal1
+ mentega: susu2 minyak2 lembut1
+ sup: kuah3 hangat2 sayur2
+ bubur: lembut3 nasi2 pagi2 sakit1
+ kue: manis3 tepung2 pesta2 hadiah1
+ biskuit: manis2 kering2 camilan3
+ cokelat: manis3 camilan3 hadiah2 warna1
+ permen: manis3 kecil2 camilan3 anak2
+ sambal: pedas3 cabai3 bumbu3
+ kecap: manis2 hitam2 bumbu3
+ madu: manis3 lebah3 sehat2 obat1
+ kerupuk: kering2 camilan2 renyah2
+ pempek: ikan2 adat1
+ martabak: manis1 camilan2 malam1

@ makanan2 bumbu3 dapur3 rasa2
gula, garam, tepung, minyak, merica, kunyit, jahe, santan, cuka
+ gula: manis3 putih2
+ garam: asin3 putih2 laut1
+ tepung: putih2 roti2 kue2
+ minyak: goreng3 licin2 cair2
+ jahe: hangat2 obat2 minuman1
+ kunyit: kuning2 obat1
+ merica: pedas2 kecil1
+ santan: kelapa3 putih1 kental1

@ minuman3 cair3 gelas2
teh, kopi, jus, sirup, soda, susu, es
+ teh: hangat2 daun2 pahit1 pagi1
+ kopi: hangat2 pahit3 hitam2 pagi2 melek1
+ jus: buah3 segar2 sehat2 manis1
+ sirup: manis3 warna1
+ soda: manis2 dingin2 gas1
+ susu: putih3 sapi3 sehat2 anak2 protein2
+ es: dingin3 beku3 air3 segar2

@ benda2 dapur3 alat3 wadah2
piring, gelas, sendok, garpu, pisau, panci, wajan, mangkuk, teko, talenan, sedotan, botol, termos, ember
+ piring: bulat2 makan3 keramik1
+ gelas: minum3 kaca2 bulat1
+ sendok: makan3 logam2 kecil1
+ garpu: makan3 logam2 tajam2
+ pisau: tajam3 potong3 logam2 bahaya2
+ panci: masak3 logam2 rebus2
+ wajan: masak3 logam2 goreng3
+ mangkuk: kuah2 makan2 bulat2
+ teko: air2 tuang2
+ botol: air2 kaca1 plastik2 tinggi1
+ termos: panas2 air2 simpan1
+ ember: air3 plastik2 besar1 cuci2

@ benda2 dapur3 alat3 elektronik2 mesin2 listrik2
kompor, kulkas, oven, blender, magicom, mikrowave
+ kompor: api3 masak3 panas3
+ kulkas: dingin3 simpan3 makanan2
+ oven: panas3 kue2 bakar2
+ blender: jus2 halus2
+ magicom: nasi3 masak2
+ mikrowave: panas2 cepat1


# ---------------------------------------------------------------------------
# RUMAH & PERABOT
# ---------------------------------------------------------------------------

@ bangunan3 tempat3 rumah3
rumah, kamar, dapur, gudang, garasi, halaman, teras, atap, dinding, lantai, langit-langit, pondasi
+ rumah: keluarga3 tinggal3 aman2 pulang2
+ kamar: tidur3 pribadi2 kecil1
+ dapur: masak3 makanan2 api1
+ gudang: simpan3 barang2 kotor1
+ garasi: mobil3 simpan2
+ halaman: rumput2 luar2 taman2
+ teras: luar2 duduk2 depan1
+ atap: atas3 hujan2 lindung2 genteng2
+ dinding: tegak2 batu2 batas2
+ lantai: bawah3 injak2 keramik1
+ pondasi: bawah3 kuat2 batu1

@ benda3 rumah3 bagian2
pintu, jendela, tangga, pagar, gerbang, genteng, keramik, kunci, engsel
+ pintu: buka3 tutup3 masuk3 kayu2
+ jendela: kaca3 buka2 cahaya2 lihat2
+ tangga: naik3 turun3 atas2 kayu1
+ pagar: batas3 luar2 jaga2 besi2
+ gerbang: masuk3 besar2 batas2
+ kunci: aman3 buka2 tutup2 logam2 kecil1
+ keramik: lantai3 licin2 keras2

@ benda3 perabot3 rumah2
kursi, meja, lemari, kasur, bantal, guling, selimut, sofa, rak, cermin, karpet, tirai, jam, lampu, kipas, sapu, keset, gantungan
+ kursi: duduk3 kayu2 kaki1
+ meja: kayu2 datar2 kerja2 makan2
+ lemari: simpan3 pakaian3 kayu2 besar1
+ kasur: tidur3 lembut3 kamar2 empuk2
+ bantal: tidur3 lembut3 kepala2 empuk2
+ guling: tidur3 lembut2 panjang2
+ selimut: tidur3 hangat3 kain3 dingin1
+ sofa: duduk3 lembut2 tamu2
+ rak: simpan2 buku2 susun1
+ cermin: lihat3 wajah3 kaca3 pantul2
+ karpet: lantai3 kain2 lembut1
+ tirai: jendela3 kain2 tutup2 cahaya1
+ jam: waktu3 lihat2 bulat1 angka1
+ lampu: cahaya3 terang3 listrik3 malam2
+ kipas: angin3 dingin2 listrik2 panas1
+ sapu: bersih3 lantai2 kotor2
+ keset: kaki2 pintu2 bersih1

@ benda3 alat3 bersih3
sabun, sikat, deterjen, sampo, handuk, pel, tisu, kemoceng
+ sabun: cuci3 mandi3 wangi2 busa2
+ sikat: gosok3 gigi2 bersih2
+ sampo: rambut3 cuci2 mandi2 wangi2
+ handuk: kain3 kering3 mandi3 basah1
+ pel: lantai3 basah2
+ tisu: kertas3 tipis2 kering1


# ---------------------------------------------------------------------------
# ALAT & PERKAKAS
# ---------------------------------------------------------------------------

@ benda3 alat3 kerja2 logam1
palu, paku, gergaji, obeng, tang, sekop, cangkul, gunting, jarum, benang, lem, tali, kawat, bor, meteran, sabit
+ palu: pukul3 keras2 paku2
+ paku: tajam3 kecil2 logam3 palu2
+ gergaji: potong3 kayu3 tajam2
+ obeng: putar2 sekrup2
+ tang: jepit2 kawat1
+ sekop: gali3 tanah3
+ cangkul: gali3 tanah3 petani3 sawah2
+ sabit: potong2 rumput2 petani2 tajam2
+ gunting: potong3 tajam3 kertas2 kain1
+ jarum: tajam3 kecil3 jahit3 benang2
+ benang: jahit3 tipis2 panjang2 kain2
+ lem: rekat3 lengket2 kertas1
+ tali: panjang3 ikat3 kuat1
+ kawat: logam3 tipis2 panjang2 listrik1
+ bor: lubang3 listrik1


# ---------------------------------------------------------------------------
# ELEKTRONIK & TEKNOLOGI
# ---------------------------------------------------------------------------

@ benda3 elektronik3 listrik3 teknologi3 mesin2
televisi, radio, telepon, komputer, laptop, kamera, ponsel, kabel, baterai, layar, printer, speaker, charger, kalkulator
+ televisi: hiburan3 lihat3 film2 berita2 ruangtamu1
+ radio: dengar3 suara3 musik2 berita2
+ telepon: bicara3 komunikasi3 suara2 jauh2
+ ponsel: bicara2 komunikasi3 internet3 kecil2 saku2
+ komputer: kerja3 data3 internet2 program2
+ laptop: kerja3 komputer3 bawa2 tipis1
+ kamera: foto3 lihat2 gambar2 kenang1
+ kabel: panjang2 listrik3 sambung2
+ baterai: listrik3 simpan2 kecil2 habis1
+ layar: lihat3 gambar2 cahaya2
+ speaker: suara3 keras2 musik2
+ kalkulator: angka3 hitung3 kecil1

@ teknologi3 informasi3 digital3
internet, aplikasi, situs, data, pesan, email, akun, kode, program, robot, sinyal, jaringan, password, unduh
+ internet: jaringan3 informasi3 dunia2 cepat2
+ aplikasi: ponsel2 program3 pakai1
+ situs: internet3 halaman2 informasi2
+ data: informasi3 angka2 simpan2
+ pesan: komunikasi3 tulis2 kirim3 teman1
+ email: pesan3 kirim3 surat2 kerja1
+ akun: nama2 pribadi2 masuk2
+ kode: rahasia2 angka2 program2
+ program: komputer3 kode3 kerja1
+ robot: mesin3 pintar2 kerja2 masadepan1
+ sinyal: kirim2 lemah1 ponsel2
+ password: rahasia3 aman3 masuk2


# ---------------------------------------------------------------------------
# SEKOLAH & ALAT TULIS
# ---------------------------------------------------------------------------

@ benda3 alat2 tulis3 sekolah3 kertas1
buku, pensil, pena, kertas, penghapus, penggaris, spidol, krayon, tinta, map, amplop
+ buku: baca3 ilmu3 cerita2 halaman2
+ pensil: tulis3 kayu2 hitam1 hapus1
+ pena: tulis3 tinta3 hitam1
+ kertas: putih2 tipis3 tulis2
+ penghapus: hapus3 salah2 karet2
+ penggaris: lurus3 ukur3 panjang2
+ spidol: tulis3 warna2 tebal1 papan2
+ krayon: warna3 gambar3 anak2
+ tinta: hitam2 cair2 tulis3
+ amplop: surat3 kertas2 kirim2

@ sekolah3 ilmu3 belajar3 tempat1
kelas, pelajaran, ujian, nilai, perpustakaan, universitas, kampus, kurikulum, tugas, rapor, wisuda, beasiswa
+ kelas: ruangan3 murid3 guru3
+ ujian: nilai3 sulit2 tegang2 kertas1
+ nilai: angka3 ujian3 bagus1
+ perpustakaan: buku3 tenang2 baca3 tempat3
+ universitas: tinggi2 kampus3 mahasiswa3 tempat2
+ tugas: kerja3 kumpul1 sulit1
+ wisuda: selesai3 pesta2 bangga2
+ beasiswa: uang3 pintar2 bantuan2

@ ilmu3 pengetahuan3 abstrak2
matematika, fisika, kimia, biologi, sejarah, geografi, bahasa, seni, ekonomi, filsafat, sains
+ matematika: angka3 hitung3 sulit2 logika2
+ fisika: alam2 hitung2 gerak2
+ kimia: zat2 campur2 laboratorium1
+ biologi: makhluk3 hidup2 tubuh1
+ sejarah: waktu3 lama3 masa3 cerita2
+ geografi: bumi3 tempat2 peta2
+ bahasa: bicara3 kata3 komunikasi3
+ filsafat: pikiran3 abstrak3 sulit2


# ---------------------------------------------------------------------------
# PAKAIAN & AKSESORIS
# ---------------------------------------------------------------------------

@ benda2 pakaian3 kain3 pakai2
baju, kemeja, celana, rok, jaket, kaos, sweter, sarung, jilbab, batik, seragam, piyama, dasi, sabuk, syal
+ kemeja: formal3 kerja2 kancing1
+ celana: kaki3 bawah2
+ rok: wanita3 bawah2
+ jaket: hangat3 dingin2 luar2
+ kaos: santai3 murah1
+ sweter: hangat3 dingin2 wol1
+ sarung: adat2 ibadah2 kaki1
+ jilbab: kepala3 wanita3 agama2
+ batik: adat3 formal2 indah2 warna1
+ seragam: sekolah3 sama2 kerja1
+ piyama: tidur3 santai2
+ dasi: leher3 formal3 kerja2
+ sabuk: pinggang3 celana2 kulit1
+ syal: leher3 hangat2 dingin1

@ benda2 pakaian2 aksesoris3 pakai2
topi, sepatu, sandal, kaus-kaki, sarung-tangan, kacamata, dompet, payung, tas, ransel, jam-tangan, masker
+ topi: kepala3 lindung2 matahari2
+ sepatu: kaki3 alaskaki3 jalan2 kulit1
+ sandal: kaki3 alaskaki3 santai2 murah1
+ kaus-kaki: kaki3 alaskaki2 hangat1
+ sarung-tangan: tangan3 hangat1 lindung2
+ kacamata: mata3 lihat3 kaca2 wajah2
+ dompet: uang3 simpan3 saku2 kulit1
+ payung: hujan3 lindung3 basah1 buka1
+ tas: simpan3 bawa3 sekolah1
+ ransel: punggung2 bawa3 sekolah2
+ jam-tangan: waktu3 tangan2 lihat1
+ masker: wajah3 mulut2 penyakit2 lindung2

@ benda2 perhiasan3 indah2 mahal2 emas1 pakai2
cincin, kalung, gelang, anting, bros, mahkota
+ cincin: jari3 nikah2 bulat1
+ kalung: leher3 indah2
+ gelang: tangan3 bulat1
+ anting: telinga3 kecil1
+ mahkota: kepala3 raja3 emas2


# ---------------------------------------------------------------------------
# TUBUH MANUSIA
# ---------------------------------------------------------------------------

@ tubuh3 manusia3 badan2
kepala, leher, bahu, dada, perut, punggung, pinggang, tangan, kaki, jari, kuku, siku, lutut, tumit, kulit, telapak, paha, betis
+ kepala: atas3 otak2 pikir2 wajah2
+ leher: kepala2 panjang1
+ tangan: pegang3 kerja2 jari2 lima1
+ kaki: jalan3 bawah2 lari2 sepatu2
+ jari: tangan3 kecil2 lima1 sentuh2
+ kuku: jari3 keras2 potong1
+ lutut: kaki3 tekuk2
+ kulit: luar3 halus1 warna2 lindung1
+ telapak: tangan2 kaki2 datar1
+ betis: kaki3 otot1

@ tubuh3 manusia3 wajah3 kepala3
mata, hidung, telinga, mulut, gigi, lidah, bibir, pipi, dagu, alis, kening, rambut, kumis, jenggot
+ mata: lihat3 cahaya2 bulat1 dua1
+ hidung: cium3 bau3 napas3
+ telinga: dengar3 suara3 dua1
+ mulut: makan3 bicara3 gigi2
+ gigi: putih2 keras3 makan2 gigit3 sikat2
+ lidah: rasa3 mulut3 bicara1
+ bibir: mulut3 merah1 cium1
+ alis: mata3 rambut2
+ rambut: kepala3 hitam2 panjang2 sisir2 potong1
+ kumis: mulut2 rambut2 pria2
+ jenggot: dagu2 rambut2 pria2

@ tubuh3 manusia3 organ3 dalam3
jantung, paru-paru, hati, ginjal, otak, lambung, usus, darah, tulang, otot, saraf, nadi
+ jantung: darah3 detak3 hidup2 cinta1
+ paru-paru: napas3 udara3
+ hati: organ3 emosi2 perasaan2
+ otak: pikir3 kepala3 pintar3 ingat2
+ lambung: makan2 perut3 asam1
+ darah: merah3 cair2 hidup2 luka2
+ tulang: keras3 putih2 kuat2 rangka2
+ otot: kuat3 gerak2 daging1
+ nadi: darah3 detak2


# ---------------------------------------------------------------------------
# ORANG, KELUARGA, SOSIAL
# ---------------------------------------------------------------------------

@ manusia3 orang3 keluarga3 sosial2
ayah, ibu, anak, kakak, adik, kakek, nenek, paman, bibi, sepupu, cucu, suami, istri, saudara, keponakan, menantu, mertua, keluarga
+ ayah: pria3 tua2 kepalakeluarga2 sayang2
+ ibu: wanita3 tua2 sayang3 masak2 lembut2
+ anak: kecil3 muda3 main2 sayang2
+ kakak: tua1 saudara3
+ adik: muda2 kecil2 saudara3
+ kakek: tua3 pria2 rambutputih1
+ nenek: tua3 wanita2 sayang1
+ suami: pria3 nikah3 rumah1
+ istri: wanita3 nikah3 rumah1
+ keluarga: rumah3 sayang3 bersama3

@ manusia3 orang3 sosial2
teman, sahabat, tetangga, tamu, bayi, remaja, dewasa, pria, wanita, orang, penduduk, warga, rakyat, musuh, kekasih, pacar
+ teman: dekat3 main2 bicara2 sayang1
+ sahabat: dekat3 setia3 percaya2
+ tetangga: rumah3 dekat2
+ tamu: datang3 rumah2 hormat1
+ bayi: kecil3 muda3 lembut2 menangis2 susu2
+ remaja: muda3 sekolah2
+ pria: laki2 kuat1
+ wanita: perempuan2 lembut1 indah1
+ musuh: benci3 perang2 lawan3
+ kekasih: cinta3 sayang3 dekat2
+ pacar: cinta3 sayang2 dekat2

@ manusia3 profesi3 kerja3 orang2
dokter, perawat, guru, polisi, tentara, petani, nelayan, pedagang, pilot, sopir, koki, tukang, seniman, penyanyi, pelukis, penulis, wartawan, hakim, pengacara, insinyur, arsitek, ilmuwan, montir, satpam, pelayan, pengusaha, presiden, menteri, raja, ratu, murid, mahasiswa, pegawai, buruh, direktur, bidan, apoteker, masinis, nahkoda, pemadam
+ dokter: kesehatan3 obat3 sakit3 pintar2 rumahsakit2
+ perawat: kesehatan3 rawat3 sakit2 rumahsakit2
+ bidan: kesehatan3 bayi3 lahir2
+ guru: sekolah3 ilmu3 ajar3 murid3 sabar1
+ polisi: hukum3 aman3 jaga3 seragam2
+ tentara: perang3 senjata2 jaga2 seragam2 negara2
+ petani: sawah3 tanam3 desa2 cangkul2
+ nelayan: laut3 ikan3 perahu3 pantai1
+ pedagang: jual3 uang3 pasar3
+ pilot: pesawat3 langit2 terbang2
+ sopir: mobil3 jalan2 kendaraan3
+ koki: masak3 dapur3 makanan3 restoran2
+ tukang: bangun2 perbaiki3 alat2
+ seniman: seni3 indah2 bebas1
+ penyanyi: lagu3 suara3 musik3 panggung2
+ pelukis: lukisan3 warna2 seni3
+ penulis: buku3 tulis3 cerita2
+ wartawan: berita3 tulis2 tanya2
+ hakim: hukum3 adil3 pengadilan3
+ pengacara: hukum3 bicara2 pengadilan2
+ insinyur: bangun2 mesin2 hitung1
+ arsitek: bangun3 gedung3 gambar2
+ ilmuwan: ilmu3 pintar3 teliti2
+ montir: mesin3 mobil2 perbaiki3
+ satpam: jaga3 aman3 malam1
+ pelayan: restoran3 layan3
+ pengusaha: uang3 bisnis3 kerja2
+ presiden: negara3 pemerintah3 pemimpin3
+ menteri: negara3 pemerintah3
+ raja: pemimpin3 mahkota2 istana2 kuno1
+ ratu: pemimpin2 mahkota2 wanita2 istana2
+ murid: sekolah3 belajar3 muda2
+ mahasiswa: kampus3 belajar3 muda2
+ buruh: kerja3 pabrik3 gaji2 lelah1
+ pemadam: api3 bahaya2 tolong2


# ---------------------------------------------------------------------------
# TEMPAT & BANGUNAN
# ---------------------------------------------------------------------------

@ tempat3 kota2 bangunan3 gedung2
kantor, pasar, toko, warung, restoran, hotel, museum, bioskop, mal, bank, apotek, pabrik, penjara, kafe, salon, bengkel, klinik, rumahsakit, sekolah, istana
+ kantor: kerja3 pegawai2 meja2 formal1
+ pasar: jual3 beli3 ramai3 pedagang3 sayur1
+ toko: jual3 beli3 barang2
+ warung: jual2 makan3 kecil2 murah2
+ restoran: makan3 makanan3 koki2 mahal1
+ hotel: tidur3 tamu2 kamar3 wisata2
+ museum: sejarah3 lihat2 kuno2 wisata2
+ bioskop: film3 gelap2 hiburan3
+ mal: belanja3 besar2 ramai2 toko3
+ bank: uang3 simpan3 aman2
+ apotek: obat3 kesehatan2 jual1
+ pabrik: mesin3 buruh3 produksi2 besar1
+ penjara: hukum3 tutup3 jahat2 gelap1
+ kafe: kopi3 duduk2 santai2
+ bengkel: perbaiki3 mesin3 mobil2
+ klinik: kesehatan3 dokter3 obat1
+ rumahsakit: kesehatan3 dokter3 sakit3 obat2
+ sekolah: belajar3 murid3 guru3 ilmu2
+ istana: raja3 besar2 mewah2

@ tempat3 kota2 transportasi2
bandara, stasiun, terminal, pelabuhan, jembatan, jalan, gang, trotoar, halte, perempatan
+ bandara: pesawat3 terbang2 pergi2
+ stasiun: kereta3 pergi2 tunggu1
+ terminal: bus3 pergi2 tunggu1
+ pelabuhan: kapal3 laut3 pergi1
+ jembatan: sungai3 lewat3 panjang2
+ jalan: lewat3 panjang2 mobil2 aspal2
+ trotoar: jalan3 kaki2
+ halte: bus2 tunggu2

@ tempat3 ibadah3 agama3 bangunan2 tenang2
masjid, gereja, pura, vihara, kuil
+ masjid: islam3 doa3
+ gereja: kristen3 doa3
+ pura: hindu3 bali2
+ vihara: buddha3

@ tempat3 alam3 luar2
taman, kebun, sawah, ladang, pantai, gunung, bukit, lembah, sungai, danau, laut, hutan, gua, pulau, gurun, rawa, air-terjun, kolam
+ taman: bunga3 rumput2 santai2 kota2 anak1
+ kebun: tanam3 tumbuhan3 petani2
+ sawah: padi3 petani3 hijau2 desa2 air1
+ ladang: tanam3 petani2 kering1
+ pantai: laut3 pasir3 wisata2 panas1
+ gunung: tinggi3 besar2 batu2 dingin2 hijau1
+ bukit: tinggi2 kecil1
+ sungai: air3 panjang2 mengalir3 ikan1
+ danau: air3 luas2 tenang2
+ laut: air3 luas3 asin3 ikan2 biru2 kapal2
+ hutan: pohon3 hijau3 liar2 luas2 gelap1
+ gua: gelap3 batu3 dalam2
+ pulau: laut3 tanah2 kecil1
+ gurun: pasir3 kering3 panas3 luas2
+ kolam: air3 renang2 ikan2 kecil1
+ air-terjun: air3 tinggi2 wisata2

@ tempat3 wilayah3
kota, desa, negara, provinsi, kampung, benua, dunia, kelurahan, ibukota, daerah
+ kota: ramai3 gedung3 sibuk2 besar2
+ desa: tenang3 sawah2 hijau2 sederhana2
+ negara: pemerintah3 rakyat3 luas2 bendera1
+ kampung: desa3 tenang2 sederhana2
+ dunia: bumi3 luas3 semua2

@ olahraga3 tempat2 bangunan2
stadion, lapangan, gym
+ stadion: besar3 ramai2 bola2
+ lapangan: luas2 rumput2 main2


# ---------------------------------------------------------------------------
# KENDARAAN
# ---------------------------------------------------------------------------

@ benda2 kendaraan3 transportasi3 jalan2 mesin2
mobil, motor, bus, truk, taksi, ambulans, becak, bajaj, angkot, traktor
+ mobil: roda3 keluarga1 mahal1
+ motor: roda2 cepat2 murah1 bensin2
+ bus: besar3 banyak2 penumpang2
+ truk: besar3 barang3 berat2
+ taksi: bayar2 penumpang2
+ ambulans: sakit3 cepat2 rumahsakit2 darurat2
+ becak: pelan3 kayuh2 tradisional2
+ traktor: sawah3 petani2 berat1

@ benda2 kendaraan3 transportasi3
sepeda, kereta, kapal, perahu, pesawat, helikopter, rakit
+ sepeda: kayuh3 roda3 sehat2 murah2 pelan1
+ kereta: rel3 panjang3 stasiun3 cepat1
+ kapal: laut3 air3 besar2 pelabuhan2
+ perahu: air3 kecil2 nelayan2 dayung2
+ pesawat: terbang3 langit3 cepat3 bandara2 mahal1
+ helikopter: terbang3 langit2 baling1

@ benda3 kendaraan2 bagian3 mesin2
roda, ban, setir, rem, bensin, knalpot, klakson, spion, pedal
+ roda: bulat3 putar3 jalan2
+ ban: roda3 karet3 hitam1
+ setir: putar2 arah2 tangan1
+ rem: berhenti3 aman2
+ bensin: bahanbakar3 cair2 bau2 mahal1
+ klakson: suara3 keras2


# ---------------------------------------------------------------------------
# ALAM, CUACA, LANGIT
# ---------------------------------------------------------------------------

@ alam3 langit3 cuaca2 atas2
awan, hujan, angin, petir, badai, salju, kabut, pelangi, matahari, bulan, bintang, planet, langit, halilintar, mendung
+ awan: putih2 langit3 hujan2 tinggi1
+ hujan: air3 basah3 dingin2 turun2 payung2
+ angin: udara3 dingin2 gerak2 sejuk2
+ petir: cahaya3 suara3 keras3 takut2 hujan2
+ badai: angin3 hujan3 bahaya2 kuat2
+ salju: dingin3 putih3 beku3 musim1
+ kabut: putih2 tebal2 pagi2 gunung1
+ pelangi: warna3 indah3 hujan2
+ matahari: panas3 cahaya3 terang3 siang3 bulat1
+ bulan: malam3 cahaya2 bulat2 putih1
+ bintang: malam3 cahaya2 kecil2 banyak1 langit3
+ langit: atas3 biru2 luas3
+ mendung: awan3 gelap2 hujan2

@ alam3 zat3 bumi2
api, air, tanah, batu, pasir, lumpur, debu, asap, embun, udara, lava, kristal
+ api: panas3 merah2 bakar3 cahaya2 bahaya2
+ air: cair3 basah3 minum3 bening2 hidup2
+ tanah: cokelat2 tanam3 kotor1 bawah2
+ batu: keras3 berat2 kelabu1
+ pasir: kecil2 pantai3 halus2 kering1
+ lumpur: kotor3 basah3 tanah3
+ debu: kotor3 kecil3 kering2
+ asap: kelabu2 api3 udara2 bau1
+ embun: air2 pagi3 dingin1 daun1
+ udara: napas3 bening2 angin2

@ alam3 bencana3 bahaya3 rusak2
banjir, gempa, tsunami, longsor, kebakaran, kekeringan, wabah
+ banjir: air3 hujan3 rumah1
+ gempa: tanah3 goyang3 rusak2
+ tsunami: laut3 air3 besar2
+ kebakaran: api3 panas2 rusak2
+ wabah: penyakit3 banyak2 takut1

@ waktu3 alam2
siang, malam, pagi, sore, senja, fajar, subuh, musim
+ siang: matahari3 terang3 panas2
+ malam: gelap3 bulan2 tidur2 sepi2
+ pagi: matahari2 bangun3 segar2 sarapan1
+ sore: senja1 pulang2 sejuk1
+ senja: sore3 oranye2 indah2
+ fajar: pagi3 cahaya2
+ subuh: pagi3 gelap1 doa1
+ musim: waktu3 cuaca3 tahun1

@ waktu3 abstrak2
jam, menit, detik, hari, minggu, bulan, tahun, abad, kemarin, besok, sekarang, nanti, dulu, masa, umur, tanggal, kalender, jadwal, zaman, momen
+ menit: pendek2 hitung1
+ detik: pendek3 cepat2
+ hari: matahari1 satu1
+ tahun: panjang2 lama2
+ abad: lama3 panjang3 sejarah2
+ kemarin: lalu3 lewat2
+ besok: depan3 nanti3 harapan1
+ sekarang: kini3 ini2
+ dulu: lalu3 lama2 kenang2
+ umur: tua2 muda2 hidup2 angka1
+ kalender: tanggal3 kertas1 lihat1
+ jadwal: rencana3 waktu3 kerja1
+ zaman: lama2 sejarah2 masa3


# ---------------------------------------------------------------------------
# WARNA
# ---------------------------------------------------------------------------

@ warna3 lihat2 sifat2
merah, biru, hijau, kuning, hitam, putih, ungu, jingga, abu-abu, emas, perak, cokelat, merah-muda, bening
+ merah: darah1 api1 berani1 marah1
+ biru: langit2 laut2 tenang1 dingin1
+ hijau: daun2 alam2 tumbuhan2 segar1
+ kuning: matahari2 terang2 cerah1
+ hitam: gelap3 malam2
+ putih: terang2 bersih3 suci2
+ emas: mahal3 perhiasan3 kaya2
+ perak: mahal2 perhiasan2 logam2
+ cokelat: tanah2 kayu2
+ bening: kaca2 air2 jernih2


# ---------------------------------------------------------------------------
# EMOSI & PERASAAN
# ---------------------------------------------------------------------------

@ emosi3 perasaan3 abstrak2 hati2
senang, sedih, marah, takut, cemas, kecewa, bangga, malu, bosan, rindu, cinta, benci, sayang, kaget, tenang, gugup, bahagia, kesal, iri, syukur, semangat, kesepian, lega, kagum, curiga
+ senang: baik3 tawa2 tersenyum2 bahagia3
+ sedih: buruk2 menangis3 sepi2
+ marah: buruk2 panas2 keras2 merah1
+ takut: buruk2 bahaya3 gemetar2 gelap1
+ cemas: takut3 pikir2 gelisah2
+ kecewa: sedih3 harapan2 gagal2
+ bangga: senang2 baik2 diri2
+ malu: wajah2 merah1 diam1
+ bosan: lelah1 lama2 sepi1
+ rindu: sayang3 jauh3 kenang2
+ cinta: sayang3 hati3 senang2 pasangan2
+ benci: buruk3 musuh2 marah2
+ sayang: cinta3 lembut2 keluarga2
+ kaget: cepat2 tiba2 mata1
+ tenang: damai3 sepi2 lembut2
+ bahagia: senang3 baik3 tawa2
+ iri: benci2 ingin2 buruk1
+ syukur: senang2 baik2 doa2
+ semangat: kuat3 kerja2 senang2
+ kesepian: sedih3 sendiri3 sepi3
+ lega: tenang3 selesai2 senang1
+ kagum: senang2 hormat2 indah1


# ---------------------------------------------------------------------------
# SIFAT
# ---------------------------------------------------------------------------

@ sifat3 orang2 watak3
baik, jahat, ramah, sombong, rajin, malas, pintar, bodoh, sabar, tegas, jujur, bohong, berani, pengecut, setia, dermawan, pelit, licik, lucu, serius, sopan
+ baik: benar2 tolong2 senang1
+ jahat: buruk3 musuh2 benci1
+ ramah: baik3 senyum2 teman2
+ sombong: buruk2 tinggi1 diri2
+ rajin: kerja3 baik2 belajar2
+ malas: buruk2 tidur2 diam2
+ pintar: otak3 ilmu3 baik2 belajar2
+ bodoh: otak2 buruk2 salah2
+ sabar: tenang3 lama2 baik2
+ jujur: benar3 baik3 percaya2
+ bohong: salah3 buruk2 percaya1
+ berani: kuat3 baik2 takut1
+ setia: percaya3 cinta2 baik2
+ dermawan: beri3 uang1 baik3
+ pelit: uang2 buruk2
+ lucu: tawa3 senang3 cerita1
+ sopan: hormat3 baik2 adat1

@ sifat3 ukuran3 fisik2
besar, kecil, panjang, pendek, tinggi, rendah, tebal, tipis, luas, sempit, dalam, dangkal, lebar
+ besar: banyak1 luas2
+ kecil: sedikit1 sempit1
+ tinggi: atas3 gunung1
+ rendah: bawah3
+ luas: besar3 lapang2
+ sempit: kecil3 sesak2

@ sifat3 fisik3
berat, ringan, cepat, lambat, keras, lembut, kasar, halus, basah, kering, bersih, kotor, penuh, kosong, tajam, tumpul, terang, gelap, panas, dingin, kuat, lemah, baru, lama, licin, lengket, keriting, lurus
+ berat: besar1 sulit1
+ ringan: kecil1 mudah1
+ cepat: waktu2 lari1
+ lambat: waktu2 pelan3
+ keras: kuat2 batu2
+ lembut: halus3 kasur1 bayi1
+ kasar: keras2 buruk1
+ halus: lembut3 licin2
+ basah: air3 hujan2
+ kering: air1 panas2 matahari1
+ bersih: putih2 baik2 sabun2
+ kotor: debu3 buruk2 lumpur2
+ tajam: pisau3 potong2 bahaya1
+ terang: cahaya3 lampu2 matahari2
+ gelap: hitam3 malam2 takut1
+ panas: api2 matahari3 suhu3 keringat2 siang1
+ dingin: es3 salju2 suhu3 sejuk3 malam1
+ lama: waktu3 tua2 dulu2
+ kuat: otot2 besar1 berani1
+ lemah: sakit2 kecil1

@ sifat3 nilai2 abstrak2
mahal, murah, banyak, sedikit, mudah, sulit, penting, sia-sia, aman, bahaya, benar, salah, indah, jelek, sehat, sakit, bebas, terbatas
+ mahal: uang3 sulit1
+ murah: uang3 mudah1
+ mudah: ringan2 cepat1
+ sulit: berat2 pikir2
+ aman: tenang2 lindung2 baik2
+ bahaya: takut3 buruk2 luka1
+ indah: bunga1 seni2 senang2 cantik3
+ sehat: tubuh3 kuat2 baik3 olahraga2
+ sakit: tubuh3 buruk2 obat3 dokter2
+ bebas: merdeka3 luas1

@ rasa3 lidah3 makanan2 sifat2
manis, asin, pahit, asam, pedas, gurih, hambar, wangi, bau, segar
+ manis: gula3 senang1
+ asin: garam3 laut1
+ pahit: kopi2 obat2 buruk1
+ asam: jeruk2 cuka2
+ pedas: cabai3 panas2 sambal2
+ wangi: hidung3 bunga2 sabun2 baik2
+ bau: hidung3 buruk3 kotor2
+ segar: air2 pagi2 sehat2 dingin1 buah1


# ---------------------------------------------------------------------------
# AKTIVITAS
# ---------------------------------------------------------------------------

@ aktivitas3 gerak2 tubuh2
makan, minum, tidur, bangun, mandi, berjalan, lari, duduk, berdiri, lompat, terbang, berenang, menari, jongkok, merangkak, bernapas, berbaring
+ makan: makanan3 mulut3 nasi1 lapar2
+ minum: minuman3 mulut2 air2 haus2
+ tidur: kasur3 malam3 kamar2 lelah2 mimpi2
+ bangun: pagi3 tidur2 mata1
+ mandi: air3 sabun3 bersih3 kamarmandi2
+ lari: cepat3 kaki3 olahraga3
+ duduk: kursi3 diam2
+ berdiri: kaki2 tegak2
+ lompat: kaki2 atas2 cepat1
+ berenang: air3 kolam2 olahraga3 laut1
+ menari: musik3 gerak3 seni3 indah1
+ berjalan: kaki3 pelan2 jalan2
+ terbang: langit3 burung3 pesawat2 atas2

@ aktivitas3 kerja2
bekerja, belajar, membaca, menulis, menggambar, memasak, mencuci, menyapu, membangun, memperbaiki, menjahit, berkebun, menanam, memancing, berburu
+ bekerja: kantor2 uang3 lelah1
+ belajar: ilmu3 buku3 sekolah3 murid2
+ membaca: buku3 mata2 ilmu2
+ menulis: pena3 kertas3 buku2
+ menggambar: pensil3 kertas2 seni3 warna2
+ memasak: dapur3 makanan3 api2 koki2
+ mencuci: air3 sabun3 bersih3 pakaian2
+ menyapu: sapu3 lantai2 bersih3
+ membangun: rumah3 bangunan3 tukang2
+ memperbaiki: rusak3 alat2 tukang2
+ menjahit: jarum3 benang3 kain3
+ menanam: benih3 tanah3 tumbuhan3 petani2
+ memancing: ikan3 air2 tunggu2 santai1
+ berburu: hewan3 hutan2 senjata1

@ aktivitas3 tangan2
membeli, menjual, memberi, mengambil, membuka, menutup, mendorong, menarik, melempar, menangkap, memukul, memotong, mengikat, menggenggam, menekan
+ membeli: uang3 pasar2 toko2
+ menjual: uang3 pasar2 pedagang2
+ memberi: hadiah2 baik2 tangan1
+ membuka: pintu3 kunci1
+ menutup: pintu3 kunci1
+ memotong: pisau3 gunting2 tajam2
+ mengikat: tali3 kuat1

@ aktivitas3 indera3 kepala2
berbicara, mendengar, melihat, mencium, menyentuh, berteriak, berbisik, menatap
+ berbicara: mulut3 suara3 bahasa3 komunikasi3
+ mendengar: telinga3 suara3
+ melihat: mata3 cahaya2
+ mencium: hidung3 bau3
+ menyentuh: tangan3 kulit2
+ berteriak: suara3 keras3 mulut2
+ berbisik: suara2 pelan3 rahasia2

@ aktivitas3 pikiran3 abstrak2
berpikir, mengingat, lupa, mengerti, ragu, memilih, berharap, bermimpi, memutuskan
+ berpikir: otak3 pikiran3 diam1
+ mengingat: otak3 masa2 kenang3
+ lupa: otak2 hilang2 masa1
+ berharap: harapan3 masadepan2 doa1
+ bermimpi: tidur3 malam2 harapan2

@ aktivitas3 emosi2 wajah2
tertawa, menangis, tersenyum, mengeluh, memaafkan, memuji
+ tertawa: senang3 suara2 lucu3 mulut2
+ menangis: sedih3 air2 mata3
+ tersenyum: senang3 ramah3 mulut2 bibir1
+ memaafkan: baik3 salah2 hati2

@ aktivitas3 gerak3 tempat2
datang, pergi, pulang, masuk, keluar, naik, turun, berhenti, mulai, selesai, menunggu, mencari, menemukan, kehilangan, mengejar, kembali
+ pulang: rumah3 sore1 lelah1
+ masuk: pintu2 dalam2
+ keluar: pintu2 luar2
+ menunggu: waktu3 sabar2 diam1
+ mencari: hilang2 mata1
+ menemukan: cari2 senang1
+ kehilangan: sedih2 hilang3

@ aktivitas3 sosial3 orang2
bermain, berkumpul, menolong, bertengkar, berjanji, mengundang, merayakan, berkenalan
+ bermain: senang3 anak3 mainan2 teman2
+ berkumpul: teman3 keluarga2 ramai2
+ menolong: baik3 teman2 tangan1
+ bertengkar: marah3 musuh2 suara2
+ merayakan: pesta3 senang3 hadiah1


# ---------------------------------------------------------------------------
# OLAHRAGA, SENI, HIBURAN
# ---------------------------------------------------------------------------

@ olahraga3 aktivitas2 gerak3 sehat2 permainan2
bola, basket, badminton, voli, catur, renang, tinju, silat, karate, senam, sepakbola, tenis
+ bola: bulat3 tendang2 lapangan2
+ sepakbola: bola3 lapangan3 tim2 ramai2
+ catur: pikir3 papan2 diam2 pintar2
+ tinju: pukul3 tangan2 keras2
+ silat: adat2 tangan2 bela2
+ senam: gerak3 sehat3 pagi1

@ hiburan3 seni3 permainan2
mainan, boneka, layang-layang, gitar, piano, drum, biola, seruling, musik, lagu, tarian, film, teater, lukisan, patung, foto, novel, cerita, puisi, komik, kartun, konser
+ mainan: anak3 main3 kecil1
+ boneka: anak3 lembut2 mainan3 lucu1
+ layang-layang: angin3 langit2 anak2 tali2
+ gitar: musik3 senar2 suara2 kayu1
+ piano: musik3 suara2 tuts1 besar1
+ drum: musik3 pukul3 keras2 suara2
+ biola: musik3 senar2 suara2 halus1
+ seruling: musik3 tiup2 suara2 bambu1
+ musik: suara3 lagu3 indah2 dengar3
+ lagu: musik3 suara3 penyanyi3 kata1
+ film: lihat3 cerita3 bioskop3 hiburan3
+ lukisan: seni3 warna3 indah2 dinding1
+ patung: seni3 batu2 diam2
+ foto: kamera3 gambar3 kenang2
+ novel: buku3 cerita3 panjang2
+ cerita: kata3 buku2 anak1 lucu1
+ puisi: kata3 indah3 seni2 perasaan2
+ komik: buku2 gambar3 lucu2 anak2
+ konser: musik3 ramai3 penyanyi2


# ---------------------------------------------------------------------------
# UANG, EKONOMI, SOSIAL, ABSTRAK
# ---------------------------------------------------------------------------

@ uang3 ekonomi3 abstrak2
harga, gaji, untung, rugi, utang, pajak, bisnis, dagang, modal, tabungan, hadiah, kaya, miskin, belanja
+ harga: beli3 jual2 angka2
+ gaji: kerja3 bulan1 pegawai2
+ untung: senang2 lebih2
+ rugi: sedih2 kurang2
+ utang: pinjam3 beban2
+ pajak: negara3 bayar3 pemerintah2
+ bisnis: kerja3 pengusaha3 untung2
+ modal: awal2 bisnis2
+ tabungan: simpan3 bank3 masadepan2
+ kaya: uang3 mahal2 banyak2
+ miskin: uang1 sedikit2 sulit2
+ hadiah: memberi3 senang3 pesta2 ulangtahun2 kejutan2

@ benda3 uang3
uang, koin, kartu, cek
+ uang: kertas2 beli3 dompet2 bank2
+ koin: uang3 logam3 bulat3 kecil2

@ abstrak3 pikiran3
mimpi, harapan, ide, rencana, masalah, jawaban, pertanyaan, rahasia, kebenaran, keadilan, kebebasan, kemerdekaan, tujuan, arti, alasan, cara, kesempatan, keberuntungan, takdir, kenangan
+ mimpi: tidur3 malam2 harapan2
+ harapan: masadepan3 baik2 doa2
+ ide: otak3 baru2 pikir3
+ rencana: masadepan2 jadwal2 pikir2
+ masalah: sulit3 pikir2 buruk2
+ jawaban: pertanyaan3 benar2 ujian1
+ pertanyaan: jawaban3 tanya3 bingung1
+ rahasia: tutup3 diam2 pribadi3
+ kebenaran: benar3 jujur2
+ keadilan: adil3 hukum3 hakim2
+ kebebasan: bebas3 luas1
+ kemerdekaan: bebas3 negara3 perang1 merah1
+ kenangan: masa3 ingat3 dulu2

@ abstrak3 sosial3 negara2
pemerintah, hukum, aturan, hak, kewajiban, pemilu, demokrasi, politik, perang, damai, budaya, adat, tradisi, upacara, bendera
+ pemerintah: negara3 presiden2 aturan3
+ hukum: aturan3 hakim3 adil2 penjara1
+ aturan: hukum2 harus2 sekolah1
+ pemilu: suara3 politik3 rakyat2
+ perang: tentara3 senjata3 buruk3 mati2
+ damai: tenang3 baik3 perang1
+ budaya: adat3 tradisi3 seni2 daerah2
+ adat: tradisi3 lama2 daerah2
+ upacara: bendera2 adat2 sekolah1 hormat2
+ bendera: negara3 warna2 kain2 merah1

@ agama3 abstrak2 ibadah2
doa, iman, surga, neraka, jiwa, nyawa, dosa, pahala, puasa, zakat, tuhan, malaikat, kitab
+ doa: tuhan3 harap2 tenang2 ibadah3
+ surga: baik3 indah3 mati2 harapan1
+ neraka: buruk3 api3 mati2 takut1
+ jiwa: hidup3 tubuh1 abstrak3
+ puasa: lapar2 ibadah3 sabar2
+ tuhan: agama3 doa3 pencipta2

@ abstrak3 hidup3
hidup, mati, lahir, nikah, pesta, ulangtahun, kematian, kesehatan
+ hidup: napas3 tubuh1 waktu2
+ mati: hilang3 sedih2 akhir3
+ lahir: bayi3 awal3 ibu2
+ nikah: cinta3 pasangan3 pesta2 cincin2
+ pesta: senang3 ramai3 makanan2 musik2
+ ulangtahun: pesta3 kue3 hadiah3 umur2

@ kesehatan3 sakit3 tubuh2
obat, vitamin, suntik, demam, batuk, pilek, luka, penyakit, virus, operasi, sembuh, alergi, pusing, mual
+ obat: sakit3 dokter2 pahit2 apotek2
+ vitamin: sehat3 buah1
+ suntik: jarum3 sakit2 dokter2 takut1
+ demam: panas3 sakit3 tubuh2
+ batuk: sakit2 suara2 tenggorokan1
+ luka: sakit3 darah3 kulit2
+ penyakit: sakit3 buruk2 obat2
+ virus: penyakit3 kecil3 wabah2
+ sembuh: sehat3 senang2 obat1
+ pusing: kepala3 sakit2

@ abstrak3 komunikasi3 informasi3
berita, informasi, kata, kalimat, huruf, angka, nama, judul, iklan, gosip, pidato, surat, tanda, simbol, peta, daftar
+ berita: informasi3 wartawan2 televisi2 baru2
+ kata: bahasa3 huruf2 bicara2
+ huruf: kata3 tulis2 kecil2
+ angka: hitung3 matematika3 nomor2
+ nama: orang3 kata2 panggil2
+ surat: kertas3 tulis3 kirim3 amplop2
+ peta: tempat3 jalan2 kertas1 arah2

@ abstrak3 jumlah3 ukuran2
ukuran, jumlah, setengah, bagian, sisa, batas, kecepatan, suhu, jarak
+ jumlah: angka3 hitung3 banyak2
+ suhu: panas3 dingin3 ukur2
+ jarak: jauh3 dekat3 ukur2
+ kecepatan: cepat3 lambat2 ukur2

@ benda3 senjata3 bahaya3
pedang, pistol, panah, tombak, bom, perisai, meriam
+ pedang: tajam3 logam3 potong2 kuno1
+ pistol: tembak3 tentara2 suara1
+ panah: tajam2 jauh2 busur2 kuno1
+ tombak: tajam3 panjang2 kuno1
+ bom: ledak3 perang3 rusak2
+ perisai: lindung3 tentara2 kuno1

@ arah3 posisi3 abstrak2
atas, bawah, depan, belakang, kiri, kanan, tengah, luar, dalam, samping, utara, selatan, timur, barat
+ atas: tinggi3 langit1
+ bawah: rendah3 tanah1
+ tengah: pusat2
+ timur: matahari2 pagi1
+ barat: matahari2 sore1


# ---------------------------------------------------------------------------
# ALIAS — bentuk lain yang lumrah diketik pemain
# ---------------------------------------------------------------------------

~ ponsel -> hp, handphone, smartphone, hape
~ televisi -> tv, tivi
~ sepakbola -> bola-kaki, sepak-bola
~ rumahsakit -> rumah-sakit, rumah sakit
~ jam-tangan -> arloji, jam tangan
~ kaus-kaki -> kaos-kaki, kaus kaki, kaos kaki
~ sarung-tangan -> sarungtangan, sarung tangan
~ air-terjun -> airterjun, air terjun
~ kupu-kupu -> kupukupu
~ laba-laba -> labalaba
~ lumba-lumba -> lumbalumba
~ kura-kura -> kurakura
~ layang-layang -> layangan
~ abu-abu -> abuabu
~ paru-paru -> paruparu
~ merah-muda -> merahmuda, pink
~ jam -> jam-dinding
~ pria -> lelaki, laki-laki, cowok
~ wanita -> perempuan, cewek
~ uang -> duit
~ komputer -> pc
~ ulangtahun -> ultah, ulang tahun
~ magicom -> ricecooker, rice-cooker, rice cooker
~ mikrowave -> microwave
~ ponsel -> telepon-genggam
~ sepatu -> sepatu-olahraga
~ berjalan -> jalan-kaki
