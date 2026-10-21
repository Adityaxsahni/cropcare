import numpy as np
import pytest

from cropcare import metrics, report
from cropcare.manifest import Row
from cropcare.sampling import effective_class_weights


def test_accuracy_and_confusion():
    y, p = np.array([0, 0, 1, 2]), np.array([0, 1, 1, 2])
    assert metrics.accuracy(y, p) == 0.75
    assert metrics.confusion_matrix(y, p, 3).tolist() == [[1, 1, 0], [0, 1, 0], [0, 0, 1]]


def test_macro_f1_by_hand():
    y, p = np.array([0, 0, 1, 2]), np.array([0, 1, 1, 2])
    # class 0: tp1 fn1 -> 2/3; class 1: tp1 fp1 -> 2/3; class 2: 1
    assert metrics.macro_f1(y, p) == pytest.approx((2 / 3 + 2 / 3 + 1) / 3)


def test_macro_f1_counts_predictions_of_absent_classes_as_errors():
    y, p = np.array([0, 0]), np.array([0, 5])
    assert metrics.macro_f1(y, p) == pytest.approx(2 / 3)


def test_bootstrap_ci_contains_point_estimate():
    rng = np.random.default_rng(0)
    y = rng.integers(0, 3, 200)
    p = np.where(rng.random(200) < 0.8, y, (y + 1) % 3)
    lo, hi = metrics.bootstrap_ci(y, p, metrics.accuracy, n_boot=500)
    assert lo < metrics.accuracy(y, p) < hi
    assert hi - lo < 0.2


def test_selective_and_threshold_choice():
    y = np.array([0, 1, 1, 0])
    probs = np.array([[0.9, 0.1], [0.55, 0.45], [0.2, 0.8], [0.4, 0.6]])
    s = metrics.selective(y, probs, 0.7)
    assert s["coverage"] == 0.5 and s["accuracy_answered"] == 1.0
    threshold, _ = metrics.choose_threshold(y, probs, 1.0, np.array([0.5, 0.6, 0.7, 0.8]))
    assert threshold == 0.7
    none, _ = metrics.choose_threshold(y, probs, 1.0, np.array([0.5]))
    assert none is None


def test_effective_class_weights_follow_sampling_weights():
    labels = ("a", "b", "c")
    rows = {
        "pv": [Row(f"{i}.jpg", "a", "plantvillage", "train") for i in range(90)]
        + [Row(f"b{i}.jpg", "b", "plantvillage", "train") for i in range(10)],
        "pd": [Row(f"d{i}.jpg", "b", "plantdoc", "train") for i in range(10)],
    }
    w = effective_class_weights(rows, {"pv": 0.5, "pd": 0.5}, labels)
    # sampled shares: a 0.45, b 0.05 + 0.5 = 0.55; c never sampled
    assert w[0] / w[1] == pytest.approx(0.55 / 0.45)
    assert w[2] == 1.0
    assert (w[0] + w[1]) / 2 == pytest.approx(1.0)


def test_report_marks_missing_classes():
    labels = ("a", "b", "c")
    y = np.array([0, 1, 0, 1])
    probs = np.array([[0.8, 0.1, 0.1], [0.1, 0.8, 0.1], [0.3, 0.6, 0.1], [0.1, 0.2, 0.7]])
    s = report.summarise(y, probs, labels, n_boot=100)
    assert s["classes_missing"] == ["c"]
    assert s["accuracy"] == 0.5
    assert "Missing from this set: c" in report.to_markdown("t", s)
