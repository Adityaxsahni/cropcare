import importlib.util
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("import_results", ROOT / "scripts/import_results.py")
ir = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ir)

EVAL = {"n_images": 100, "accuracy": 0.8, "accuracy_ci95": [0.7, 0.88], "macro_f1": 0.75, "macro_f1_ci95": [0.65, 0.84]}
OLD = """# Results
| Dynamic range | 3.29 | 80.0% | 41 |
## Phase 6 and 7: pilot

| Metric | Value |
|---|---|
| Scans | 250 |
"""


def make_zip(path: Path, with_model: bool) -> Path:
    labels = json.loads((ROOT / "ml/class_map.json").read_text(encoding="utf-8"))["labels"]
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("info.json", json.dumps({"best_run": "p3_2_strong", "chosen_file": "cropcare_dynamic.tflite" if with_model else None}))
        z.writestr("runs/p2_baseline/eval_plantdoc_test.json", json.dumps(EVAL))
        z.writestr("runs/p3_2_strong/eval_plantdoc_test.json", json.dumps({**EVAL, "macro_f1": 0.81}))
        z.writestr("runs/p3_2_strong/eval_field_test.json", json.dumps({**EVAL, "accuracy": 0.7}))
        z.writestr("final_field_test.json", json.dumps({"model": "/content/drive/MyDrive/cropcare/runs/p3_2_strong/model.keras"}))
        z.writestr("runs/p3_2_strong/threshold.json", json.dumps(
            {"threshold": 0.6, "n_val": 120, "table": [{"threshold": 0.6, "coverage": 0.85, "accuracy_answered": 0.91}]}))
        z.writestr("runs/p3_2_strong/export/conversion.json", json.dumps({
            "eval_source": "field", "n_images": 100, "agreement_images": 600, "rows": [
                {"name": "Keras (.keras file)", "size_bytes": 28_000_000, "accuracy": 0.7, "agreement_with_keras": None},
                {"name": "TFLite dynamic", "size_bytes": 3_300_000, "accuracy": 0.69, "agreement_with_keras": 0.62},
                {"name": "TFLite float16", "size_bytes": 6_000_000, "accuracy": 0.7, "agreement_with_keras": 0.995},
            ]}))
        if with_model:
            z.writestr("app_model/cropcare.tflite", b"model")
            z.writestr("app_model/model_meta.json", json.dumps({"version": "1.0.0", "labels": labels}))
    return path


def test_render_fills_measured_numbers_and_keeps_hand_entries(tmp_path):
    text = ir.render(ir.Bundle(make_zip(tmp_path / "r.zip", True)), OLD)
    assert "| + strong augmentation (chosen) | 0.810 (0.650 to 0.840) | 80.0% |" in text
    assert "| Baseline | 0.750 (0.650 to 0.840) | 80.0% |" in text
    assert "| + PlantDoc train | | |" in text  # not run: left blank
    assert "Unsure threshold: 0.60 (chosen on PlantDoc val, 120 images). Coverage 85.0%" in text
    assert "Final model on field photos (run once): accuracy 70.0% (70.0% to 88.0%)" in text
    assert "| Dynamic range | 3.30 | 69.0% | 62.0% | 41 |" in text  # latency typed by hand is kept
    assert "| float16 | 6.00 | 70.0% | 99.5% | not measured |" in text
    assert "| Keras | 28.00 | 70.0% | n/a | n/a |" in text
    assert "| Full int8 | | |  | not measured |" in text and "never chosen" not in text  # int8 not in this zip
    assert "| Scans | 250 |" in text  # pilot section is kept
    assert "Chosen file: cropcare_dynamic.tflite" in text


def test_model_checks(tmp_path):
    assert ir.check_model(ir.Bundle(make_zip(tmp_path / "a.zip", True))) == []
    assert ir.check_model(ir.Bundle(make_zip(tmp_path / "b.zip", False))) == ["no chosen model in the zip (Phase 4 did not pick a file)"]
