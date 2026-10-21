"""Classification metrics in plain numpy, so they are easy to test and audit."""

from __future__ import annotations

from typing import Callable

import numpy as np


def confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, num_classes: int) -> np.ndarray:
    cm = np.zeros((num_classes, num_classes), dtype=np.int64)
    np.add.at(cm, (np.asarray(y_true), np.asarray(y_pred)), 1)
    return cm


def accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    return float(np.mean(y_true == y_pred)) if len(y_true) else float("nan")


def per_class_f1(y_true: np.ndarray, y_pred: np.ndarray, classes: list[int]) -> dict[int, float]:
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    out = {}
    for c in classes:
        tp = int(np.sum((y_true == c) & (y_pred == c)))
        fp = int(np.sum((y_true != c) & (y_pred == c)))
        fn = int(np.sum((y_true == c) & (y_pred != c)))
        denom = 2 * tp + fp + fn
        out[c] = 2 * tp / denom if denom else 0.0
    return out


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray, classes: list[int] | None = None) -> float:
    """Mean F1 over `classes`, by default the classes present in y_true.

    Predictions of a class absent from the test set still count as false
    positives for the true class, so they lower the score.
    """
    if classes is None:
        classes = sorted(set(np.asarray(y_true).tolist()))
    scores = per_class_f1(y_true, y_pred, classes)
    return float(np.mean(list(scores.values()))) if scores else float("nan")


def bootstrap_ci(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    metric: Callable[[np.ndarray, np.ndarray], float],
    n_boot: int = 2000,
    seed: int = 0,
    level: float = 0.95,
) -> tuple[float, float]:
    """Percentile bootstrap interval, resampling images with replacement."""
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    rng = np.random.default_rng(seed)
    n = len(y_true)
    stats = np.empty(n_boot)
    for i in range(n_boot):
        idx = rng.integers(0, n, n)
        stats[i] = metric(y_true[idx], y_pred[idx])
    lo, hi = np.percentile(stats, [(1 - level) / 2 * 100, (1 + level) / 2 * 100])
    return float(lo), float(hi)


def selective(y_true: np.ndarray, probs: np.ndarray, threshold: float) -> dict[str, float]:
    """Coverage and accuracy when the model answers only above `threshold`."""
    y_true, probs = np.asarray(y_true), np.asarray(probs)
    conf = probs.max(axis=1)
    pred = probs.argmax(axis=1)
    answered = conf >= threshold
    n_answered = int(answered.sum())
    return {
        "threshold": float(threshold),
        "coverage": n_answered / len(y_true) if len(y_true) else float("nan"),
        "n_answered": n_answered,
        "accuracy_answered": accuracy(y_true[answered], pred[answered]) if n_answered else float("nan"),
    }


def choose_threshold(
    y_true: np.ndarray, probs: np.ndarray, target: float, grid: np.ndarray
) -> tuple[float | None, list[dict[str, float]]]:
    """Lowest threshold in `grid` whose accuracy on answered images reaches `target`."""
    table = [selective(y_true, probs, float(t)) for t in sorted(grid)]
    for row in table:
        if row["n_answered"] and row["accuracy_answered"] >= target:
            return row["threshold"], table
    return None, table
