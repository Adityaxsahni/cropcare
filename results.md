# Results

Every number below comes from a script run (imported with `scripts/import_results.py`). Blank means not measured yet. Intervals are bootstrap 95% confidence intervals.

## Data (from `ml/data_card.md`)

| Set | Images | Classes |
|---|---|---|
| PlantVillage (our 14 classes) | 20692 | 14 |
| PlantDoc train and val (our classes) | 1179 | 12 |
| PlantDoc test (our classes) | 89 | 12 |
| Own field photos | not collected yet | |

PlantDoc has no healthy potato or healthy maize photos, so the PlantDoc figures cover 12 classes.

## Phase 2: baseline (PlantVillage only)

| Test set | Accuracy (95% CI) | Macro F1 (95% CI) |
|---|---|---|
| PlantVillage test (2060 images) | 98.0% (97.4% to 98.6%) | 0.972 (0.960 to 0.981) |
| PlantDoc test (89 images) | 32.6% (23.6% to 41.6%) | 0.266 (0.170 to 0.342) |
| Field photos | | |

## Phase 3: closing the gap (selection metric: PlantDoc test macro F1)

| Technique added | PlantDoc test macro F1 (95% CI) | PlantDoc test accuracy |
|---|---|---|
| Baseline | 0.266 (0.170 to 0.342) | 32.6% |
| + PlantDoc train | 0.497 (0.384 to 0.585) | 52.8% |
| + strong augmentation | 0.496 (0.386 to 0.577) | 56.2% |
| + background swap | | |
| + class weights (without background swap) (chosen) | 0.551 (0.428 to 0.641) | 56.2% |

Unsure threshold: 0.85 (chosen on PlantDoc val, 111 images). Coverage 36.9%, accuracy on answered photos 90.2%.

Final model on field photos (run once): accuracy ___, macro F1 ___.

## Phase 4: conversion

Accuracy on 89 PlantDoc test photos. Agreement: share of 600 PlantVillage and PlantDoc test photos where the file gives the same answer as the Keras model.

| Version | Size (MB) | PlantDoc test accuracy | Agreement with Keras | Phone latency (ms, mean of 50) |
|---|---|---|---|---|
| Keras | 28.63 | 56.2% | n/a | n/a |
| float16 | 6.02 | 56.2% | 99.7% | not measured |
| Dynamic range | 3.29 | 51.7% | 96.2% | not measured |
| Full int8 | 3.50 | 38.2% | 54.8% | not measured |

Chosen file: cropcare_float16.tflite

Full int8 is never chosen for this network: small rounding errors build up through MobileNetV3's squeeze-excite gates, so its answers often differ from the Keras model's (see `ml/scripts/convert.py`).

## Phase 6 and 7: pilot

| Metric | Value |
|---|---|
| Install IDs seen | not started |
| Scans | not started |
| Share of answered scans marked correct | not started |
