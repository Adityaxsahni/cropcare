"""Phase 4: convert to TFLite (LiteRT) and compare size and accuracy.

  python scripts/convert.py --model runs/final/model.keras --version 1.0.0

Writes to <model dir>/export/:
  cropcare_dynamic.tflite + cropcare_dynamic.meta.json
  cropcare_int8.tflite    + cropcare_int8.meta.json   (int8 weights and activations;
                                                       see cropcare/tflite_check.py for
                                                       the float fallback it may need)
  conversion.md           size and accuracy table for results.md

Copy the chosen .tflite to app/assets/model/cropcare.tflite and its meta file to
app/assets/model/model_meta.json. Phone latency is measured in the app.
"""

import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np

import _bootstrap  # noqa: F401
from cropcare import IMG_SIZE, manifest, metrics
from cropcare.classes import ClassMap


def tensor_meta(detail: dict) -> dict:
    scale, zero_point = detail["quantization"]
    return {
        "dtype": np.dtype(detail["dtype"]).name,
        "shape": [int(d) for d in detail["shape"]],
        "scale": float(scale),
        "zero_point": int(zero_point),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--data-dir", type=Path, default=Path("../data"))
    ap.add_argument("--version", required=True)
    ap.add_argument("--threshold", type=float, help="default: threshold.json next to the model")
    ap.add_argument("--eval-source", choices=("field", "plantdoc"), default="field")
    ap.add_argument("--representative", type=int, default=300)
    args = ap.parse_args()

    import tensorflow as tf

    from ai_edge_litert.interpreter import Interpreter

    from cropcare import data, predict, tflite_check

    labels = ClassMap.load().labels
    threshold = args.threshold
    if threshold is None:
        threshold_file = args.model.parent / "threshold.json"
        if not threshold_file.is_file():
            raise SystemExit("error: pass --threshold or run tune_threshold.py first")
        threshold = json.loads(threshold_file.read_text(encoding="utf-8"))["threshold"]

    rows = manifest.read(args.data_dir / "manifest.csv")
    eval_rows = manifest.select(rows, [args.eval_source], "test")
    if not eval_rows:
        raise SystemExit(f"error: no {args.eval_source} test rows")
    rep_rows = manifest.training_rows(rows, ["plantvillage", "plantdoc"])
    rng = np.random.default_rng(0)
    rep_rows = [rep_rows[i] for i in rng.choice(len(rep_rows), min(args.representative, len(rep_rows)), replace=False)]

    out_dir = args.model.parent / "export"
    out_dir.mkdir(parents=True, exist_ok=True)
    model = tf.keras.models.load_model(args.model)
    saved = out_dir / "saved_model"
    model.export(str(saved))  # SavedModel; the safest route with Keras 3

    def representative_data():
        for x, _ in data.eval_dataset(rep_rows, args.data_dir, labels, batch=1):
            yield [tf.cast(x, tf.float32)]

    def int8_converter():
        conv = tf.lite.TFLiteConverter.from_saved_model(str(saved))
        conv.optimizations = [tf.lite.Optimize.DEFAULT]
        conv.representative_dataset = representative_data
        conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        conv.inference_input_type = tf.uint8
        conv.inference_output_type = tf.uint8
        return conv

    files: dict[str, tuple[bytes, list[str]]] = {}
    conv = tf.lite.TFLiteConverter.from_saved_model(str(saved))
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    files["dynamic"] = (conv.convert(), [])

    int8 = int8_converter().convert()
    float_nodes: list[str] = []
    ok, why = tflite_check.runs_with_xnnpack(int8)
    if not ok:
        float_nodes = tflite_check.degenerate_nodes(int8)
        print(f"int8 model refused by XNNPACK ({why}).")
        print(f"keeping {len(float_nodes)} op(s) with degenerate quantization in float:")
        for n in float_nodes:
            print(f"  {n[:110]}")
        debugger = tf.lite.experimental.QuantizationDebugger(
            converter=int8_converter(), debug_dataset=representative_data,
            debug_options=tf.lite.experimental.QuantizationDebugOptions(denylisted_nodes=float_nodes))
        int8 = debugger.get_nondebug_quantized_model()  # note: float32 input and output
    files["int8"] = (int8, float_nodes)

    for name, (blob, _) in files.items():
        ok, why = tflite_check.runs_with_xnnpack(blob)
        if not ok:
            raise SystemExit(f"error: {name} model does not run with XNNPACK: {why}")

    eval_ds = data.eval_dataset(eval_rows, args.data_dir, labels)
    keras_probs, y_true = predict.predict_keras(model, eval_ds)
    table = [("Keras (.keras file)", args.model.stat().st_size, metrics.accuracy(y_true, keras_probs.argmax(1)))]

    for name, (blob, nodes) in files.items():
        path = out_dir / f"cropcare_{name}.tflite"
        path.write_bytes(blob)
        interp = Interpreter(model_content=blob)
        meta = {
            "version": args.version,
            "variant": name,
            "labels": list(labels),
            "image_size": IMG_SIZE,
            "crop": "center_square",
            "pixel_range": "0-255",
            "input": tensor_meta(interp.get_input_details()[0]),
            "output": tensor_meta(interp.get_output_details()[0]),
            "threshold": threshold,
            "float_fallback_ops": len(nodes),
            "created": dt.date.today().isoformat(),
        }
        (out_dir / f"cropcare_{name}.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        probs, _ = predict.predict_tflite(path, eval_ds)
        agree = float(np.mean(probs.argmax(1) == keras_probs.argmax(1)))
        table.append((f"TFLite {name}", len(blob), metrics.accuracy(y_true, probs.argmax(1)), agree))

    md = [f"Accuracy on {args.eval_source} test ({len(eval_rows)} images)", "",
          "| Version | Size (MB) | Accuracy | Same top answer as Keras |", "|---|---|---|---|"]
    md += [f"| {row[0]} | {row[1] / 1e6:.2f} | {row[2]:.1%} | {'n/a' if len(row) < 4 else f'{row[3]:.1%}'} |" for row in table]
    text = "\n".join(md) + "\n"
    (out_dir / "conversion.md").write_text(text, encoding="utf-8")
    rows_json = [
        {"name": row[0], "file": None if i == 0 else f"cropcare_{list(files)[i - 1]}.tflite",
         "size_bytes": row[1], "accuracy": row[2], "agreement_with_keras": row[3] if len(row) > 3 else None}
        for i, row in enumerate(table)
    ]
    (out_dir / "conversion.json").write_text(json.dumps(
        {"eval_source": args.eval_source, "n_images": len(eval_rows), "rows": rows_json}, indent=2), encoding="utf-8")
    print(text)
    print(f"files in {out_dir}")


if __name__ == "__main__":
    main()
