from collections import Counter

import pytest

from cropcare import prepare
from cropcare.classes import ClassMap, UnknownFolderError


@pytest.fixture
def data_dir(tmp_path, image_factory):
    pv = tmp_path / "raw/plantvillage"
    for folder in ("Tomato___healthy", "Potato___Late_blight", "Apple___Apple_scab", "Tomato___Target_Spot"):
        for i in range(20):
            image_factory(pv / folder / f"{i}.JPG", seed=i)
    pd = tmp_path / "raw/plantdoc"
    for split, n in (("train", 20), ("test", 3)):
        for folder in ("Tomato leaf", "Corn rust leaf", "grape leaf"):
            for i in range(n):
                image_factory(pd / split / folder / f"{i}.jpg", seed=100 + i)
    return tmp_path


def test_plantvillage_rows(data_dir):
    rows = prepare.plantvillage_rows(data_dir / "raw/plantvillage", data_dir, ClassMap.load(), "s")
    assert {r.label for r in rows} == {"tomato_healthy", "potato_late_blight"}
    assert Counter(r.split for r in rows) == {"train": 32, "val": 4, "test": 4}
    assert all(r.path.startswith("raw/plantvillage/") and "\\" not in r.path for r in rows)


def test_plantdoc_rows_keep_official_test_split(data_dir):
    rows = prepare.plantdoc_rows(data_dir / "raw/plantdoc", data_dir, ClassMap.load(), "s")
    assert Counter((r.label, r.split) for r in rows) == {
        ("tomato_healthy", "train"): 18, ("tomato_healthy", "val"): 2, ("tomato_healthy", "test"): 3,
        ("maize_common_rust", "train"): 18, ("maize_common_rust", "val"): 2, ("maize_common_rust", "test"): 3,
    }
    test_paths = {r.path for r in rows if r.split == "test"}
    assert all("/test/" in p for p in test_paths)


def test_unmapped_folder_of_our_crop_stops_preparation(data_dir, image_factory):
    image_factory(data_dir / "raw/plantvillage/Tomato___New_thing/0.jpg", seed=1)
    with pytest.raises(UnknownFolderError):
        prepare.plantvillage_rows(data_dir / "raw/plantvillage", data_dir, ClassMap.load(), "s")


def test_field_rows(data_dir, image_factory):
    field = data_dir / "field"
    image_factory(field / "images/p1.jpg", seed=5)
    (field / "labels.csv").write_text(
        "filename,label,labelled_by,date,place\np1.jpg,tomato_late_blight,KVK expert A,2026-11-02,Village X\n",
        encoding="utf-8",
    )
    rows = prepare.field_rows(field, data_dir, ClassMap.load())
    assert [(r.path, r.label, r.source, r.split) for r in rows] == [
        ("field/images/p1.jpg", "tomato_late_blight", "field", "test")
    ]


def test_field_rows_report_every_problem(data_dir, image_factory):
    field = data_dir / "field"
    image_factory(field / "images/p1.jpg", seed=5)
    (field / "labels.csv").write_text(
        "filename,label,labelled_by,date,place\n"
        "p1.jpg,tomato_rot,A,2026-11-02,X\n"
        "p1.jpg,tomato_healthy,,2026-11-02,X\n"
        "missing.jpg,tomato_healthy,A,2026-11-02,X\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError) as e:
        prepare.field_rows(field, data_dir, ClassMap.load())
    msg = str(e.value)
    assert "unknown label" in msg and "labelled_by is empty" in msg and "image not found" in msg


def test_field_labels_saved_by_excel(data_dir, image_factory):
    field = data_dir / "field"
    image_factory(field / "images/p1.jpg", seed=5)
    # UTF-8 byte-order mark, capitalised headers, spaces, CRLF line ends and a blank trailing row
    (field / "labels.csv").write_bytes(
        "\ufeffFilename,Label,Labelled_by,Date,Place\r\n p1.jpg , tomato_late_blight ,KVK expert A,2026-11-02,Village X\r\n,,,,\r\n".encode("utf-8")
    )
    rows = prepare.field_rows(field, data_dir, ClassMap.load())
    assert [(r.path, r.label) for r in rows] == [("field/images/p1.jpg", "tomato_late_blight")]


def test_field_labels_with_semicolons(data_dir, image_factory):
    field = data_dir / "field"
    image_factory(field / "images/p1.jpg", seed=5)
    (field / "labels.csv").write_text(
        "filename;label;labelled_by;date;place\np1.jpg;maize_healthy;A;2026-11-02;X\n", encoding="utf-8"
    )
    assert [r.label for r in prepare.field_rows(field, data_dir, ClassMap.load())] == ["maize_healthy"]
