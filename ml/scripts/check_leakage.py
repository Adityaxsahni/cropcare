"""Find near-duplicate images between training data and every evaluation split.

Compares each val/test image (PlantVillage, PlantDoc, field) with every train
image using a 64-bit difference hash. Pairs within --max-distance bits are
written to leakage_pairs.csv for you to look at by eye.

With --drop, near-duplicate evaluation images are removed from the manifest
(the original is kept as manifest.before_leakage.csv).
"""

import argparse
import csv
import shutil
from pathlib import Path

import numpy as np

import _bootstrap  # noqa: F401
from cropcare import hashing, manifest


def hashes(rows: list[manifest.Row], data_dir: Path) -> np.ndarray:
    out = np.empty(len(rows), dtype=np.uint64)
    for i, r in enumerate(rows):
        out[i] = hashing.dhash(data_dir / r.path)
        if (i + 1) % 5000 == 0:
            print(f"  hashed {i + 1}/{len(rows)}")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--max-distance", type=int, default=4, help="Hamming distance in bits (0 to 64)")
    ap.add_argument("--drop", action="store_true")
    args = ap.parse_args()

    manifest_path = args.data_dir / "manifest.csv"
    rows = manifest.read(manifest_path)
    train = [r for r in rows if r.split == "train"]
    evals = [r for r in rows if r.split in ("val", "test")]
    print(f"hashing {len(train)} train and {len(evals)} val/test images")
    pairs = hashing.near_duplicates(hashes(evals, args.data_dir), hashes(train, args.data_dir), args.max_distance)

    out = args.data_dir / "leakage_pairs.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["eval_path", "eval_source", "eval_split", "train_path", "train_source", "distance"])
        for qi, ri, d in pairs:
            w.writerow([evals[qi].path, evals[qi].source, evals[qi].split, train[ri].path, train[ri].source, d])

    leaked = {evals[qi] for qi, _, _ in pairs}
    print(f"{len(pairs)} pairs, {len(leaked)} distinct val/test images have a near-duplicate in train")
    for source in sorted({r.source for r in leaked}):
        print(f"  {source}: {sum(1 for r in leaked if r.source == source)}")
    print(f"pairs written to {out}; open a few to check they really are the same photo")

    if args.drop and leaked:
        shutil.copyfile(manifest_path, args.data_dir / "manifest.before_leakage.csv")
        manifest.write(manifest_path, [r for r in rows if r not in leaked])
        print(f"dropped {len(leaked)} rows from {manifest_path}")


if __name__ == "__main__":
    main()
