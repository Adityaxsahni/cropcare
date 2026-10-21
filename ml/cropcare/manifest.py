"""manifest.csv: one row per image with its label, source dataset and split.

Paths are stored relative to the data directory, with forward slashes, so the
same manifest works on Colab, Kaggle and a laptop.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

FIELDS = ("path", "label", "source", "split")
SOURCES = ("plantvillage", "plantdoc", "plantvillage_bgswap", "field")
SPLITS = ("train", "val", "test")


@dataclass(frozen=True)
class Row:
    path: str
    label: str
    source: str
    split: str

    def __post_init__(self) -> None:
        if self.source not in SOURCES:
            raise ValueError(f"unknown source {self.source!r}")
        if self.split not in SPLITS:
            raise ValueError(f"unknown split {self.split!r}")
        if self.source == "field" and self.split != "test":
            raise ValueError("field photos are test only")


def write(path: Path, rows: list[Row]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(FIELDS)
        for r in sorted(rows, key=lambda r: (r.source, r.split, r.label, r.path)):
            writer.writerow((r.path, r.label, r.source, r.split))


def read(path: Path) -> list[Row]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if tuple(reader.fieldnames or ()) != FIELDS:
            raise ValueError(f"{path}: expected columns {FIELDS}, got {reader.fieldnames}")
        return [Row(**r) for r in reader]


def select(rows: list[Row], sources: list[str], split: str) -> list[Row]:
    return [r for r in rows if r.source in sources and r.split == split]


def training_rows(rows: list[Row], sources: list[str]) -> list[Row]:
    """Rows allowed in training. Field photos are refused outright."""
    if "field" in sources:
        raise ValueError("field photos are test only and can never be used for training")
    selected = select(rows, sources, "train")
    if not selected:
        raise ValueError(f"no training rows for sources {sources}")
    return selected
