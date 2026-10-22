import csv
import io
import subprocess
import sys
import zipfile
from pathlib import Path

from cropcare import prepare
from cropcare.classes import ClassMap

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/make_field_zip.py"


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)


def test_packs_photos_into_a_zip_prepare_data_accepts(tmp_path, image_factory):
    photos = tmp_path / "photos"
    image_factory(photos / "tomato_late_blight/IMG_1.JPG", seed=1)
    image_factory(photos / "tomato_late_blight/IMG_2.jpg", seed=2)
    image_factory(photos / "potato_healthy/a.png", seed=3)
    out = tmp_path / "field.zip"
    r = run(photos, "--labelled-by", "KVK expert A", "--place", "Village X", "--out", out)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "aim for at least 20" in r.stdout

    with zipfile.ZipFile(out) as z:
        rows = list(csv.DictReader(io.StringIO(z.read("labels.csv").decode())))
        assert len(rows) == 3 and all(f"images/{row['filename']}" in z.namelist() for row in rows)
        z.extractall(tmp_path / "data/field")
    got = prepare.field_rows(tmp_path / "data/field", tmp_path / "data", ClassMap.load())
    assert sorted(r.label for r in got) == ["potato_healthy", "tomato_late_blight", "tomato_late_blight"]


def test_rejects_unknown_folders_and_loose_photos(tmp_path, image_factory):
    photos = tmp_path / "photos"
    image_factory(photos / "Tomato blight/1.jpg", seed=1)
    image_factory(photos / "loose.jpg", seed=2)
    r = run(photos, "--labelled-by", "A", "--out", tmp_path / "f.zip")
    assert r.returncode == 1
    assert "'Tomato blight' is not a label" in r.stdout and "not inside a label folder" in r.stdout
