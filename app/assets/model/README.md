# Model files

The app needs two files here, both written by `ml/scripts/convert.py` and installed by
`python scripts/import_results.py <cropcare_results.zip>`:

| File here | Comes from `ml/runs/<final>/export/` |
|---|---|
| `cropcare.tflite` | the file chosen in Phase 4 (now `cropcare_float16.tflite`) |
| `model_meta.json` | the matching `cropcare_<variant>.meta.json` |

Always replace the pair together. The app checks that the model's input and output match the metadata and shows an error instead of guessing if they do not.

The committed model is version 1.0.0 from the Kaggle run on 2026-10-22: run `p3_4_weights` (PlantVillage and PlantDoc, strong augmentation, class weights), float16, unsure threshold 0.85. Its numbers are in [`results.md`](../../../results.md). It has not been tested on our own field photos yet.
