# CropCare

An offline Android app that suggests which of 14 diseases (or healthy) a tomato, potato or maize leaf shows from one photo, and explains what to do in Hindi and English, with spoken Hindi.

**Status:** in development. The baseline and Phase 3 models are trained: on PlantDoc's real-world test photos, accuracy rose from 31.5% (PlantVillage only) to 57.3% (adding PlantDoc training photos). The phone model is not chosen yet and field photos are not collected yet. Every number, with its margin of error and what is still unmeasured, is in [results.md](results.md).

## Why this project is different

Crop disease models trained on PlantVillage often score about 99% on PlantVillage's own lab photos. In the original PlantVillage paper (Mohanty et al., 2016), accuracy fell to about 31% on images from other sources. CropCare measures that gap on three separate test sets (PlantVillage, PlantDoc, and our own field photos that are never used for training) and reports each number with a confidence interval.

## Repository

| Folder | What it is |
|---|---|
| [`ml/`](ml/README.md) | Data preparation, training, evaluation and TFLite conversion (Python, TensorFlow) |
| [`app/`](app/) | Expo React Native app (TypeScript), runs the model on the phone |
| [`backend/`](backend/) | Optional FastAPI service for anonymous feedback, stats and advice updates |
| [`site/`](site/) | Project website and privacy policy (static HTML) |
| [`docs/`](docs/) | Product requirements, architecture, design rules, decisions, test plan, security |
| [`results.md`](results.md) | Every measured number, filled in as it is measured |

## Run it

### ML (Phases 1 to 4)
Open [ml/CropCare_Colab.ipynb](ml/CropCare_Colab.ipynb) in Google Colab and run it top to bottom on a free T4 GPU. It also runs on Kaggle Notebooks when Colab's free GPU time is used up. [ml/README.md](ml/README.md) has the same steps as plain commands.

Unit tests run anywhere, without TensorFlow:
```bash
cd ml && python -m venv .venv && .venv/Scripts/pip install numpy pillow pytest && .venv/Scripts/python -m pytest -q
```

### App (Phase 5)
Needs a trained model in `app/assets/model/` (see [app/assets/model/README.md](app/assets/model/README.md)).
```bash
cd app
npm install
npm run typecheck && npm run lint && npm test
npx expo run:android          # development build on a connected phone or emulator
npx eas-cli@latest build -p android --profile preview   # installable APK
```
Copy `app/.env.example` to `app/.env` to set the backend URL and privacy policy link. Leave the backend URL empty to build an app that never uploads anything.

### Backend (Phase 6)
```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m app
```
`render.yaml` deploys it to Render. Use a Postgres `DATABASE_URL` there; Render's free web services have no persistent disk.

### Website
```bash
python -m http.server 8000 --directory site
python scripts/check_launch.py   # the launch gate, see docs/LAUNCH.md
```

## Known limitations

- PlantDoc has no healthy potato or healthy maize photos, so those two classes are tested only on our own field photos ([ADR-002](docs/DECISIONS.md)).
- The PlantDoc test split for our classes is small (about 100 photos), so its numbers carry wide confidence intervals ([ADR-003](docs/DECISIONS.md)).
- Keras's ImageNet MobileNetV3-Large has a squeeze-excite layer whose output is always zero on natural images. Full int8 quantization then gives that tensor a near-zero scale, which the phone's XNNPACK runtime refuses. `convert.py` detects this and keeps just those two ops in float ([ml/cropcare/tflite_check.py](ml/cropcare/tflite_check.py)).
- Treatment advice is a draft until an agriculture expert reviews it. The app shows a warning until then.
- One disease per leaf. No rice or wheat yet.

## Builds and license

- **Tests** ([.github/workflows/tests.yml](.github/workflows/tests.yml)) run the ML, backend and app suites on every push. The launch gate runs too, but only as information until the domain and privacy contact exist.
- **Android APK** ([.github/workflows/android.yml](.github/workflows/android.yml)) builds an installable APK in GitHub's cloud, with no Expo account needed. Download it from the run's Artifacts. Until a trained model is committed, the APK contains an untrained stand-in, is named `untrained-test-build` and shows a red warning in the app. Pushing a tag such as `v1.0.0` attaches the APK to a GitHub Release, and the workflow refuses to do this with the stand-in. A tag with a suffix, such as `v1.0.0-pilot.1`, makes a pre-release marked as a pilot test build, with the notes in [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md). The first one is [v1.0.0-pilot.1](https://github.com/Adityaxsahni/cropcare/releases/tag/v1.0.0-pilot.1).
- **Getting Colab results into the repo:** the notebook's last cell downloads `cropcare_results.zip`. Then run `python scripts/import_results.py cropcare_results.zip`. It installs the model in the app, copies the data card and rewrites `results.md`, keeping values typed in by hand.
- **Field photos:** sort them into one folder per label and run `python scripts/make_field_zip.py my_photos --labelled-by "Name, KVK"` to get `field.zip` for Google Drive.

## Hosting

| Part | Where | How |
|---|---|---|
| Website | https://adityaxsahni.github.io/cropcare/ (custom domain later) | [.github/workflows/pages.yml](.github/workflows/pages.yml) publishes `site/` on every push, only when the launch gate passes. One-time: Settings > Pages > Source: GitHub Actions. |
| Backend | Render, free plan | [Deploy to Render](https://render.com/deploy?repo=https://github.com/Adityaxsahni/cropcare) reads [render.yaml](render.yaml): the API plus a free Postgres. Render deletes free databases after 30 days, so move `DATABASE_URL` to a free database that does not expire (for example Neon) before then. |
| Android APK | GitHub Actions artifacts; GitHub Releases for tagged versions | [.github/workflows/android.yml](.github/workflows/android.yml). A release needs the real model committed in `app/assets/model/`. |

After the backend is up, set the repository variables `EXPO_PUBLIC_API_URL` (the Render URL) and `EXPO_PUBLIC_PRIVACY_URL` (`https://adityaxsahni.github.io/cropcare/privacy.html`) under Settings > Secrets and variables > Actions > Variables, so the next APK build uploads and links correctly.

MIT License, see [LICENSE](LICENSE).
