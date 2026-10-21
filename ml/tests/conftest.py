import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def make_image(path: Path, seed: int, size: tuple[int, int] = (64, 48)) -> Path:
    """A random but reproducible RGB image, smooth enough for dHash to be stable."""
    rng = np.random.default_rng(seed)
    small = rng.integers(0, 256, (6, 8, 3), dtype=np.uint8)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(small).resize(size, Image.Resampling.BILINEAR).save(path)
    return path


@pytest.fixture
def image_factory():
    return make_image
