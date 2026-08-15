"""Unduh dua wordlist Bahasa Indonesia yang dipakai sebagai penyaring kosakata."""

from __future__ import annotations

from pathlib import Path

import requests

RAW_DIR = Path(__file__).parent / "data" / "raw"

SOURCES = {
    "geovedi-union.lst": "https://raw.githubusercontent.com/geovedi/indonesian-wordlist/master/00-indonesian-wordlist.lst",
    "kbbi6.txt": "https://raw.githubusercontent.com/aryakdaniswara/kbbi-v6-wordlist/main/all_entries_v6.1.0.txt",
}


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dest = RAW_DIR / name
        if dest.exists():
            print(f"[lewati] {name} sudah ada ({dest.stat().st_size:,} byte)")
            continue
        print(f"[unduh]  {name} <- {url}")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        print(f"[selesai] {name} ({dest.stat().st_size:,} byte)")


if __name__ == "__main__":
    main()
