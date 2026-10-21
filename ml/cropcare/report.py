"""Turn labels and probabilities into the numbers that go in results.md."""

from __future__ import annotations

import numpy as np

from . import metrics

THRESHOLDS = (0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)


def summarise(y_true: np.ndarray, probs: np.ndarray, labels: tuple[str, ...], n_boot: int = 2000) -> dict:
    y_pred = probs.argmax(axis=1)
    scored = sorted(set(y_true.tolist()))
    f1 = lambda t, p: metrics.macro_f1(t, p, scored)  # noqa: E731
    per_class = metrics.per_class_f1(y_true, y_pred, scored)
    support = {c: int(np.sum(y_true == c)) for c in scored}
    return {
        "n_images": int(len(y_true)),
        "classes_scored": [labels[c] for c in scored],
        "classes_missing": [label for i, label in enumerate(labels) if i not in scored],
        "accuracy": metrics.accuracy(y_true, y_pred),
        "accuracy_ci95": metrics.bootstrap_ci(y_true, y_pred, metrics.accuracy, n_boot),
        "macro_f1": f1(y_true, y_pred),
        "macro_f1_ci95": metrics.bootstrap_ci(y_true, y_pred, f1, n_boot),
        "per_class": {labels[c]: {"f1": per_class[c], "support": support[c]} for c in scored},
        "confusion_matrix": metrics.confusion_matrix(y_true, y_pred, len(labels)).tolist(),
        "selective": [metrics.selective(y_true, probs, t) for t in THRESHOLDS],
    }


def to_markdown(name: str, s: dict) -> str:
    lo, hi = s["accuracy_ci95"]
    flo, fhi = s["macro_f1_ci95"]
    lines = [
        f"## {name}",
        "",
        f"{s['n_images']} images, {len(s['classes_scored'])} classes scored.",
        f"Missing from this set: {', '.join(s['classes_missing']) or 'none'}.",
        "",
        f"- Accuracy: {s['accuracy']:.1%} (95% CI {lo:.1%} to {hi:.1%})",
        f"- Macro F1: {s['macro_f1']:.3f} (95% CI {flo:.3f} to {fhi:.3f})",
        "",
        "| Class | F1 | Images |",
        "|---|---|---|",
    ]
    lines += [f"| {k} | {v['f1']:.3f} | {v['support']} |" for k, v in s["per_class"].items()]
    lines += ["", "| Threshold | Coverage | Accuracy when answering |", "|---|---|---|"]
    for sel in s["selective"]:
        acc = "n/a" if sel["n_answered"] == 0 else f"{sel['accuracy_answered']:.1%}"
        lines.append(f"| {sel['threshold']:.2f} | {sel['coverage']:.1%} | {acc} |")
    return "\n".join(lines) + "\n"
