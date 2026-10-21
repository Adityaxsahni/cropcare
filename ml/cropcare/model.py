"""MobileNetV3-Large transfer-learning model, as in the build plan."""

from __future__ import annotations

import tensorflow as tf

from . import IMG_SIZE


def build(num_classes: int, dropout: float = 0.3) -> tuple[tf.keras.Model, tf.keras.Model]:
    base = tf.keras.applications.MobileNetV3Large(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
        pooling="avg",
    )  # includes its own rescaling, so it takes 0 to 255 pixel values
    base.trainable = False
    inputs = tf.keras.Input((IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = tf.keras.layers.Dropout(dropout)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs), base


def compile_head(model: tf.keras.Model) -> None:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )


def unfreeze_top(model: tf.keras.Model, base: tf.keras.Model, n_layers: int = 40) -> None:
    """Stage 2: train the top n layers of the base slowly. BatchNorm stays in inference mode
    because the base is called with training=False."""
    base.trainable = True
    for layer in base.layers[:-n_layers]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
