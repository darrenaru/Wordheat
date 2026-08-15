"""Susun daftar kandidat kata rahasia Wordheat.

Kosakata tebakan sengaja dibuat luas (56 ribu kata) supaya hampir semua
tebakan pemain diterima. Kata rahasianya justru harus sempit: hanya kata dasar
yang umum dikenal, sebab jawaban berupa bentuk berimbuhan seperti "memasak"
akan terasa tidak adil ketika "masak" sudah ada di daftar peringkat.

Penyaringnya:
  frekuensi   cukup umum untuk dikenal, tapi bukan kata fungsi
  bentuk      kata dasar menurut Sastrawi (atau reduplikasi leksikal)
  kamus       terdaftar di wordlist geovedi yang relatif bersih
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from Sastrawi.Stemmer.StemmerFactory import StemmerFactory
from Sastrawi.StopWordRemover.StopWordRemoverFactory import StopWordRemoverFactory

import lexicon

DATA_DIR = Path(__file__).parent / "data"

# Kata dengan peringkat frekuensi di bawah ini hampir semuanya kata fungsi
# ("yang", "dan", "untuk") yang tidak punya isi makna untuk ditebak.
MIN_FREQ_RANK = 150
MAX_FREQ_RANK = 8000

MIN_LEN = 4
MAX_LEN = 14

# Angka Romawi ("xiii", "xvii") lolos semua saring bentuk tapi bukan kata.
ROMAN_RE = re.compile(r"^[ivxlcdm]+$")

# Korpus fastText banyak menyerap kotak taksonomi Wikipedia, sehingga istilah
# klasifikasi ilmiah tampak sangat umum padahal tak seorang pun menebaknya.
TAXONOMY_TERMS = {
    "spesies", "genus", "familia", "ordo", "filum", "kelas", "subfamili",
    "subordo", "superfamili", "subspesies", "takson", "binomial", "sinonim",
    "arthropoda", "insecta", "mammalia", "aves", "reptilia", "chordata",
    "magnoliophyta", "plantae", "animalia", "fabaceae", "asteraceae",
    "lepidoptera", "coleoptera", "gastropoda", "actinopterygii",
}

# Lolos saring frekuensi dan bentuk dasar, tetapi tetap tidak layak jadi
# jawaban: terlalu abstrak, gramatikal, atau tidak punya tetangga makna jelas.
MANUAL_BLOCKLIST = {
    "sang", "para", "kaum", "yaitu", "yakni", "ialah", "bahkan", "namun",
    "tetapi", "melainkan", "sedangkan", "supaya", "agar", "walau", "meski",
    "sebab", "karena", "sehingga", "maka", "jika", "kalau", "bila", "ketika",
    "sambil", "hingga", "sampai", "sejak", "selama", "antara", "terhadap",
    "mengenai", "tentang", "menurut", "sesuai", "berupa", "berbagai",
    "seluruh", "sebagian", "beberapa", "banyak", "sedikit", "semua", "setiap",
    "masing", "sendiri", "lainnya", "tersebut", "demikian", "begitu", "begini",
    "adapun", "pula", "juga", "saja", "hanya", "sangat", "sekali", "lebih",
    "paling", "cukup", "agak", "amat", "tidak", "bukan", "belum", "sudah",
    "telah", "akan", "sedang", "masih", "pernah", "harus", "dapat", "bisa",
    "boleh", "mungkin", "tentu", "pasti", "kira", "rasa", "buah", "orang",
    "hal", "cara", "jenis", "bagian", "bentuk", "sifat", "keadaan",
}


def load_vocab() -> list[str]:
    path = DATA_DIR / "vocab.json"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} belum ada. Jalankan dulu: python pipeline/build_vectors.py"
        )
    return json.loads(path.read_text(encoding="utf-8"))


def is_root_form(word: str, stemmer) -> bool:
    """Apakah kata sudah berbentuk dasar?

    Reduplikasi leksikal ("kupu-kupu") dianggap bentuk dasar karena memang
    tidak punya bentuk tunggal yang berdiri sendiri dengan makna sama.
    """
    head, sep, tail = word.partition("-")
    if sep:
        return head == tail
    return stemmer.stem(word) == word


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0,
                        help="batasi jumlah kandidat yang ditulis (0 = semua)")
    args = parser.parse_args()

    vocab = load_vocab()
    proper = set(json.loads((DATA_DIR / "proper_nouns.json").read_text(encoding="utf-8")))
    stemmer = StemmerFactory().create_stemmer()
    stopwords = set(StopWordRemoverFactory().get_stop_words())
    clean_dict = {
        lexicon.normalize(line)
        for line in (lexicon.RAW_DIR / "geovedi-union.lst").read_text(
            encoding="utf-8", errors="replace"
        ).splitlines()
    }

    candidates: list[str] = []
    for rank, word in enumerate(vocab):
        if rank < MIN_FREQ_RANK:
            continue
        if rank >= MAX_FREQ_RANK:
            break
        if not (MIN_LEN <= len(word) <= MAX_LEN):
            continue
        if word in stopwords or word in MANUAL_BLOCKLIST:
            continue
        if word in proper or word in TAXONOMY_TERMS or ROMAN_RE.match(word):
            continue
        if word not in clean_dict:
            continue
        if not is_root_form(word, stemmer):
            continue
        candidates.append(word)

    if args.limit:
        candidates = candidates[: args.limit]

    out = DATA_DIR / "secrets.json"
    out.write_text(json.dumps(candidates, ensure_ascii=False, indent=0), encoding="utf-8")

    print(f"{len(candidates):,} kandidat kata rahasia -> {out}")
    print("\n50 pertama (paling umum):")
    print("  " + ", ".join(candidates[:50]))
    print("\n50 terakhir (paling jarang):")
    print("  " + ", ".join(candidates[-50:]))


if __name__ == "__main__":
    main()
