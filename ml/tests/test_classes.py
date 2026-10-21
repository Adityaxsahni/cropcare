import pytest

from cropcare.classes import ClassMap, UnknownFolderError

# Folder names as published, checked on 2026-10-22.
PLANTDOC_TRAIN = [
    "Apple Scab Leaf", "Apple leaf", "Apple rust leaf", "Bell_pepper leaf spot", "Bell_pepper leaf",
    "Blueberry leaf", "Cherry leaf", "Corn Gray leaf spot", "Corn leaf blight", "Corn rust leaf",
    "Peach leaf", "Potato leaf early blight", "Potato leaf late blight", "Raspberry leaf",
    "Soyabean leaf", "Squash Powdery mildew leaf", "Strawberry leaf", "Tomato Early blight leaf",
    "Tomato Septoria leaf spot", "Tomato leaf bacterial spot", "Tomato leaf late blight",
    "Tomato leaf mosaic virus", "Tomato leaf yellow virus", "Tomato leaf", "Tomato mold leaf",
    "Tomato two spotted spider mites leaf", "grape leaf black rot", "grape leaf",
]
TFDS_PLANTVILLAGE_OUR_CROPS = [
    "Corn___Cercospora_leaf_spot Gray_leaf_spot", "Corn___Common_rust", "Corn___healthy",
    "Corn___Northern_Leaf_Blight", "Potato___Early_blight", "Potato___healthy", "Potato___Late_blight",
    "Tomato___Bacterial_spot", "Tomato___Early_blight", "Tomato___healthy", "Tomato___Late_blight",
    "Tomato___Leaf_Mold", "Tomato___Septoria_leaf_spot", "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot", "Tomato___Tomato_mosaic_virus", "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
]


@pytest.fixture(scope="module")
def cmap():
    return ClassMap.load()


def test_fourteen_unique_labels(cmap):
    assert len(cmap.labels) == 14
    assert len(set(cmap.labels)) == 14


def test_every_plantdoc_folder_is_handled(cmap):
    mapped = [f for f in PLANTDOC_TRAIN if cmap.map_folder("plantdoc", f)]
    assert len(mapped) == 12


def test_plantdoc_has_no_healthy_potato_or_maize(cmap):
    missing = set(cmap.labels) - set(cmap.labels_in("plantdoc"))
    assert missing == {"potato_healthy", "maize_healthy"}


def test_every_tfds_plantvillage_folder_is_handled(cmap):
    labels = {cmap.map_folder("plantvillage", f) for f in TFDS_PLANTVILLAGE_OUR_CROPS} - {None}
    assert labels == set(cmap.labels)


def test_kaggle_plantvillage_names_map_to_the_same_labels(cmap):
    assert cmap.map_folder("plantvillage", "Corn_(maize)___Common_rust_") == "maize_common_rust"
    assert cmap.map_folder("plantvillage", "Corn___Common_rust") == "maize_common_rust"


def test_other_crops_are_ignored(cmap):
    assert cmap.map_folder("plantvillage", "Apple___Apple_scab") is None
    assert cmap.map_folder("plantdoc", "grape leaf") is None


def test_unknown_folder_of_our_crop_raises(cmap):
    with pytest.raises(UnknownFolderError):
        cmap.map_folder("plantdoc", "Potato leaf")
    with pytest.raises(UnknownFolderError):
        cmap.map_folder("plantvillage", "Tomato___Some_new_disease")
