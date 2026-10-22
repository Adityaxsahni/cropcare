"""Pack your own field photos into field.zip for the Colab notebook.

Sort the photos into one folder per label, named exactly as in ml/class_map.json:

  my_photos/
    tomato_late_blight/   IMG_0012.jpg  IMG_0013.jpg ...
    potato_healthy/       ...
    maize_common_rust/    ...

Then run, with the name of the person who identified the diseases:

  python scripts/make_field_zip.py my_photos --labelled-by "Dr. A. Kumar, KVK Muzaffarpur" --place "Muzaffarpur"

It writes field.zip (images/ and labels.csv). Upload it to My Drive/cropcare/ in Google Drive.
Only standard Python is needed.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}
NEED_AT_LEAST = {"potato_healthy": 20, "maize_healthy": 20}  # the only real-world test for these (docs/DECISIONS.md ADR-002)


def collect(photos: Path, labels: list[str]) -> tuple[list[tuple[str, Path]], list[str]]:
    found, errors = [], []
    for folder in sorted(p for p in photos.iterdir() if p.is_dir()):
        if folder.name not in labels:
            errors.append(f"folder '{folder.name}' is not a label; use one of: {', '.join(labels)}")
            continue
        for img in sorted(folder.rglob("*")):
            if img.is_file() and img.suffix.lower() in IMAGE_EXTS:
                found.append((folder.name, img))
    loose = [p.name for p in photos.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
    if loose:
        errors.append(f"{len(loose)} photos are not inside a label folder (for example {loose[0]})")
    return found, errors


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photos", type=Path)
    ap.add_argument("--labelled-by", required=True, help="who identified the diseases")
    ap.add_argument("--place", default="", help="district or village, optional")
    ap.add_argument("--out", type=Path, default=Path("field.zip"))
    args = ap.parse_args()

    if not args.labelled_by.strip():
        print("error: --labelled-by cannot be empty")
        return 1
    if not args.photos.is_dir():
        print(f"error: {args.photos} is not a folder")
        return 1
    labels = json.loads((ROOT / "ml/class_map.json").read_text(encoding="utf-8"))["labels"]
    found, errors = collect(args.photos, labels)
    if errors:
        print("error:")
        for e in errors:
            print(f"  - {e}")
        return 1
    if not found:
        print("error: no photos found")
        return 1

    rows = io.StringIO()
    w = csv.writer(rows)
    w.writerow(["filename", "label", "labelled_by", "date", "place"])
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as z:
        for i, (label, img) in enumerate(found, 1):
            name = f"{label}__{i:04d}{img.suffix.lower()}"
            z.write(img, f"images/{name}")
            taken = date.fromtimestamp(img.stat().st_mtime).isoformat()
            w.writerow([name, label, args.labelled_by.strip(), taken, args.place.strip()])
        z.writestr("labels.csv", rows.getvalue())

    counts = {label: sum(1 for lab, _ in found if lab == label) for label in labels}
    print(f"wrote {args.out} with {len(found)} photos")
    for label in labels:
        flag = ""
        if label in NEED_AT_LEAST and counts[label] < NEED_AT_LEAST[label]:
            flag = f"  <- aim for at least {NEED_AT_LEAST[label]}"
        print(f"  {label:32s} {counts[label]:4d}{flag}")
    missing = [label for label in labels if counts[label] == 0]
    if missing:
        print(f"note: no photos yet for {len(missing)} labels; their field results will be missing")
    print("Upload it to My Drive/cropcare/ in Google Drive, then run the notebook.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
