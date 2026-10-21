"""The 14 CropCare labels and the mapping from dataset folder names to them."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

CLASS_MAP_PATH = Path(__file__).resolve().parent.parent / "class_map.json"
DATASETS = ("plantvillage", "plantdoc")


class UnknownFolderError(ValueError):
    """A folder belongs to one of our crops but is neither mapped nor excluded."""


@dataclass(frozen=True)
class ClassMap:
    labels: tuple[str, ...]
    mappings: dict[str, dict[str, str]]
    excluded: dict[str, frozenset[str]]
    prefixes: dict[str, tuple[str, ...]]

    @classmethod
    def load(cls, path: Path = CLASS_MAP_PATH) -> "ClassMap":
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
        labels = tuple(raw["labels"])
        if len(set(labels)) != len(labels):
            raise ValueError("class_map.json: duplicate labels")
        mappings = {d: dict(raw[d]) for d in DATASETS}
        for dataset, mapping in mappings.items():
            unknown = set(mapping.values()) - set(labels)
            if unknown:
                raise ValueError(f"class_map.json: {dataset} maps to unknown labels {sorted(unknown)}")
        excluded = {d: frozenset(raw[f"{d}_excluded"]) for d in DATASETS}
        for dataset in DATASETS:
            both = excluded[dataset] & set(mappings[dataset])
            if both:
                raise ValueError(f"class_map.json: {dataset} folders both mapped and excluded: {sorted(both)}")
        prefixes = {d: tuple(raw["crop_prefixes"][d]) for d in DATASETS}
        return cls(labels, mappings, excluded, prefixes)

    def index(self, label: str) -> int:
        return self.labels.index(label)

    def map_folder(self, dataset: str, folder: str) -> str | None:
        """Return our label for a dataset folder, or None if the folder is not used.

        Raises UnknownFolderError for a folder of one of our crops that the class
        map does not mention, so a renamed or new class is never dropped silently.
        """
        if folder in self.mappings[dataset]:
            return self.mappings[dataset][folder]
        if folder in self.excluded[dataset]:
            return None
        if folder.lower().startswith(tuple(p.lower() for p in self.prefixes[dataset])):
            raise UnknownFolderError(
                f"{dataset} folder '{folder}' is a tomato, potato or maize class that "
                "class_map.json neither maps nor excludes. Add it to one of them."
            )
        return None

    def labels_in(self, dataset: str) -> list[str]:
        present = set(self.mappings[dataset].values())
        return [label for label in self.labels if label in present]
