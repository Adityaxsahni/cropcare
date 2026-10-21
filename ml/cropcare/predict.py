"""Run a Keras or TFLite model over an evaluation dataset and return probabilities."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import tensorflow as tf


def predict_keras(model: tf.keras.Model, ds: tf.data.Dataset) -> tuple[np.ndarray, np.ndarray]:
    probs, ys = [], []
    for x, y in ds:
        probs.append(model(x, training=False).numpy())
        ys.append(y.numpy())
    return np.concatenate(probs), np.concatenate(ys)


def _quantize(x: np.ndarray, detail: dict) -> np.ndarray:
    dtype = detail["dtype"]
    if dtype == np.float32:
        return x.astype(np.float32)
    scale, zero_point = detail["quantization"]
    info = np.iinfo(dtype)
    return np.clip(np.round(x / scale + zero_point), info.min, info.max).astype(dtype)


def _dequantize(q: np.ndarray, detail: dict) -> np.ndarray:
    if detail["dtype"] == np.float32:
        return q.astype(np.float32)
    scale, zero_point = detail["quantization"]
    return (q.astype(np.float32) - zero_point) * scale


def predict_tflite(model_path: Path, ds: tf.data.Dataset) -> tuple[np.ndarray, np.ndarray]:
    """Runs with LiteRT's default XNNPACK delegate, the same CPU path the phone uses."""
    from ai_edge_litert.interpreter import Interpreter

    interpreter = Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    probs, ys = [], []
    for x, y in ds.unbatch().batch(1):
        interpreter.set_tensor(inp["index"], _quantize(x.numpy(), inp))
        interpreter.invoke()
        probs.append(_dequantize(interpreter.get_tensor(out["index"]), out)[0])
        ys.append(int(y.numpy()[0]))
    return np.stack(probs), np.asarray(ys)


def predict(model_path: Path, ds: tf.data.Dataset) -> tuple[np.ndarray, np.ndarray]:
    model_path = Path(model_path)
    if model_path.suffix == ".tflite":
        return predict_tflite(model_path, ds)
    return predict_keras(tf.keras.models.load_model(model_path), ds)
