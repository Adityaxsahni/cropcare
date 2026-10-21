# Model files

The app needs two files here, both written by `ml/scripts/convert.py`:

| File here | Copy from `ml/runs/<final>/export/` |
|---|---|
| `cropcare.tflite` | `cropcare_dynamic.tflite` or `cropcare_int8.tflite`, whichever you chose in Phase 4 |
| `model_meta.json` | the matching `cropcare_<variant>.meta.json` |

Always copy the pair together. The app checks that the model's input and output match the metadata and shows an error instead of guessing if they do not.

These files are not in git until a real, evaluated model exists. Without them the app does not build: Metro reports that it cannot resolve `cropcare.tflite`. That is deliberate. The app never ships with a placeholder model that would give made-up answers.
