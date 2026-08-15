"""Periksa kualitas ranking semantik untuk sebuah kata.

Contoh:
    python pipeline/inspect_similarity.py dokter
    python pipeline/inspect_similarity.py dokter --top 40
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

DATA_DIR = Path(__file__).parent / "data"


def load():
    words = json.loads((DATA_DIR / "vocab.json").read_text(encoding="utf-8"))
    matrix = np.load(DATA_DIR / "vectors.npy")
    return words, matrix, {w: i for i, w in enumerate(words)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("word", nargs="+", help="kata yang diperiksa")
    parser.add_argument("--top", type=int, default=25)
    args = parser.parse_args()

    words, matrix, index = load()

    for target in args.word:
        i = index.get(target)
        if i is None:
            print(f"\n[{target}] tidak ada di kosakata")
            continue
        sims = matrix @ matrix[i]
        order = np.argsort(-sims)[: args.top + 1]
        print(f"\n=== {target} ===")
        for rank, j in enumerate(order):
            if j == i:
                continue
            print(f"  {rank:>3}. {words[j]:<22} {sims[j]:.3f}")


if __name__ == "__main__":
    main()
