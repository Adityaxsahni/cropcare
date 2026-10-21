# Project memory

## Current status (2026-10-22)
All code for Phases 1 to 6 is written and tested. No real data has been downloaded and no model trained.

## Verified
- ML unit tests: 31 passing (`ml/`, no TensorFlow needed)
- Full TensorFlow pipeline run end to end on synthetic images: prepare, verify, background swap, train (both stages, strong augmentation, class weights), evaluate on three sets, tune threshold, convert, evaluate TFLite
- Backend tests: 21 passing
- App: 29 unit tests passing, typecheck and lint clean, Android bundle builds, expo-doctor 20/20
- Website: renders at 375 px and desktop with no horizontal scroll; launch gate blocks only on domain and contact email

## Not verified yet
- The app on a real phone (needs a trained model and a development build)
- Background swap on the real Kaggle segmented folder (`bg_swap.py` stops if fewer than 95% of segmented files match a colour original)

## Known issues
- Full int8 MobileNetV3 is refused by XNNPACK because of a dead squeeze-excite layer; handled in `convert.py` (see README, Known limitations)

## Next step
Download the datasets and run Phase 1 on Colab.
