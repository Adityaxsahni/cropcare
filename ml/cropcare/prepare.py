"""Build manifest rows from the raw PlantVillage, PlantDoc and field-photo folders."""

from __future__ import annotations

import csv
from pathlib import Path

from . import splits
from .classes import ClassMap
from .manifest import Row

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp"}  # formats tf.io.decode_image reads
FIELD_COLUMNS = ("filename", "label", "labelled_by", "date", "place")


def _rel(path: Path, data_dir: Path) -> str:
    try:
        return path.resolve().relative_to(data_dir.resolve()).as_posix()
    except ValueError as e:
        raise ValueError(f"{path} is not inside the data directory {data_dir}") from e


def list_images(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def scan_class_folders(root: Path, dataset: str, cmap: ClassMap) -> list[tuple[Path, str]]:
    """(image path, label) for every image in a mapped class folder under root."""
    if not root.is_dir():
        raise FileNotFoundError(f"{dataset} folder not found: {root}")
    found = []
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        label = cmap.map_folder(dataset, folder.name)
        if label is None:
            continue
        found.extend((img, label) for img in list_images(folder))
    return found


def plantvillage_rows(root: Path, data_dir: Path, cmap: ClassMap, seed: str) -> list[Row]:
    found = scan_class_folders(root, "plantvillage", cmap)
    keys = {img: img.relative_to(root).as_posix() for img, _ in found}
    assignment = splits.assign([(keys[img], label) for img, label in found], 0.1, 0.1, seed)
    return [Row(_rel(img, data_dir), label, "plantvillage", assignment[keys[img]]) for img, label in found]


def plantdoc_rows(root: Path, data_dir: Path, cmap: ClassMap, seed: str) -> list[Row]:
    rows = []
    train = scan_class_folders(root / "train", "plantdoc", cmap)
    keys = {img: img.relative_to(root).as_posix() for img, _ in train}
    assignment = splits.assign([(keys[img], label) for img, label in train], 0.1, 0.0, seed)
    rows += [Row(_rel(img, data_dir), label, "plantdoc", assignment[keys[img]]) for img, label in train]
    rows += [Row(_rel(img, data_dir), label, "plantdoc", "test") for img, label in scan_class_folders(root / "test", "plantdoc", cmap)]
    return rows


def field_rows(field_dir: Path, data_dir: Path, cmap: ClassMap) -> list[Row]:
    """Rows from field_dir/labels.csv. Every photo needs a label and who labelled it."""
    labels_csv = field_dir / "labels.csv"
    # utf-8-sig: Excel starts its CSV files with a byte-order mark that would otherwise hide "filename".
    with open(labels_csv, newline="", encoding="utf-8-sig") as f:
        text = f.read()
    header = text.splitlines()[0] if text else ""
    delimiter = ";" if header.count(";") > header.count(",") else ","  # Excel in some locales uses ;
    reader = csv.DictReader(text.splitlines(), delimiter=delimiter)
    fieldnames = [(name or "").strip().lower() for name in reader.fieldnames or ()]
    missing = set(FIELD_COLUMNS) - set(fieldnames)
    if missing:
        raise ValueError(f"{labels_csv}: missing columns {sorted(missing)} (found {fieldnames})")
    records = []
    for raw in reader:
        rec = {k: (v or "").strip() for k, v in zip(fieldnames, raw.values())}
        if any(rec.values()):  # skip blank lines Excel leaves at the end
            records.append(rec)
    rows, errors = [], []
    for line, rec in enumerate(records, start=2):
        img = field_dir / "images" / rec["filename"]
        if rec["label"] not in cmap.labels:
            errors.append(f"line {line}: unknown label {rec['label']!r}")
        elif not rec["labelled_by"].strip():
            errors.append(f"line {line}: labelled_by is empty")
        elif not img.is_file():
            errors.append(f"line {line}: image not found {img}")
        else:
            rows.append(Row(_rel(img, data_dir), rec["label"], "field", "test"))
    if errors:
        raise ValueError(f"{labels_csv} has problems:\n  " + "\n  ".join(errors))
    return rows
