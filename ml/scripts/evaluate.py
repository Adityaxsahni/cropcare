"""Evaluate a .keras or .tflite model on one test set.

  python scripts/evaluate.py --model runs/p2_baseline/model.keras --source plantvillage
  python scripts/evaluate.py --model runs/p2_baseline/model.keras --source plantdoc
  python scripts/evaluate.py --model runs/final/model.keras --source field   # once, at the very end

Writes <model dir>/eval_<source>_<split>[_<model file>].json and .md.
"""

import argparse
import json
from pathlib import Path

import _bootstrap  # noqa: F401
from cropcare import manifest, report
from cropcare.classes import ClassMap


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--source", choices=("plantvillage", "plantdoc", "field"), required=True)
    ap.add_argument("--split", choices=("val", "test"), default="test")
    ap.add_argument("--n-boot", type=int, default=2000)
    args = ap.parse_args()

    from cropcare import data, predict

    labels = ClassMap.load().labels
    rows = manifest.select(manifest.read(args.data_dir / "manifest.csv"), [args.source], args.split)
    if not rows:
        raise SystemExit(f"error: no {args.source} {args.split} rows in the manifest")
    probs, y_true = predict.predict(args.model, data.eval_dataset(rows, args.data_dir, labels))
    summary = report.summarise(y_true, probs, labels, args.n_boot)
    summary.update({"model": str(args.model), "source": args.source, "split": args.split})

    suffix = "" if args.model.suffix == ".keras" else f"_{args.model.stem}"
    stem = args.model.parent / f"eval_{args.source}_{args.split}{suffix}"
    Path(f"{stem}.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    md = report.to_markdown(f"{args.model.name} on {args.source} {args.split}", summary)
    Path(f"{stem}.md").write_text(md, encoding="utf-8")
    print(md)
    print(f"wrote {stem}.json and {stem}.md")


if __name__ == "__main__":
    main()
