# Test plan

## ML (`ml/`, run `pytest`)
- `class_map.json` covers exactly the 14 labels, and every PlantVillage or PlantDoc folder of our crops is either mapped or explicitly excluded
- Split assignment is deterministic and stratified
- `train.py` refuses field rows
- Leakage check finds an exact duplicate and a resized duplicate
- Metrics: accuracy, macro F1 and selective accuracy match hand-computed values
- Background swap keeps leaf pixels and replaces only background pixels

## Model (manual, record in `results.md`)
- Baseline and each Phase 3 technique on PlantVillage test, PlantDoc test and field photos
- Keras vs dynamic vs int8: size, field accuracy, phone latency

## Backend (`backend/`, run `pytest`)
- `POST /feedback` accepts a valid batch and stores it
- Rejects unknown class, confidence outside 0 to 1, unknown fields, oversized batch
- `GET /stats` counts installs, scans, and the share of "yes" among answered scans
- `GET /advice/version` and `GET /advice` return the stored version; `PUT /advice` needs the admin token

## App (`app/`, run `npm test`)
- Post-processing: argmax, dequantization, threshold gives Unsure below the cut
- Confidence wording thresholds
- History add, list newest first, cap at 200 entries
- Upload queue: nothing queued without consent, cleared when consent is withdrawn, removed only after a successful upload

## On device (manual, airplane mode on)
1. Fresh install, first launch shows language choice and sharing question
2. Camera permission prompt appears only on the camera screen
3. Scan a tomato leaf: result screen shows Hindi and English names, confidence, steps
4. Listen button speaks Hindi; if no Hindi voice is installed, a message says how to add one
5. Scan a non-leaf (a wall): Unsure screen appears
6. History lists both scans after an app restart
7. Turn airplane mode off: queued scans upload (if consent given) and disappear from the queue

## Website (`site/`)
- Pages load at 375, 768 and 1440 px wide with no horizontal scroll
- Favicon shows in the browser tab
- Privacy policy linked from every page footer
- No em dashes, emoji or placeholders: `python scripts/check_launch.py` reports none
