"""Write an UNTRAINED stand-in model so the Android build can be checked before a real model exists.

  python scripts/make_standin_model.py --out ../app/assets/model

Its version is 0.0.0-standin. The app shows a red "test build" warning for any
model whose version starts with 0.0.0, scripts/import_results.py refuses it,
and the APK workflow names such builds "untrained". Never give this to a farmer.

With --meta-only it writes just model_meta.json (no TensorFlow needed), which
is enough for the app's typecheck and lint.
"""

import argparse
import json
from pathlib import Path

import _bootstrap  # noqa: F401
from cropcare import IMG_SIZE
from cropcare.classes import ClassMap

VERSION = "0.0.0-standin"


def meta(labels: list[str]) -> dict:
    return {
        "version": VERSION,
        "variant": "standin-untrained",
        "labels": labels,
        "image_size": IMG_SIZE,
        "crop": "center_square",
        "pixel_range": "0-255",
        "input": {"dtype": "float32", "shape": [1, IMG_SIZE, IMG_SIZE, 3], "scale": 0.0, "zero_point": 0},
        "output": {"dtype": "float32", "shape": [1, len(labels)], "scale": 0.0, "zero_point": 0},
        "threshold": 0.6,
        "float_fallback_ops": 0,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--meta-only", action="store_true")
    args = ap.parse_args()
    labels = list(ClassMap.load().labels)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "model_meta.json").write_text(json.dumps(meta(labels), indent=2) + "\n", encoding="utf-8")
    if args.meta_only:
        print(f"wrote {args.out / 'model_meta.json'} ({VERSION})")
        return

    import tensorflow as tf

    tf.keras.utils.set_random_seed(0)
    inputs = tf.keras.Input((IMG_SIZE, IMG_SIZE, 3))
    x = tf.keras.layers.Rescaling(1 / 255.0)(inputs)
    x = tf.keras.layers.Conv2D(8, 3, strides=4, activation="relu")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outputs = tf.keras.layers.Dense(len(labels), activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)
    blob = tf.lite.TFLiteConverter.from_keras_model(model).convert()
    (args.out / "cropcare.tflite").write_bytes(blob)
    print(f"wrote {args.out / 'cropcare.tflite'} ({len(blob) / 1e3:.0f} KB) and model_meta.json ({VERSION}, UNTRAINED)")


if __name__ == "__main__":
    main()
