# Architecture

```
Phone (offline)                                   Server (optional, when online)
+-------------------------------------------+     +----------------------------+
| Camera frame (VisionCamera)               |     | FastAPI                    |
|   -> centre square crop, resize 224x224   |     |   POST /feedback           |
|   -> TFLite model (react-native-fast-     |     |   GET  /stats              |
|      tflite)                              |     |   GET  /advice/version     |
|   -> probabilities -> threshold check     |     |   GET  /advice             |
|   -> Result or Unsure screen              |     | SQLite (local) or Postgres |
|   -> advice.json (bundled, or newer copy  |     |   via DATABASE_URL         |
|      downloaded from /advice)             |     +----------------------------+
|   -> history + pending uploads in         |               ^
|      AsyncStorage                         |               |
|   -> upload queue, only with consent -----+---------------+
+-------------------------------------------+

Training (Colab or Kaggle GPU)
  raw datasets -> prepare_data.py -> manifest.csv -> train.py -> model.keras
  -> evaluate.py (3 test sets) -> convert.py -> cropcare_*.tflite + model_meta.json
  -> copied into app/assets/model/
```

## Folders

```
cropcare/
  docs/       product, design, rules, decisions, current state
  ml/         data preparation, training, evaluation, conversion (Python)
  app/        Expo React Native app (TypeScript, development build)
  backend/    FastAPI service (Python)
  site/       static project website and privacy policy
  results.md  every measured number, filled in as it is measured
```

## Rules

- The app never needs the network to scan. The network is used only for the optional upload queue and advice updates.
- The model file, its labels and its quantization parameters travel together: `convert.py` writes `model_meta.json` next to the `.tflite`, and the app reads both. The app never hardcodes label order.
- Pure logic (post-processing, thresholds, history, queue) lives in `app/src/lib` with unit tests, separate from screens.
- Data splits are recorded once in `manifest.csv`. Training and evaluation read the manifest; nothing re-splits on the fly.
- Field photos are read only by `evaluate.py`, never by `train.py`. `train.py` refuses a manifest row whose source is `field`.
- The backend stores no names, phone numbers, photos or locations.
