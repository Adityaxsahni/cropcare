"""Install the results zip from the Colab notebook into this repository.

  python scripts/import_results.py path/to/cropcare_results.zip

It does three things, and prints each one:
  - copies the chosen model and its metadata to app/assets/model/
    (after checking the labels match ml/class_map.json)
  - copies the data card to ml/data_card.md
  - rewrites results.md from the measured numbers. Values typed in by hand
    (phone latency, pilot figures) are kept.

Use --dry-run to see what would change without writing anything.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TECHNIQUES = {
    "p2_baseline": "Baseline",
    "p3_1_mixed": "+ PlantDoc train",
    "p3_2_strong": "+ strong augmentation",
    "p3_3_bgswap": "+ background swap",
    "p3_4_weights": "+ class weights",
}
VERSIONS = {"Keras (.keras file)": "Keras", "TFLite float16": "float16", "TFLite dynamic": "Dynamic range",
            "TFLite int8": "Full int8"}


def pct(x: float) -> str:
    return f"{x:.1%}"


def acc_ci(r: dict) -> str:
    lo, hi = r["accuracy_ci95"]
    return f"{pct(r['accuracy'])} ({pct(lo)} to {pct(hi)})"


def f1_ci(r: dict) -> str:
    lo, hi = r["macro_f1_ci95"]
    return f"{r['macro_f1']:.3f} ({lo:.3f} to {hi:.3f})"


class Bundle:
    def __init__(self, path: Path) -> None:
        self.zip = zipfile.ZipFile(path)
        self.names = set(self.zip.namelist())
        self.info = self.json("info.json") or {}

    def json(self, name: str) -> dict | None:
        return json.loads(self.zip.read(name)) if name in self.names else None

    def text(self, name: str) -> str | None:
        return self.zip.read(name).decode("utf-8") if name in self.names else None

    def eval(self, run: str, source: str) -> dict | None:
        return self.json(f"runs/{run}/eval_{source}_test.json")


def kept_values(old: str) -> tuple[dict[str, str], str]:
    """Hand-entered phone latencies by version, and the pilot section, from the current results.md."""
    latency = {}
    for version in VERSIONS.values():
        m = re.search(rf"^\| {re.escape(version)} \|[^\n]*\| ([^|\n]*) \|\s*$", old, re.M)
        if m and m.group(1).strip():
            latency[version] = m.group(1).strip()
    i = old.find("## Phase 6 and 7")
    pilot = old[i:] if i >= 0 else (
        "## Phase 6 and 7: pilot\n\n| Metric | Value |\n|---|---|\n| Install IDs seen | |\n| Scans | |\n"
        "| Share of answered scans marked correct | |\n"
    )
    return latency, pilot


def data_table(b: Bundle) -> list[str]:
    counts: Counter = Counter()
    field_classes: set[str] = set()
    if "manifest.csv" in b.names:
        for r in csv.DictReader(io.StringIO(b.text("manifest.csv"))):
            if r["source"] == "plantvillage":
                counts["pv"] += 1
            elif r["source"] == "plantdoc":
                counts["pd_test" if r["split"] == "test" else "pd_train"] += 1
            elif r["source"] == "field":
                counts["field"] += 1
                field_classes.add(r["label"])
    has = "manifest.csv" in b.names
    show = lambda k: str(counts[k]) if has else "___"  # noqa: E731
    return [
        "## Data (from `ml/data_card.md`)", "",
        "| Set | Images | Classes |", "|---|---|---|",
        f"| PlantVillage (our 14 classes) | {show('pv')} | 14 |",
        f"| PlantDoc train and val (our classes) | {show('pd_train')} | 12 |",
        f"| PlantDoc test (our classes) | {show('pd_test')} | 12 |",
        f"| Own field photos | {show('field')} | {len(field_classes) if has else '___'} |" if counts["field"] or not has else
        "| Own field photos | not collected yet | |",
        "", "PlantDoc has no healthy potato or healthy maize photos, so the PlantDoc figures cover 12 classes.",
    ]


def render(b: Bundle, old: str) -> str:
    latency, pilot = kept_values(old)
    best = b.info.get("best_run")
    lines = [
        "# Results", "",
        "Every number below comes from a script run (imported with `scripts/import_results.py`). "
        "Blank means not measured yet. Intervals are bootstrap 95% confidence intervals.", "",
        *data_table(b), "",
        "## Phase 2: baseline (PlantVillage only)", "",
        "| Test set | Accuracy (95% CI) | Macro F1 (95% CI) |", "|---|---|---|",
    ]
    for source, label in (("plantvillage", "PlantVillage test"), ("plantdoc", "PlantDoc test"), ("field", "Field photos")):
        r = b.eval("p2_baseline", source)
        lines.append(f"| {label} ({r['n_images']} images) | {acc_ci(r)} | {f1_ci(r)} |" if r else f"| {label} | | |")

    lines += ["", "## Phase 3: closing the gap (selection metric: PlantDoc test macro F1)", "",
              "| Technique added | PlantDoc test macro F1 (95% CI) | PlantDoc test accuracy |", "|---|---|---|"]
    for run, label in TECHNIQUES.items():
        r = b.eval(run, "plantdoc")
        cfg = b.json(f"runs/{run}/run_config.json") or {}
        if run == "p3_4_weights" and cfg and "plantvillage_bgswap" not in cfg.get("sources", []):
            label += " (without background swap)"
        if run == best:
            label += " (chosen)"
        lines.append(f"| {label} | {f1_ci(r)} | {pct(r['accuracy'])} |" if r else f"| {label} | | |")

    th = b.json(f"runs/{best}/threshold.json") if best else None
    lines.append("")
    if th:
        row = next(x for x in th["table"] if abs(x["threshold"] - th["threshold"]) < 1e-9)
        lines.append(f"Unsure threshold: {th['threshold']:.2f} (chosen on PlantDoc val, {th['n_val']} images). "
                     f"Coverage {pct(row['coverage'])}, accuracy on answered photos {pct(row['accuracy_answered'])}.")
    else:
        lines.append("Unsure threshold: ___ (chosen on PlantDoc val). Coverage ___%, accuracy on answered photos ___%.")
    marker = b.json("final_field_test.json")
    # The marker path uses / on Colab and \ on Windows.
    final = b.eval(best, "field") if best and marker and re.split(r"[\\/]", marker["model"])[-2:-1] == [best] else None
    lines += ["", f"Final model on field photos (run once): accuracy {acc_ci(final)}, macro F1 {f1_ci(final)}, "
                  f"{final['n_images']} photos." if final else
              "Final model on field photos (run once): accuracy ___, macro F1 ___."]

    conv = b.json(f"runs/{best}/export/conversion.json") if best else None
    on = "Field accuracy" if not conv or conv["eval_source"] == "field" else "PlantDoc test accuracy"
    lines += ["", "## Phase 4: conversion", ""]
    if conv and conv.get("agreement_images"):
        source = "field" if conv["eval_source"] == "field" else "PlantDoc test"
        lines += [f"Accuracy on {conv['n_images']} {source} photos. Agreement: share of {conv['agreement_images']} PlantVillage and "
                  "PlantDoc test photos where the file gives the same answer as the Keras model.", ""]
    lines += [f"| Version | Size (MB) | {on} | Agreement with Keras | Phone latency (ms, mean of 50) |", "|---|---|---|---|---|"]
    by_name = {VERSIONS.get(r["name"], r["name"]): r for r in (conv or {}).get("rows", [])}
    for version in VERSIONS.values():
        r = by_name.get(version)
        lat = "n/a" if version == "Keras" else latency.get(version, "not measured")
        agree = "n/a" if version == "Keras" else pct(r["agreement_with_keras"]) if r and r.get("agreement_with_keras") is not None else ""
        lines.append(f"| {version} | {r['size_bytes'] / 1e6:.2f} | {pct(r['accuracy'])} | {agree} | {lat} |" if r else
                     f"| {version} | | | {agree} | {lat} |")
    chosen = b.info.get("chosen_file")
    lines += ["", f"Chosen file: {chosen or '___'}"]
    if "Full int8" in by_name:
        lines += ["", "Full int8 is never chosen for this network: small rounding errors build up through MobileNetV3's "
                  "squeeze-excite gates, so its answers often differ from the Keras model's (see `ml/scripts/convert.py`)."]
    lines += ["", pilot.rstrip("\n")]
    return "\n".join(lines) + "\n"


def check_model(b: Bundle) -> list[str]:
    problems = []
    meta = b.json("app_model/model_meta.json")
    if meta is None or "app_model/cropcare.tflite" not in b.names:
        return ["no chosen model in the zip (Phase 4 did not pick a file)"]
    labels = json.loads((ROOT / "ml/class_map.json").read_text(encoding="utf-8"))["labels"]
    if meta.get("labels") != labels:
        problems.append("model_meta.json labels do not match ml/class_map.json")
    if str(meta.get("version", "")).startswith("0.0.0"):
        problems.append(f"model version {meta.get('version')!r} looks like a test model")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("zip", type=Path)
    ap.add_argument("--repo", type=Path, default=ROOT, help=argparse.SUPPRESS)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.zip.is_file():
        print(f"error: {args.zip} not found")
        return 1
    b = Bundle(args.zip)
    repo = args.repo

    problems = check_model(b)
    if problems:
        print("Model: not installed:")
        for p in problems:
            print(f"  - {p}")
    else:
        meta = b.json("app_model/model_meta.json")
        print(f"Model: {b.info.get('chosen_file')} version {meta['version']} -> app/assets/model/")
        if not args.dry_run:
            dest = repo / "app/assets/model"
            dest.mkdir(parents=True, exist_ok=True)
            (dest / "cropcare.tflite").write_bytes(b.zip.read("app_model/cropcare.tflite"))
            (dest / "model_meta.json").write_bytes(b.zip.read("app_model/model_meta.json"))

    card = b.text("data_card.md")
    if card:
        print("Data card -> ml/data_card.md")
        if not args.dry_run:
            (repo / "ml/data_card.md").write_text(card, encoding="utf-8")

    results_path = repo / "results.md"
    new = render(b, results_path.read_text(encoding="utf-8") if results_path.is_file() else "")
    print("results.md rewritten from the measured numbers" + (" (dry run, printed below)" if args.dry_run else ""))
    if args.dry_run:
        print(new)
    else:
        results_path.write_text(new, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
