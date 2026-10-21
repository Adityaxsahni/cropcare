# Decisions

## ADR-001: 14 classes across tomato, potato and maize
Reason: grown in Bihar and present in PlantVillage. Rice and wheat lack good public field datasets and move to version 2.

## ADR-002: Potato healthy and maize healthy have no PlantDoc images
Checked on 2026-10-22 against `pratikkayal/PlantDoc-Dataset`: there is no healthy potato folder and no healthy corn folder in either split. Consequences:
- These two classes are trained on PlantVillage only (plus background-swapped PlantVillage).
- PlantDoc test macro F1 is computed over the 12 classes that exist there. `evaluate.py` reports which classes were scored.
- Our own field photos are the only real-world test for these two classes, so collect at least 20 of each.

## ADR-003: PlantDoc test split is small, so every number carries a confidence interval
For our 12 classes the PlantDoc test split has about 101 images (Corn Gray leaf spot has 4). A single accuracy figure on this set can move several points by chance. `evaluate.py` prints a bootstrap 95% interval next to every accuracy and macro F1.

## ADR-004: Model selection on PlantDoc test, final number on field photos
Following the build plan: compare Phase 3 techniques by macro F1 on the PlantDoc test split. Because that makes PlantDoc test a selection set, the honest final number is the field-photo set, run once at the end. A PlantDoc validation split (10% of PlantDoc train) is used for checkpointing during training.

## ADR-005: MobileNetV3-Large with built-in preprocessing
Designed for phones; the Keras version takes 0 to 255 pixel values, so the app passes raw RGB bytes. Augmentation lives in the `tf.data` pipeline, not the model, so conversion stays simple.

## ADR-006: Splits recorded once in a manifest
PlantVillage has no official test split. `prepare_data.py` assigns each image to train, val or test from a hash of its file name, which is deterministic and survives re-runs. Near-duplicate photos across splits are found with a 64-bit difference hash in `check_leakage.py`.

## ADR-007: Model metadata travels with the model
`convert.py` writes `model_meta.json` (label order, input and output types, quantization scale and zero point, unsure threshold, version). The app reads it instead of hardcoding anything, so a new model cannot silently mismatch the labels.

## ADR-008: Frame-processor capture with a centre square crop
The app crops the centre square of the camera frame (side = shorter frame edge) and resizes to 224 x 224. The centre square is the same region whatever the sensor orientation, and training uses 90 degree rotations, so frame rotation does not need correcting.

## ADR-009: Backend database through DATABASE_URL
SQLite for local development. Render's free web services have no persistent disk, so SQLite there would lose every scan on restart. Production uses a free Postgres (Render Postgres, Neon or Supabase) through `DATABASE_URL`.

## ADR-010: Upload only with consent, default off
The app asks once whether to share anonymous results. Until the farmer says yes, nothing leaves the phone. The install ID is a random UUID made by the app, not a device identifier.

## ADR-011: Treatment advice is a draft until reviewed
`advice.json` was drafted from general extension practice and carries `"reviewed": false`. The app shows a visible "not yet checked by an expert" notice until a named reviewer signs off. No pesticide doses are written from memory.
