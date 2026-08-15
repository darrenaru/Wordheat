"""Bangkitkan puzzle harian Wordheat.

Untuk setiap kata rahasia, seluruh kosakata diurutkan berdasarkan kemiripan
kosinus terhadap kata itu. Hasilnya disimpan sebagai larik Uint16: posisi ke-i
berisi peringkat kata ke-i di kosakata, dikurangi satu. Dengan begitu server
cukup membaca satu angka untuk menjawab sebuah tebakan, tanpa perlu menyusun
peta apa pun saat berkas dimuat.

Keluaran (data/):
  vocab.json            kosakata bersama, urutannya adalah indeks kosakata
  puzzles/manifest.json jadwal puzzle beserta jawabannya (khusus server)
  puzzles/NNNN.bin      peringkat setiap kata untuk satu puzzle
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
from datetime import date, timedelta
from pathlib import Path

import numpy as np

PIPELINE_DIR = Path(__file__).parent
DATA_DIR = PIPELINE_DIR / "data"
OUT_DIR = PIPELINE_DIR.parent / "data"
PUZZLE_DIR = OUT_DIR / "puzzles"

# Peringkat disimpan sebagai Uint16, jadi kosakata tidak boleh melampaui ini.
UINT16_LIMIT = 65_536

# Ditampilkan di layar kemenangan sebagai gambaran betapa dekatnya tebakan
# terakhir pemain, sekaligus dipakai UI untuk menyetel gradien warna.
PREVIEW_NEIGHBOURS = 10


def load_inputs():
    vocab = json.loads((DATA_DIR / "vocab.json").read_text(encoding="utf-8"))
    matrix = np.load(DATA_DIR / "vectors.npy")
    secrets = json.loads((DATA_DIR / "secrets.json").read_text(encoding="utf-8"))
    if len(vocab) >= UINT16_LIMIT:
        raise SystemExit(
            f"kosakata {len(vocab):,} kata melampaui batas Uint16; "
            "kecilkan --max-vocab di build_vectors.py atau ganti ke Uint32"
        )
    return vocab, matrix, secrets


def rank_all(matrix: np.ndarray, target: int) -> np.ndarray:
    """Peringkat setiap kata terhadap kata rahasia, 0 = kata rahasia itu sendiri."""
    sims = matrix @ matrix[target]
    order = np.argsort(-sims, kind="stable")
    ranks = np.empty(len(sims), dtype=np.uint16)
    ranks[order] = np.arange(len(sims), dtype=np.uint16)
    return ranks


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=30,
                        help="jumlah puzzle yang dibangkitkan (default 30)")
    parser.add_argument("--start", default=date.today().isoformat(),
                        help="tanggal puzzle pertama, format YYYY-MM-DD")
    parser.add_argument("--pool", type=int, default=1200,
                        help="ambil kata rahasia dari sekian kandidat teratas")
    parser.add_argument("--seed", type=int, default=20260815,
                        help="benih pengacakan; tetap sama agar jadwal reprodusibel")
    parser.add_argument("--words", nargs="*", default=None,
                        help="pakai kata rahasia ini alih-alih mengacak kandidat")
    parser.add_argument("--clean", action="store_true",
                        help="hapus puzzle lama sebelum membangkitkan yang baru")
    args = parser.parse_args()

    vocab, matrix, secrets = load_inputs()
    index = {w: i for i, w in enumerate(vocab)}

    if args.words:
        chosen = []
        for word in args.words:
            if word not in index:
                raise SystemExit(f"'{word}' tidak ada di kosakata")
            chosen.append(word)
    else:
        pool = secrets[: args.pool]
        if args.count > len(pool):
            raise SystemExit(f"hanya ada {len(pool)} kandidat, diminta {args.count}")
        chosen = random.Random(args.seed).sample(pool, args.count)

    if args.clean and PUZZLE_DIR.exists():
        shutil.rmtree(PUZZLE_DIR)
    PUZZLE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(DATA_DIR / "vocab.json", OUT_DIR / "vocab.json")

    start = date.fromisoformat(args.start)
    manifest = []

    for offset, word in enumerate(chosen):
        target = index[word]
        ranks = rank_all(matrix, target)
        puzzle_id = offset + 1

        (PUZZLE_DIR / f"{puzzle_id:04d}.bin").write_bytes(ranks.tobytes())

        order = np.argsort(ranks[: len(vocab)])[: PREVIEW_NEIGHBOURS + 1]
        neighbours = [vocab[i] for i in order if i != target][:PREVIEW_NEIGHBOURS]
        manifest.append({
            "id": puzzle_id,
            "date": (start + timedelta(days=offset)).isoformat(),
            "word": word,
            "wordIndex": target,
            "neighbours": neighbours,
        })
        print(f"  #{puzzle_id:>3} {manifest[-1]['date']}  {word:<16} -> {', '.join(neighbours[:5])}")

    (PUZZLE_DIR / "manifest.json").write_text(
        json.dumps({"vocabSize": len(vocab), "puzzles": manifest},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    total = sum(p.stat().st_size for p in PUZZLE_DIR.glob("*.bin"))
    print(f"\n{len(manifest)} puzzle -> {PUZZLE_DIR} ({total / 1e6:.1f} MB)")
    print(f"kosakata bersama -> {OUT_DIR / 'vocab.json'}")


if __name__ == "__main__":
    main()
