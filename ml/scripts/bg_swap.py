"""Phase 3 step 3: paste segmented PlantVillage leaves onto real backgrounds.

Needs the "segmented" PlantVillage folder (black background, same class folders
as "color") and a folder of background photos you took: soil, hands, plants,
no leaves of our 14 classes in focus.

Only leaves whose colour original is in the TRAIN split are used, so no test
leaf can reach training through its segmented copy. New rows are appended to
the manifest as source "plantvillage_bgswap", split "train".
"""

import argparse
import random
from pathlib import Path

from PIL import Image

import _bootstrap  # noqa: F401
from cropcare import bgswap, manifest, prepare
from cropcare.classes import ClassMap

SEGMENTED_SUFFIXES = ("_final_masked",)


def original_key(path: Path) -> str:
    """class folder / file stem with any segmented-copy suffix removed, lower case."""
    stem = path.stem
    for suffix in SEGMENTED_SUFFIXES:
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
    return f"{path.parent.name}/{stem}".lower()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--segmented", type=Path, required=True, help="segmented PlantVillage folder inside data-dir")
    ap.add_argument("--backgrounds", type=Path, required=True, help="folder of background photos inside data-dir")
    ap.add_argument("--per-class", type=int, default=600, help="composites to make per class")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    cmap = ClassMap.load()
    manifest_path = args.data_dir / "manifest.csv"
    rows = [r for r in manifest.read(manifest_path) if r.source != "plantvillage_bgswap"]
    train_keys = {
        original_key(Path(r.path)): r.label
        for r in rows
        if r.source == "plantvillage" and r.split == "train"
    }
    pv_keys = {original_key(Path(r.path)) for r in rows if r.source == "plantvillage"}

    segmented = prepare.scan_class_folders(args.segmented, "plantvillage", cmap)
    matched = [(p, label) for p, label in segmented if original_key(p) in pv_keys]
    match_rate = len(matched) / max(1, len(segmented))
    print(f"{len(segmented)} segmented images, {match_rate:.1%} matched to a colour original")
    if match_rate < 0.95:
        examples = [str(p) for p, _ in segmented if original_key(p) not in pv_keys][:5]
        raise SystemExit(
            "error: fewer than 95% of segmented images match a colour original, so splits "
            f"cannot be inherited safely. Unmatched examples: {examples}. "
            "Adjust SEGMENTED_SUFFIXES in this script."
        )

    backgrounds = prepare.list_images(args.backgrounds)
    if len(backgrounds) < 20:
        raise SystemExit(f"error: need at least 20 background photos, found {len(backgrounds)}")

    out_dir = args.data_dir / "processed" / "bgswap"
    new_rows = []
    for label in cmap.labels:
        pool = [p for p, lab in matched if lab == label and original_key(p) in train_keys]
        if not pool:
            print(f"  {label}: no train leaves, skipped")
            continue
        (out_dir / label).mkdir(parents=True, exist_ok=True)
        for i in range(args.per_class):
            leaf_path = rng.choice(pool)
            with Image.open(leaf_path) as leaf, Image.open(rng.choice(backgrounds)) as bg:
                img = bgswap.composite(leaf, bg, rng)
            dest = out_dir / label / f"{leaf_path.stem}_{i:04d}.jpg"
            img.save(dest, quality=90)
            new_rows.append(manifest.Row(prepare._rel(dest, args.data_dir), label, "plantvillage_bgswap", "train"))
        print(f"  {label}: {args.per_class} composites from {len(pool)} leaves")

    manifest.write(manifest_path, rows + new_rows)
    print(f"appended {len(new_rows)} rows to {manifest_path}")


if __name__ == "__main__":
    main()
