import random
from collections import Counter

import pytest

from cropcare import manifest, splits
from cropcare.manifest import Row


def _items():
    return [(f"{label}/img_{i}.jpg", label) for label in ("a", "b") for i in range(100)] + [
        (f"c/img_{i}.jpg", "c") for i in range(7)
    ]


def test_split_is_deterministic_and_order_independent():
    items = _items()
    shuffled = items[:]
    random.Random(1).shuffle(shuffled)
    assert splits.assign(items, 0.1, 0.1) == splits.assign(shuffled, 0.1, 0.1)


def test_split_is_stratified_with_exact_fractions():
    result = splits.assign(_items(), 0.1, 0.1)
    for label in ("a", "b"):
        counts = Counter(s for p, s in result.items() if p.startswith(f"{label}/"))
        assert counts == {"train": 80, "val": 10, "test": 10}
    small = Counter(s for p, s in result.items() if p.startswith("c/"))
    assert small == {"train": 5, "val": 1, "test": 1}


def test_seed_changes_the_split():
    assert splits.assign(_items(), 0.1, 0.1, "x") != splits.assign(_items(), 0.1, 0.1, "y")


def test_bad_fractions_rejected():
    with pytest.raises(ValueError):
        splits.assign(_items(), 0.5, 0.5)


def test_field_rows_are_test_only():
    with pytest.raises(ValueError):
        Row("field/images/a.jpg", "tomato_healthy", "field", "train")


def test_training_refuses_field_source():
    rows = [Row("x.jpg", "tomato_healthy", "plantvillage", "train")]
    with pytest.raises(ValueError, match="test only"):
        manifest.training_rows(rows, ["plantvillage", "field"])


def test_training_rows_only_train_split():
    rows = [
        Row("a.jpg", "tomato_healthy", "plantvillage", "train"),
        Row("b.jpg", "tomato_healthy", "plantvillage", "test"),
        Row("c.jpg", "tomato_healthy", "plantdoc", "train"),
    ]
    assert manifest.training_rows(rows, ["plantvillage"]) == [rows[0]]


def test_manifest_round_trip(tmp_path):
    rows = [Row("a.jpg", "tomato_healthy", "plantvillage", "train"), Row("b.jpg", "maize_healthy", "field", "test")]
    path = tmp_path / "manifest.csv"
    manifest.write(path, rows)
    assert sorted(manifest.read(path), key=lambda r: r.path) == rows
