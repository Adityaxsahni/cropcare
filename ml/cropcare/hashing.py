"""Near-duplicate detection with a 64-bit difference hash (dHash)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


def dhash(path: Path | str, size: int = 8) -> int:
    with Image.open(path) as im:
        small = im.convert("L").resize((size + 1, size), Image.Resampling.LANCZOS)
    px = np.asarray(small, dtype=np.int16)
    bits = (px[:, 1:] > px[:, :-1]).flatten()
    return int.from_bytes(np.packbits(bits).tobytes(), "big")


def near_duplicates(
    query: np.ndarray, reference: np.ndarray, max_distance: int, chunk: int = 128
) -> list[tuple[int, int, int]]:
    """All (query_index, reference_index, hamming_distance) pairs within max_distance."""
    query = np.asarray(query, dtype=np.uint64)
    reference = np.asarray(reference, dtype=np.uint64)
    pairs: list[tuple[int, int, int]] = []
    for start in range(0, len(query), chunk):
        block = query[start : start + chunk, None] ^ reference[None, :]
        dist = np.bitwise_count(block)
        qi, ri = np.nonzero(dist <= max_distance)
        pairs.extend((int(q) + start, int(r), int(dist[q, r])) for q, r in zip(qi, ri))
    return pairs
