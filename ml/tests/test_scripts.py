import subprocess
import sys
from pathlib import Path

from cropcare import manifest
from cropcare.manifest import Row

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def test_drop_from_pairs_removes_only_listed_eval_rows(tmp_path):
    rows = [
        Row("a.jpg", "tomato_healthy", "plantvillage", "train"),
        Row("b.jpg", "tomato_healthy", "plantdoc", "test"),
        Row("c.jpg", "tomato_healthy", "plantdoc", "test"),
    ]
    manifest.write(tmp_path / "manifest.csv", rows)
    (tmp_path / "leakage_pairs.csv").write_text(
        "eval_path,eval_source,eval_split,train_path,train_source,distance\n"
        "b.jpg,plantdoc,test,a.jpg,plantvillage,0\n",
        encoding="utf-8",
    )
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "check_leakage.py"), "--data-dir", str(tmp_path), "--drop-from-pairs"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "dropped 1 rows" in result.stdout
    assert sorted(r.path for r in manifest.read(tmp_path / "manifest.csv")) == ["a.jpg", "c.jpg"]
    assert (tmp_path / "manifest.before_leakage.csv").is_file()
