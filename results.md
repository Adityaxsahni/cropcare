# Results

Every number below is filled in only after the script that produces it has been run. Blank means not measured yet.

## Data (from `ml/data_card.md`)

| Set | Images | Classes |
|---|---|---|
| PlantVillage (our 14 classes) | ___ | 14 |
| PlantDoc train (our classes) | ___ | 12 |
| PlantDoc test (our classes) | ___ | 12 |
| Own field photos | ___ | ___ |

## Phase 2: baseline (PlantVillage only)

| Test set | Accuracy (95% CI) | Macro F1 (95% CI) |
|---|---|---|
| PlantVillage test | | |
| PlantDoc test | | |
| Field photos | | |

## Phase 3: closing the gap (selection metric: PlantDoc test macro F1)

| Technique added | PlantDoc test macro F1 (95% CI) | PlantDoc test accuracy |
|---|---|---|
| Baseline | | |
| + PlantDoc train | | |
| + strong augmentation | | |
| + background swap | | |
| + class weights | | |

Unsure threshold: ___ (chosen on PlantDoc val). Coverage ___%, accuracy on answered photos ___%.

Final model on field photos (run once): accuracy ___, macro F1 ___.

## Phase 4: conversion

| Version | Size (MB) | Field accuracy | Phone latency (ms, mean of 50) |
|---|---|---|---|
| Keras | | | n/a |
| Dynamic range | | | |
| Full int8 | | | |

Chosen file: ___

## Phase 6 and 7: pilot

| Metric | Value |
|---|---|
| Install IDs seen | |
| Scans | |
| Share of answered scans marked correct | |
