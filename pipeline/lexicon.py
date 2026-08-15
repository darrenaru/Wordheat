"""Kamus penyaring: menentukan kata mana yang boleh masuk kosakata Wordheat.

Sumber:
  - geovedi/indonesian-wordlist (gabungan KBBI3, crawl, myspell) -> bersih, satu kata
  - aryakdaniswara/kbbi-v6-wordlist (194k lema KBBI v6) -> cakupan luas

Keduanya digabung, lalu disaring ke bentuk yang layak ditebak pemain.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

RAW_DIR = Path(__file__).parent / "data" / "raw"

# Huruf a-z, boleh satu tanda hubung untuk reduplikasi (kupu-kupu, tiba-tiba).
WORD_RE = re.compile(r"^[a-z]+(-[a-z]+)?$")

MIN_LEN = 3
MAX_LEN = 20

# Imbuhan dan partikel yang lolos regex tapi bukan kata utuh.
AFFIX_FRAGMENTS = {
    "nya", "kah", "lah", "pun", "ku", "mu", "ter", "ber", "mem", "pen",
    "peng", "meng", "menge", "diper", "memper", "keter",
}


def normalize(token: str) -> str:
    """Turunkan token ke bentuk kanonik: huruf kecil, tanpa diakritik."""
    token = unicodedata.normalize("NFKD", token.strip().lower())
    token = "".join(c for c in token if not unicodedata.combining(c))
    return token


def is_playable(word: str) -> bool:
    """Apakah kata layak muncul di daftar peringkat yang dilihat pemain?"""
    if not (MIN_LEN <= len(word) <= MAX_LEN):
        return False
    if not WORD_RE.match(word):
        return False
    if word in AFFIX_FRAGMENTS:
        return False
    # Reduplikasi utuh (kupu-kupu) boleh; gabungan asal-asalan (a-b) tidak.
    if "-" in word:
        left, right = word.split("-", 1)
        if len(left) < 2 or len(right) < 2:
            return False
    return True


def load() -> set[str]:
    """Muat gabungan kedua kamus sebagai himpunan kata yang sudah disaring."""
    words: set[str] = set()
    sources = [
        RAW_DIR / "geovedi-union.lst",
        RAW_DIR / "kbbi6.txt",
    ]
    missing = [p for p in sources if not p.exists()]
    if missing:
        raise FileNotFoundError(
            "Wordlist belum diunduh: "
            + ", ".join(str(p) for p in missing)
            + "\nJalankan: python pipeline/fetch_lexicon.py"
        )

    for path in sources:
        with path.open(encoding="utf-8", errors="replace") as fh:
            for line in fh:
                word = normalize(line)
                if is_playable(word):
                    words.add(word)
    return words


if __name__ == "__main__":
    vocab = load()
    print(f"kamus gabungan: {len(vocab):,} kata")
    sample = sorted(vocab)[::len(vocab) // 12]
    print("contoh:", ", ".join(sample[:12]))
