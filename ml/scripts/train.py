"""Train CropCare. One run per Phase 2 / Phase 3 experiment.

Phase 2 baseline:
  python scripts/train.py --sources plantvillage --out runs/p2_baseline
Phase 3, one change at a time:
  python scripts/train.py --sources plantvillage plantdoc --weights 0.6 0.4 --out runs/p3_1_mixed
  python scripts/train.py --sources plantvillage plantdoc --weights 0.6 0.4 --augment strong --out runs/p3_2_strong
  python scripts/train.py --sources plantvillage plantdoc plantvillage_bgswap --weights 0.45 0.35 0.2 \
      --augment strong --out runs/p3_3_bgswap
  ... add --class-weights for step 4
"""

import argparse
import json
from pathlib import Path

import _bootstrap  # noqa: F401
from cropcare import manifest
from cropcare.sampling import effective_class_weights
from cropcare.classes import ClassMap

TRAIN_SOURCES = ("plantvillage", "plantdoc", "plantvillage_bgswap")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--sources", nargs="+", choices=TRAIN_SOURCES, default=["plantvillage"])
    ap.add_argument("--weights", nargs="+", type=float, help="sampling weight per source (default: by size)")
    ap.add_argument("--augment", choices=("basic", "strong"), default="basic")
    ap.add_argument("--class-weights", action="store_true")
    ap.add_argument("--epochs-head", type=int, default=10)
    ap.add_argument("--epochs-finetune", type=int, default=10)
    ap.add_argument("--finetune-layers", type=int, default=40)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    import tensorflow as tf

    from cropcare import data, model as model_lib

    tf.keras.utils.set_random_seed(args.seed)
    labels = ClassMap.load().labels
    rows = manifest.read(args.data_dir / "manifest.csv")
    train_rows = manifest.training_rows(rows, args.sources)
    rows_by_source = {s: [r for r in train_rows if r.source == s] for s in args.sources}
    empty = [s for s, rs in rows_by_source.items() if not rs]
    if empty:
        raise SystemExit(f"error: no training rows for {empty}")

    if args.weights:
        if len(args.weights) != len(args.sources):
            raise SystemExit("error: give one --weights value per --sources entry")
        total = sum(args.weights)
        weights = {s: w / total for s, w in zip(args.sources, args.weights)}
    else:
        weights = {s: len(rs) / len(train_rows) for s, rs in rows_by_source.items()}

    val_source = "plantdoc" if "plantdoc" in args.sources else "plantvillage"
    val_rows = manifest.select(rows, [val_source], "val")
    train_ds = data.train_dataset(rows_by_source, weights, args.data_dir, labels, args.augment, args.batch, args.seed)
    val_ds = data.eval_dataset(val_rows, args.data_dir, labels)
    steps = max(1, len(train_rows) // args.batch)
    class_weight = effective_class_weights(rows_by_source, weights, labels) if args.class_weights else None

    args.out.mkdir(parents=True, exist_ok=True)
    config = {
        **{k: (str(v) if isinstance(v, Path) else v) for k, v in vars(args).items()},
        "weights_normalised": weights,
        "train_rows": {s: len(rs) for s, rs in rows_by_source.items()},
        "val_source": val_source,
        "val_rows": len(val_rows),
        "class_weight": class_weight,
        "labels": list(labels),
        "tensorflow": tf.__version__,
    }
    (args.out / "run_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    print(json.dumps(config, indent=2))

    model, base = model_lib.build(len(labels))

    def callbacks(stage: str):
        return [
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
            tf.keras.callbacks.CSVLogger(str(args.out / f"history_{stage}.csv")),
        ]

    model_lib.compile_head(model)
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_head, steps_per_epoch=steps,
              class_weight=class_weight, callbacks=callbacks("head"))
    if args.epochs_finetune > 0:
        model_lib.unfreeze_top(model, base, args.finetune_layers)
        model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune, steps_per_epoch=steps,
                  class_weight=class_weight, callbacks=callbacks("finetune"))

    model.save(args.out / "model.keras")
    print(f"saved {args.out / 'model.keras'}")


if __name__ == "__main__":
    main()
