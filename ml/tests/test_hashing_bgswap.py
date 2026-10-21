import random

import numpy as np
from PIL import Image

from cropcare import bgswap, hashing


def test_resized_copy_is_a_near_duplicate(tmp_path, image_factory):
    a = image_factory(tmp_path / "a.png", seed=1, size=(256, 256))
    with Image.open(a) as im:
        im.resize((120, 120)).save(tmp_path / "a_small.jpg", quality=80)
    b = image_factory(tmp_path / "b.png", seed=2, size=(256, 256))
    ha, ha_small, hb = (hashing.dhash(p) for p in (a, tmp_path / "a_small.jpg", b))
    pairs = hashing.near_duplicates(np.array([ha_small, hb], dtype=np.uint64), np.array([ha], dtype=np.uint64), 4)
    assert [(q, r) for q, r, _ in pairs] == [(0, 0)]


def test_near_duplicates_distance_is_hamming():
    q = np.array([0b1011], dtype=np.uint64)
    r = np.array([0b0000, 0b1011, 0b1111], dtype=np.uint64)
    assert hashing.near_duplicates(q, r, 64) == [(0, 0, 3), (0, 1, 0), (0, 2, 1)]


def test_near_duplicates_across_chunks():
    q = np.arange(300, dtype=np.uint64)
    pairs = hashing.near_duplicates(q, q, 0, chunk=128)
    assert pairs == [(i, i, 0) for i in range(300)]


def test_background_swap_keeps_leaf_and_replaces_background():
    seg = np.zeros((100, 100, 3), dtype=np.uint8)
    seg[30:70, 30:70] = (40, 160, 40)  # green leaf on black
    background = Image.new("RGB", (300, 200), (150, 100, 60))  # brown soil
    out = np.asarray(bgswap.composite(Image.fromarray(seg), background, random.Random(0)))
    assert tuple(out[50, 50]) == (40, 160, 40)
    assert tuple(out[5, 5]) == (150, 100, 60)
