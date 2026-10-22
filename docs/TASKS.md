# Tasks

## Phase 0: Scope
- [x] Final class list (14 classes, `ml/class_map.json`)

## Phase 1: Data
- [x] Class map for PlantVillage (TFDS and Kaggle names) and PlantDoc
- [x] `prepare_data.py`, `verify_images.py`, `check_leakage.py`, `data_card.py`
- [x] Colab notebook that runs Phases 1 to 4 (`ml/CropCare_Colab.ipynb`)
- [x] Download PlantVillage and PlantDoc, run the scripts, commit `ml/data_card.md`
- [ ] Collect 150 to 300 field photos with labels and labeller names (at least 20 healthy potato and 20 healthy maize, see ADR-002)

## Phase 2: Baseline
- [x] `train.py`, `evaluate.py` with bootstrap confidence intervals
- [x] Train the baseline; record PlantVillage and PlantDoc numbers in `results.md`
- [ ] Baseline on field photos (needs field photos)

## Phase 3: Close the gap
- [x] Mixed sources, strong augmentation, background swap, class weights, unsure threshold
- [x] Run each technique; record PlantDoc test macro F1 (background swap waits for background photos)
- [x] Tune threshold on PlantDoc val (0.85)
- [ ] Run the final model once on field photos (needs field photos)

## Phase 4: Convert
- [x] `convert.py` with XNNPACK check and float fallback
- [x] Convert the final model; record size and accuracy; choose a file (float16, 6.0 MB)

## Phase 5: App
- [x] Home, camera, result, unsure, history, about screens in Hindi and English
- [x] Draft treatment advice (`app/assets/advice.json`)
- [ ] Expert review of advice
- [ ] Development build on a real phone; airplane-mode test; measure speed over 50 photos

## Phase 6: Backend
- [x] `/feedback`, `/stats`, `/advice/version`, `/advice`
- [x] Deploy with Postgres; set `EXPO_PUBLIC_API_URL` (Render, Singapore)

## Phase 7: Pilot
- [ ] 10 to 20 phones; observe 3 users; fix the worst problem; read `/stats` after two weeks

## Phase 8: Ship
- [ ] Connect custom domain; fill privacy contact; pass `scripts/check_launch.py`
- [ ] README screenshot, 60-second airplane-mode demo, APK in GitHub Releases
