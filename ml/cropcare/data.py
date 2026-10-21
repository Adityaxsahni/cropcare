"""tf.data input pipelines. Images stay in 0 to 255 float, which MobileNetV3 expects.

Evaluation uses the same preprocessing as the app: centre square crop, then
resize to 224 x 224. Augmentation lives here, never inside the model.
"""

from __future__ import annotations

import math
from pathlib import Path

import tensorflow as tf

from . import IMG_SIZE
from .manifest import Row

AUTOTUNE = tf.data.AUTOTUNE


def decode(path: tf.Tensor) -> tf.Tensor:
    img = tf.io.decode_image(tf.io.read_file(path), channels=3, expand_animations=False)
    img.set_shape([None, None, 3])
    return tf.cast(img, tf.float32)


def center_square(img: tf.Tensor) -> tf.Tensor:
    h, w = tf.shape(img)[0], tf.shape(img)[1]
    side = tf.minimum(h, w)
    top, left = (h - side) // 2, (w - side) // 2
    return img[top : top + side, left : left + side, :]


def eval_preprocess(img: tf.Tensor) -> tf.Tensor:
    return tf.image.resize(center_square(img), [IMG_SIZE, IMG_SIZE])


def random_square_crop(img: tf.Tensor, min_fraction: float) -> tf.Tensor:
    """A random square whose side is min_fraction..1 of the image's short side."""
    short = tf.cast(tf.minimum(tf.shape(img)[0], tf.shape(img)[1]), tf.float32)
    side = tf.maximum(1, tf.cast(short * tf.random.uniform([], min_fraction, 1.0), tf.int32))
    crop = tf.image.random_crop(img, tf.stack([side, side, 3]))
    return tf.image.resize(crop, [IMG_SIZE, IMG_SIZE])


def _flip_rotate(img: tf.Tensor) -> tf.Tensor:
    img = tf.image.random_flip_left_right(img)
    img = tf.image.random_flip_up_down(img)
    return tf.image.rot90(img, tf.random.uniform([], 0, 4, dtype=tf.int32))


def _maybe(img: tf.Tensor, p: float, fn) -> tf.Tensor:
    return tf.cond(tf.random.uniform([]) < p, lambda: fn(img), lambda: img)


def gaussian_blur(img: tf.Tensor) -> tf.Tensor:
    """Separable Gaussian blur with a random sigma, reflect-padded so edges stay bright."""
    radius = 3
    sigma = tf.random.uniform([], 0.5, 1.8)
    x = tf.range(-radius, radius + 1, dtype=tf.float32)
    k = tf.exp(-(x**2) / (2.0 * sigma**2))
    k = k / tf.reduce_sum(k)
    kx = tf.tile(tf.reshape(k, [1, -1, 1, 1]), [1, 1, 3, 1])
    ky = tf.tile(tf.reshape(k, [-1, 1, 1, 1]), [1, 1, 3, 1])
    padded = tf.pad(img[None], [[0, 0], [radius, radius], [radius, radius], [0, 0]], "REFLECT")
    out = tf.nn.depthwise_conv2d(padded, kx, [1, 1, 1, 1], "VALID")
    out = tf.nn.depthwise_conv2d(out, ky, [1, 1, 1, 1], "VALID")
    return out[0]


def random_shadow(img: tf.Tensor) -> tf.Tensor:
    """Darken one side of a random soft-edged line, like the shadow of a hand or plant."""
    coords = tf.range(IMG_SIZE, dtype=tf.float32) - IMG_SIZE / 2
    yy, xx = tf.meshgrid(coords, coords, indexing="ij")
    angle = tf.random.uniform([], 0.0, 2.0 * math.pi)
    offset = tf.random.uniform([], -0.3, 0.3) * IMG_SIZE
    side = tf.sigmoid((xx * tf.cos(angle) + yy * tf.sin(angle) - offset) / 8.0)
    strength = 1.0 - tf.random.uniform([], 0.5, 0.85)
    return img * (1.0 - side[..., None] * strength)


def augment_basic(img: tf.Tensor) -> tf.Tensor:
    """Phase 2: flips, rotation, zoom, brightness, contrast."""
    img = random_square_crop(img, 0.8)
    img = _flip_rotate(img)
    img = tf.image.random_brightness(img, 0.15 * 255.0)
    img = tf.image.random_contrast(img, 0.8, 1.2)
    return tf.clip_by_value(img, 0.0, 255.0)


def augment_strong(img: tf.Tensor) -> tf.Tensor:
    """Phase 3: adds bigger crops, colour jitter, shadows, blur and JPEG artefacts."""
    img = random_square_crop(img, 0.5)
    img = _flip_rotate(img)
    img = tf.image.random_brightness(img, 0.25 * 255.0)
    img = tf.image.random_contrast(img, 0.7, 1.3)
    img = tf.clip_by_value(img / 255.0, 0.0, 1.0)
    img = tf.image.random_saturation(img, 0.6, 1.4)
    img = tf.image.random_hue(img, 0.04)
    img = _maybe(img, 0.4, random_shadow)
    img = _maybe(img, 0.3, gaussian_blur)
    img = tf.image.random_jpeg_quality(tf.clip_by_value(img, 0.0, 1.0), 30, 95)
    img.set_shape([IMG_SIZE, IMG_SIZE, 3])
    return img * 255.0


AUGMENTATIONS = {"basic": augment_basic, "strong": augment_strong}


def _fixed(img: tf.Tensor) -> tf.Tensor:
    """Restore the static shape that rot90 and JPEG re-encoding hide from Keras."""
    return tf.ensure_shape(img, [IMG_SIZE, IMG_SIZE, 3])


def _base(rows: list[Row], data_dir: Path, labels: tuple[str, ...]) -> tf.data.Dataset:
    paths = [str(Path(data_dir) / r.path) for r in rows]
    ys = [labels.index(r.label) for r in rows]
    return tf.data.Dataset.from_tensor_slices((paths, tf.constant(ys, tf.int32)))


def eval_dataset(rows: list[Row], data_dir: Path, labels: tuple[str, ...], batch: int = 64) -> tf.data.Dataset:
    ds = _base(rows, data_dir, labels)
    ds = ds.map(lambda p, y: (_fixed(eval_preprocess(decode(p))), y), num_parallel_calls=AUTOTUNE)
    return ds.batch(batch).prefetch(AUTOTUNE)


def train_dataset(
    rows_by_source: dict[str, list[Row]],
    weights: dict[str, float],
    data_dir: Path,
    labels: tuple[str, ...],
    augment: str,
    batch: int,
    seed: int,
) -> tf.data.Dataset:
    """Infinite, shuffled, augmented batches, sampling each source by `weights`."""
    fn = AUGMENTATIONS[augment]
    parts = []
    for source, rows in rows_by_source.items():
        ds = _base(rows, data_dir, labels).shuffle(len(rows), seed=seed, reshuffle_each_iteration=True).repeat()
        parts.append(ds.map(lambda p, y: (_fixed(fn(decode(p))), y), num_parallel_calls=AUTOTUNE))
    if len(parts) == 1:
        mixed = parts[0]
    else:
        w = [weights[s] for s in rows_by_source]
        mixed = tf.data.Dataset.sample_from_datasets(parts, weights=w, seed=seed)
    return mixed.batch(batch).prefetch(AUTOTUNE)
