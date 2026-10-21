"""Write data/manifest.csv from the raw datasets.

Expected layout (all inside --data-dir, default ../data):
  raw/plantvillage/<class folders>          e.g. the Kaggle "color" folder
  raw/plantdoc/train/<class folders>        git clone of pratikkayal/PlantDoc-Dataset
  raw/plantdoc/test/<class folders>
  field/images/*.jpg + field/labels.csv     your own photos (optional until collected)

Example:
  python scripts/prepare_data.py --data-dir ../data
"""

import argparse
from collections import Counter
from pathlib import Path

import _bootstrap  # noqa: F401
from cropcare import manifest, prepare
from cropcare.classes import ClassMap


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--plantvillage", type=Path, help="default: <data-dir>/raw/plantvillage")
    ap.add_argument("--plantdoc", type=Path, help="default: <data-dir>/raw/plantdoc")
    ap.add_argument("--field", type=Path, help="default: <data-dir>/field (skipped if labels.csv is missing)")
    ap.add_argument("--seed", default="cropcare-v1")
    args = ap.parse_args()

    data_dir = args.data_dir
    cmap = ClassMap.load()
    rows = prepare.plantvillage_rows(args.plantvillage or data_dir / "raw/plantvillage", data_dir, cmap, args.seed)
    rows += prepare.plantdoc_rows(args.plantdoc or data_dir / "raw/plantdoc", data_dir, cmap, args.seed)

    field_dir = args.field or data_dir / "field"
    if (field_dir / "labels.csv").is_file():
        rows += prepare.field_rows(field_dir, data_dir, cmap)
    else:
        print(f"note: no {field_dir / 'labels.csv'} yet, field photos skipped")

    out = data_dir / "manifest.csv"
    manifest.write(out, rows)
    counts = Counter((r.source, r.split) for r in rows)
    print(f"wrote {out} with {len(rows)} rows")
    for (source, split), n in sorted(counts.items()):
        print(f"  {source:14s} {split:5s} {n}")
    missing = [label for label in cmap.labels if not any(r.label == label and r.source == "plantvillage" for r in rows)]
    if missing:
        raise SystemExit(f"error: no PlantVillage images for {missing}; check the folder names")


if __name__ == "__main__":
    main()
