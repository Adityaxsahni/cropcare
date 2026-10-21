"""Class weights for training batches mixed from several sources."""

from __future__ import annotations

from collections import Counter

from .manifest import Row


def effective_class_weights(
    rows_by_source: dict[str, list[Row]], weights: dict[str, float], labels: tuple[str, ...]
) -> dict[int, float]:
    """Inverse of each class's share of the batches actually sampled, normalised to mean 1."""
    share = {label: 0.0 for label in labels}
    for source, rows in rows_by_source.items():
        counts = Counter(r.label for r in rows)
        for label, n in counts.items():
            share[label] += weights[source] * n / len(rows)
    raw = {labels.index(label): 1.0 / s for label, s in share.items() if s > 0}
    mean = sum(raw.values()) / len(raw)
    # Classes never sampled get weight 1; Keras wants an entry for every class.
    return {i: raw[i] / mean if i in raw else 1.0 for i in range(len(labels))}
