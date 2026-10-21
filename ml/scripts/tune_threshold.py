"""Choose the "unsure" threshold on a validation split (never on field photos).

Picks the lowest threshold whose accuracy on answered photos reaches --target,
so the app answers as often as it can while staying that accurate.

  python scripts/tune_threshold.py --model runs/final/model.keras --source plantdoc --target 0.9
"""

import argparse
import json
from pathlib import Path

import numpy as np

import _bootstrap  # noqa: F401
from cropcare import manifest, metrics
from cropcare.classes import ClassMap


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--source", choices=("plantvillage", "plantdoc"), default="plantdoc")
    ap.add_argument("--target", type=float, default=0.9, help="accuracy wanted on answered photos")
    args = ap.parse_args()

    from cropcare import data, predict

    labels = ClassMap.load().labels
    rows = manifest.select(manifest.read(args.data_dir / "manifest.csv"), [args.source], "val")
    probs, y_true = predict.predict(args.model, data.eval_dataset(rows, args.data_dir, labels))
    threshold, table = metrics.choose_threshold(y_true, probs, args.target, np.round(np.arange(0.30, 0.96, 0.05), 2))

    print(f"{len(rows)} {args.source} val images")
    print("threshold  coverage  accuracy_answered")
    for r in table:
        acc = "n/a" if not r["n_answered"] else f"{r['accuracy_answered']:.1%}"
        print(f"  {r['threshold']:.2f}     {r['coverage']:6.1%}   {acc}")
    if threshold is None:
        raise SystemExit(f"no threshold reaches {args.target:.0%}; lower --target or improve the model")
    out = args.model.parent / "threshold.json"
    out.write_text(json.dumps({"threshold": threshold, "target": args.target, "source": args.source,
                               "n_val": len(rows), "table": table}, indent=2), encoding="utf-8")
    print(f"chosen threshold {threshold:.2f}, written to {out}")


if __name__ == "__main__":
    main()
