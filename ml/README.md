# CropCare ML

Every script prints what it did and writes its numbers to files. Fill `results.md` only from those files.

**Easiest way:** open [`CropCare_Colab.ipynb`](https://colab.research.google.com/github/Adityaxsahni/cropcare/blob/main/ml/CropCare_Colab.ipynb) in Google Colab and run it top to bottom. It runs every step below, saves models and results to your Google Drive so a disconnect loses nothing, refuses to test a second model on the field photos, picks the TFLite file by the "at most 2 points lost" rule, and prints the rows for `results.md`. The setup it needs is listed in its first cell.

The rest of this page is the same pipeline as plain commands, for running anywhere else.

All commands run from this `ml/` folder. Data lives in `../data/` (git-ignored).

## 0. Set up (Colab or Kaggle, GPU runtime)

```bash
git clone https://github.com/Adityaxsahni/cropcare.git
cd cropcare/ml
pip install -r requirements.txt
```

## 1. Get the data (Phase 1)

```
../data/raw/plantvillage/            the "color" folder of the Kaggle PlantVillage dataset
../data/raw/plantvillage_segmented/  its "segmented" folder (for background swap)
../data/raw/plantdoc/                git clone https://github.com/pratikkayal/PlantDoc-Dataset
../data/field/images/                your own photos
../data/field/labels.csv             filename,label,labelled_by,date,place
../data/backgrounds/                 20+ photos of soil, hands and plants (no leaves of our classes in focus)
```

PlantVillage: the Kaggle copy `abdallahalidev/plantvillage-dataset` has `color/`, `grayscale/` and `segmented/` folders. Its class folder names (for example `Corn_(maize)___Common_rust_`) are already in `class_map.json`.

Field photo labels must be one of the 14 names in `class_map.json`, and `labelled_by` must say who identified the disease.

```bash
python scripts/prepare_data.py          # writes ../data/manifest.csv; stops on any unknown class folder
python scripts/verify_images.py         # finds files TensorFlow cannot decode (add --drop to remove them)
python scripts/check_leakage.py         # near-duplicates between train and val/test
python scripts/check_leakage.py --drop-from-pairs   # after looking at the pairs: drop them without hashing again
python scripts/data_card.py             # writes ml/data_card.md
```

Open a few rows of `../data/leakage_pairs.csv` and look at the image pairs before dropping anything.

## 2. Baseline (Phase 2)

```bash
python scripts/train.py --sources plantvillage --out runs/p2_baseline
python scripts/evaluate.py --model runs/p2_baseline/model.keras --source plantvillage
python scripts/evaluate.py --model runs/p2_baseline/model.keras --source plantdoc
python scripts/evaluate.py --model runs/p2_baseline/model.keras --source field
```

Running the field set on the baseline is part of the plan's "before" number. After that, do not look at field results again until the final model.

## 3. Close the gap (Phase 3)

One change at a time. Compare runs by PlantDoc test macro F1 (`eval_plantdoc_test.md`).

```bash
python scripts/train.py --sources plantvillage plantdoc --weights 0.6 0.4 --out runs/p3_1_mixed
python scripts/train.py --sources plantvillage plantdoc --weights 0.6 0.4 --augment strong --out runs/p3_2_strong

python scripts/bg_swap.py --segmented ../data/raw/plantvillage_segmented --backgrounds ../data/backgrounds
python scripts/train.py --sources plantvillage plantdoc plantvillage_bgswap --weights 0.45 0.35 0.2 \
    --augment strong --out runs/p3_3_bgswap

python scripts/train.py --sources plantvillage plantdoc plantvillage_bgswap --weights 0.45 0.35 0.2 \
    --augment strong --class-weights --out runs/p3_4_weights
```

For each run: `python scripts/evaluate.py --model runs/<run>/model.keras --source plantdoc`.

Unsure threshold, tuned on PlantDoc **val** (never on test or field):
```bash
python scripts/tune_threshold.py --model runs/<best>/model.keras --target 0.9
```

Final honest number, run once:
```bash
python scripts/evaluate.py --model runs/<best>/model.keras --source field
```

## 4. Convert (Phase 4)

```bash
python scripts/convert.py --model runs/<best>/model.keras --version 1.0.0
python scripts/evaluate.py --model runs/<best>/export/cropcare_int8.tflite --source field
```

`convert.py` loads every `.tflite` with LiteRT's default XNNPACK delegate, the same CPU path the phone uses, and refuses to write a file that does not load. If full int8 is refused (see `cropcare/tflite_check.py`), it keeps only the ops with a broken quantization range in float and says so.

Its table also shows how often each `.tflite` gives the same top answer as the Keras model. Pick the smallest file that loses no more than 1 to 2 accuracy points, then copy it and its `.meta.json` into `app/assets/model/`.

## Tests

```bash
python -m pytest -q
```
