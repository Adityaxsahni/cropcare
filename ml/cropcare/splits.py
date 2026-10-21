"""Deterministic, stratified split assignment."""

from __future__ import annotations

import hashlib
from collections import defaultdict


def _key(rel_path: str, seed: str) -> str:
    return hashlib.sha1(f"{seed}:{rel_path}".encode("utf-8")).hexdigest()


def assign(
    items: list[tuple[str, str]],
    val_fraction: float,
    test_fraction: float,
    seed: str = "cropcare-v1",
) -> dict[str, str]:
    """Map each (rel_path, label) to "train", "val" or "test".

    Within each label, images are ordered by a hash of their path and cut at
    exact fractions. The result does not depend on the order of `items` and
    does not change when the data is re-prepared on another machine.
    """
    if val_fraction < 0 or test_fraction < 0 or val_fraction + test_fraction >= 1:
        raise ValueError("fractions must be non-negative and sum to less than 1")
    by_label: dict[str, list[str]] = defaultdict(list)
    for rel_path, label in items:
        by_label[label].append(rel_path)

    result: dict[str, str] = {}
    for label, paths in by_label.items():
        ordered = sorted(set(paths), key=lambda p: _key(p, seed))
        n = len(ordered)
        n_test = round(n * test_fraction)
        n_val = round(n * val_fraction)
        for i, p in enumerate(ordered):
            if i < n_test:
                result[p] = "test"
            elif i < n_test + n_val:
                result[p] = "val"
            else:
                result[p] = "train"
    return result
