"""Bangun matriks vektor kata Wordheat dari fastText Bahasa Indonesia.

Berkas cc.id.300.vec.gz berukuran ~1,2 GB dan berisi 2 juta token, tetapi
urutannya mengikuti frekuensi pemakaian. Wordheat hanya butuh kata-kata umum,
jadi aliran unduhan dihentikan setelah sejumlah baris terbaca -- tidak perlu
mengunduh seluruh berkas.

Keluaran (pipeline/data/):
  vocab.json    daftar kata terurut frekuensi
  vectors.npy   matriks float32 (n_kata x 300), sudah dinormalisasi L2
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
import requests

import lexicon

VECTORS_URL = "https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.id.300.vec.gz"
OUT_DIR = Path(__file__).parent / "data"

# Klitik yang menempel di akhir kata. Bentuk berimbuhan seperti "rumahku"
# dibuang karena maknanya nyaris identik dengan kata dasarnya.
CLITICS = ("nya", "ku", "mu", "kah", "lah", "pun")
CLITIC_SIM_THRESHOLD = 0.55

# Reduplikasi jamak ("kucing-kucing") sangat mirip kata dasarnya, sedangkan
# reduplikasi leksikal ("kupu-kupu", "laba-laba") tidak. Ambang ini memisahkan
# keduanya -- diukur dari data, lihat catatan di README.
REDUP_SIM_THRESHOLD = 0.72


def stream_vectors(url: str, max_scan: int, max_vocab: int, allowed: set[str]):
    """Alirkan berkas .vec.gz dan ambil kata yang lolos saring."""
    words: list[str] = []
    rows: list[np.ndarray] = []
    seen: set[str] = set()
    # Token sumber diurutkan frekuensi dan membedakan huruf besar/kecil. Kalau
    # bentuk tersering sebuah kata ternyata berkapital ("Jakarta" jauh
    # mengungguli "jakarta"), kata itu praktis pasti nama diri.
    proper: list[str] = []

    started = time.time()
    with requests.get(url, stream=True, timeout=(30, 300)) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("Content-Length", 0))
        raw = resp.raw
        raw.decode_content = False
        with gzip.GzipFile(fileobj=raw) as gz:
            text = io.TextIOWrapper(gz, encoding="utf-8", errors="replace", newline="\n")

            header = text.readline().split()
            n_total, dim = int(header[0]), int(header[1])
            print(f"sumber: {n_total:,} token x {dim} dimensi")

            for scanned, line in enumerate(text, start=1):
                token, _, rest = line.partition(" ")
                word = lexicon.normalize(token)

                if word not in seen and word in allowed:
                    try:
                        vec = np.array(rest.split(), dtype=np.float32)
                    except ValueError:
                        continue
                    if vec.shape[0] == dim:
                        seen.add(word)
                        words.append(word)
                        rows.append(vec)
                        if token[:1].isupper():
                            proper.append(word)

                if scanned % 50_000 == 0:
                    mb = raw.tell() / 1e6 if hasattr(raw, "tell") else 0
                    elapsed = time.time() - started
                    print(
                        f"  dipindai {scanned:>7,} | disimpan {len(words):>6,}"
                        f" | ~{mb:6.0f}/{total / 1e6:.0f} MB | {elapsed:5.0f}s",
                        flush=True,
                    )

                if scanned >= max_scan or len(words) >= max_vocab:
                    print(f"berhenti pada baris {scanned:,} (cukup)")
                    break

    matrix = np.vstack(rows).astype(np.float32)
    return words, matrix, set(proper)


def l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def drop_clitic_forms(words: list[str], matrix: np.ndarray) -> tuple[list[str], np.ndarray]:
    """Buang bentuk berklitik yang maknanya menempel pada kata dasarnya.

    "rumahku" mirip sekali dengan "rumah" sehingga tidak menarik sebagai
    tebakan terpisah, sedangkan "bangku" tidak mirip dengan "bang" dan tetap
    dipertahankan. Ambang kemiripan vektor yang membedakan keduanya.
    """
    index = {w: i for i, w in enumerate(words)}
    drop: set[int] = set()

    for i, word in enumerate(words):
        for clitic in CLITICS:
            if not word.endswith(clitic):
                continue
            stem = word[: -len(clitic)]
            if len(stem) < 3:
                continue
            j = index.get(stem)
            if j is None:
                continue
            if float(matrix[i] @ matrix[j]) >= CLITIC_SIM_THRESHOLD:
                drop.add(i)
            break

    if not drop:
        return words, matrix
    keep = [i for i in range(len(words)) if i not in drop]
    print(f"membuang {len(drop):,} bentuk berklitik (mis. {words[sorted(drop)[0]]})")
    return [words[i] for i in keep], matrix[keep]


def drop_plural_reduplication(words: list[str], matrix: np.ndarray) -> tuple[list[str], np.ndarray]:
    """Buang reduplikasi yang hanya menandai jamak.

    "kucing-kucing" tidak menambah apa pun di atas "kucing", tetapi
    "kupu-kupu" adalah kata tersendiri yang maknanya jauh dari "kupu".
    Kemiripan vektor terhadap kata dasar yang memisahkan keduanya.
    """
    index = {w: i for i, w in enumerate(words)}
    drop: set[int] = set()
    examples: list[str] = []

    for i, word in enumerate(words):
        head, sep, tail = word.partition("-")
        if not sep or head != tail:
            continue
        j = index.get(head)
        if j is None:
            continue
        if float(matrix[i] @ matrix[j]) >= REDUP_SIM_THRESHOLD:
            drop.add(i)
            if len(examples) < 4:
                examples.append(word)

    if not drop:
        return words, matrix
    keep = [i for i in range(len(words)) if i not in drop]
    print(f"membuang {len(drop):,} reduplikasi jamak (mis. {', '.join(examples)})")
    return [words[i] for i in keep], matrix[keep]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-scan", type=int, default=400_000,
                        help="berapa baris sumber yang dipindai (default 400rb)")
    parser.add_argument("--max-vocab", type=int, default=60_000,
                        help="batas jumlah kata yang disimpan (default 60rb)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    allowed = lexicon.load()
    print(f"kamus penyaring: {len(allowed):,} kata")

    words, matrix, proper = stream_vectors(VECTORS_URL, args.max_scan, args.max_vocab, allowed)
    print(f"terkumpul {len(words):,} kata sebelum pembersihan")

    matrix = l2_normalize(matrix)
    words, matrix = drop_clitic_forms(words, matrix)
    words, matrix = drop_plural_reduplication(words, matrix)
    matrix = l2_normalize(matrix)

    proper &= set(words)
    print(f"terdeteksi {len(proper):,} nama diri (mis. {', '.join(sorted(proper)[:4])})")

    (OUT_DIR / "vocab.json").write_text(
        json.dumps(words, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_DIR / "proper_nouns.json").write_text(
        json.dumps(sorted(proper), ensure_ascii=False), encoding="utf-8"
    )
    np.save(OUT_DIR / "vectors.npy", matrix)

    print(f"\nselesai: {len(words):,} kata x {matrix.shape[1]} dimensi")
    print(f"  {OUT_DIR / 'vocab.json'}")
    print(f"  {OUT_DIR / 'vectors.npy'} ({matrix.nbytes / 1e6:.1f} MB)")
    print("  10 kata paling sering:", ", ".join(words[:10]))


if __name__ == "__main__":
    sys.exit(main())
