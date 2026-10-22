# Project memory

## Current status (2026-10-22)
All code for Phases 1 to 6 is written and tested. The notebook ran on Kaggle (Colab's free GPU allowance had run out) with real data: Phases 1 to 4 complete, results in results.md. The phone model is committed: version 1.0.0, run `p3_4_weights`, float16, 6.0 MB, unsure threshold 0.85. The backend runs on Render and the website on GitHub Pages. No field photos and no background photos yet.

## Verified
- ML unit tests: 39 passing (`ml/`, no TensorFlow needed)
- Full TensorFlow pipeline run end to end on synthetic images, and on real data on Kaggle (6,388 s on a T4)
- Notebook (`ml/CropCare_Colab.ipynb`) runs on Colab, on Kaggle, and locally on synthetic data
- Phone model: float16 gives the same answer as the Keras model on 99.7% of 600 test photos and the same PlantDoc test accuracy (56.2%); it loads in LiteRT with float32 input [1, 224, 224, 3] and 14 outputs
- Backend tests: 24 passing, also on Postgres in CI; live `/health` ok
- App: 35 unit tests passing, typecheck and lint clean, Android bundle builds, expo-doctor 20/20
- Website: renders at 375 px and desktop with no horizontal scroll; launch gate blocks only on the domain

## Not verified yet
- The app on a real phone (speed over 50 photos, airplane mode)
- Any number on our own field photos
- Background swap on the real Kaggle segmented folder (no background photos yet)

## Known issues
- Unsure threshold 0.85 gives 36.9% coverage on PlantDoc val: the app answers about one photo in three and says "unsure" for the rest
- PlantDoc test accuracy is 56.2% (89 photos, wide interval): lab-to-field gap is narrowed, not closed
- Full int8 is not usable for this network (54.8% agreement); see `ml/scripts/convert.py`
- Kaggle datasets are a network mount: copy files in parallel (the notebook does), never one by one

## Next step
Collect field photos and background photos, then rerun the notebook from section 1.3. Test the APK on a real phone.
