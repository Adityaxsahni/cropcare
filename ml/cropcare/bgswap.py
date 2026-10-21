"""Paste segmented PlantVillage leaves onto real backgrounds (soil, hands, plants)."""

from __future__ import annotations

import random
from pathlib import PurePath

import numpy as np
from PIL import Image, ImageFilter


def leaf_mask(segmented: Image.Image, threshold: int = 12) -> Image.Image:
    """Mask of the leaf in a black-background segmented image, with soft edges."""
    arr = np.asarray(segmented.convert("RGB"))
    mask = Image.fromarray(((arr.max(axis=2) > threshold) * 255).astype(np.uint8), "L")
    # Shrink by one pixel to drop the dark fringe, then feather the edge.
    return mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.5))


def random_background_crop(background: Image.Image, size: tuple[int, int], rng: random.Random) -> Image.Image:
    bg = background.convert("RGB")
    w, h = bg.size
    target_ratio = size[0] / size[1]
    crop_w = min(w, int(h * target_ratio))
    crop_h = int(crop_w / target_ratio)
    scale = rng.uniform(0.6, 1.0)
    crop_w, crop_h = max(1, int(crop_w * scale)), max(1, int(crop_h * scale))
    x = rng.randint(0, w - crop_w)
    y = rng.randint(0, h - crop_h)
    return bg.crop((x, y, x + crop_w, y + crop_h)).resize(size, Image.Resampling.BILINEAR)


def composite(segmented: Image.Image, background: Image.Image, rng: random.Random) -> Image.Image:
    leaf = segmented.convert("RGB")
    mask = leaf_mask(leaf)
    bg = random_background_crop(background, leaf.size, rng)
    return Image.composite(leaf, bg, mask)


KNOWN_SUFFIXES = ("_final_masked",)


def image_key(path: PurePath) -> str:
    """class folder / file stem, lower case: how a segmented copy is matched to its colour original."""
    return f"{path.parent.name}/{path.stem}".lower()


def match_original(segmented: PurePath, originals: set[str], max_strip: int = 2) -> str | None:
    """Key of the colour original for a segmented file, or None.

    Tries the stem with a known suffix removed, then with up to `max_strip`
    trailing "_part" pieces removed, so an unexpected suffix such as "_mask"
    still matches. Returns the first candidate that is a known original.
    """
    stem = segmented.stem
    for suffix in KNOWN_SUFFIXES:
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
    candidates = [stem]
    for _ in range(max_strip):
        if "_" not in candidates[-1]:
            break
        candidates.append(candidates[-1].rsplit("_", 1)[0])
    for c in candidates:
        key = f"{segmented.parent.name}/{c}".lower()
        if key in originals:
            return key
    return None
