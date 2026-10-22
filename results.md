# Results

Every number below was produced by the project scripts (run through `ml/CropCare_Colab.ipynb` on Colab). A blank or "not measured" means the step has not been run yet. Intervals are bootstrap 95% confidence intervals.

## Data (from [`ml/data_card.md`](ml/data_card.md))

| Set | Images | Classes |
|---|---|---|
| PlantVillage (our 14 classes) | 20,692 (16,571 train, 2,061 val, 2,060 test) | 14 |
| PlantDoc train (our classes) | 1,179 (1,068 train, 111 val) | 12 |
| PlantDoc test (our classes) | 89 | 12 |
| Own field photos | not collected yet | |

PlantDoc has no healthy potato or healthy maize photos, so the PlantDoc figures cover 12 classes. The PlantDoc test folders hold 101 photos of our classes; 12 were removed by the unreadable-image or near-duplicate checks (see `leakage_pairs.csv`).

## Phase 2: baseline (PlantVillage only)

| Test set | Accuracy (95% CI) | Macro F1 (95% CI) |
|---|---|---|
| PlantVillage test (2,060 images) | 98.0% (97.3% to 98.6%) | 0.972 (0.961 to 0.982) |
| PlantDoc test (89 images) | 31.5% (22.5% to 41.6%) | 0.241 (0.158 to 0.312) |
| Field photos | not measured (no field photos yet) | |

## Phase 3: closing the gap (selection metric: PlantDoc test macro F1)

| Technique | PlantDoc test macro F1 (95% CI) | PlantDoc test accuracy |
|---|---|---|
| Baseline (PlantVillage only) | 0.241 (0.158 to 0.312) | 31.5% |
| + PlantDoc train (mixed 0.6 / 0.4) | **0.555 (0.438 to 0.640)** | **57.3%** |
| + strong augmentation | 0.515 (0.395 to 0.606) | 55.1% |
| + background swap | not run (no background photos yet) | |
| + class weights (with strong augmentation, without background swap) | 0.516 (0.394 to 0.603) | 53.9% |

Best run: mixed PlantVillage + PlantDoc. Its interval does not overlap the baseline's, so the gain is real. Strong augmentation and class weights fall inside the mixed run's interval: no measurable effect on this test set.

Unsure threshold: 0.90, chosen on PlantDoc val (111 images) for 90% accuracy on answered photos. Coverage 33.3%, accuracy on answered photos 91.9%.

Final model on field photos (run once): not measured yet.

## Phase 4: conversion

Measured on PlantDoc test (89 images), because there are no field photos yet.

| Version | Size (MB) | PlantDoc test accuracy | Phone latency (ms, mean of 50) |
|---|---|---|---|
| Keras | 28.63 | 57.3% | n/a |
| Dynamic range | 3.32 | 52.8% | not measured |
| Full int8 | 3.53 | 30.3% | not measured |

Chosen file: none yet. Neither file stays within 2 points of the Keras model. The int8 drop is far larger than test-set noise and is being investigated.

## Phase 6 and 7: pilot

| Metric | Value |
|---|---|
| Install IDs seen | not started |
| Scans | not started |
| Share of answered scans marked correct | not started |
