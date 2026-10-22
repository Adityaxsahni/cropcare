# Project memory

## Current status (2026-10-22)
All code for Phases 1 to 6 is written and tested. The notebook ran on Colab with real data (PlantVillage, PlantDoc): Phase 2 baseline and Phase 3 runs done, results in results.md. No field photos and no background photos yet.

## Verified
- ML unit tests: 33 passing (`ml/`, no TensorFlow needed)
- Full TensorFlow pipeline run end to end on synthetic images: prepare, verify, background swap, train (both stages, strong augmentation, class weights), evaluate on three sets, tune threshold, convert, evaluate TFLite
- Colab notebook (`ml/CropCare_Colab.ipynb`) executed top to bottom outside Colab on synthetic data, from scratch and again resuming from saved models
- Backend tests: 21 passing
- App: 29 unit tests passing, typecheck and lint clean, Android bundle builds, expo-doctor 20/20
- Website: renders at 375 px and desktop with no horizontal scroll; launch gate blocks only on domain and contact email

## Not verified yet
- The app on a real phone (needs a trained model and a development build)
- Background swap on the real Kaggle segmented folder. Its file naming could not be confirmed from here (the Kaggle file listing timed out). `bg_swap.py` matches `_final_masked` and other trailing suffixes, and stops if fewer than 95% of segmented files match a colour original

## Known issues
- Phase 4 on the real model: full int8 accuracy collapsed (57.3% Keras to 30.3% on PlantDoc test) and dynamic range lost 4.5 points; no phone model chosen yet
- Unsure threshold 0.90 gives 33% coverage: the app would answer one photo in three
- Full int8 MobileNetV3 is refused by XNNPACK because of a dead squeeze-excite layer; handled in `convert.py` (see README, Known limitations)

## Next step
Find why int8 conversion loses so much accuracy, then rerun Phase 4. Collect field photos and background photos.
