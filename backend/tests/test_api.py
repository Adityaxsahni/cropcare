import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import create_app
from app.schemas import LABELS

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def client(tmp_path):
    # CI also runs these tests against a real Postgres (TEST_DATABASE_URL), the production database.
    url = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.db'}"
    if url.startswith("postgres"):
        engine = db.make_engine(url)
        db.metadata.drop_all(engine)
        engine.dispose()
    app = create_app(url, admin_token="secret-token", rate_limit=1000)
    return TestClient(app)


def scan(**kw):
    base = {
        "scan_id": str(uuid.uuid4()),
        "predicted_class": "tomato_late_blight",
        "confidence": 0.87,
        "correct": None,
        "model_version": "1.0.0",
        "app_version": "1.0.0",
        "scanned_at": datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat(),
    }
    return {**base, **kw}


def test_labels_match_ml_class_map():
    assert LABELS == json.loads((ROOT / "ml/class_map.json").read_text(encoding="utf-8"))["labels"]


def test_feedback_then_stats(client):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    r = client.post("/feedback", json={"install_id": a, "scans": [scan(correct=True), scan(correct=False), scan()]})
    assert r.status_code == 200 and r.json() == {"stored": 3, "updated": 0, "ignored": 0}
    client.post("/feedback", json={"install_id": b, "scans": [scan(predicted_class="maize_common_rust", correct=True)]})
    s = client.get("/stats").json()
    assert s["installs"] == 2 and s["active_installs_30d"] == 2
    assert s["scans"] == 4 and s["answered"] == 3 and s["marked_correct"] == 2
    assert s["share_marked_correct"] == pytest.approx(2 / 3)
    assert s["scans_by_class"]["tomato_late_blight"] == 3 and s["scans_by_class"]["maize_common_rust"] == 1
    assert set(s["scans_by_class"]) == set(LABELS)


def test_answer_sent_later_updates_the_scan(client):
    install = str(uuid.uuid4())
    first = scan()
    client.post("/feedback", json={"install_id": install, "scans": [first]})
    r = client.post("/feedback", json={"install_id": install, "scans": [{**first, "correct": True}]})
    assert r.json() == {"stored": 0, "updated": 1, "ignored": 0}
    assert client.get("/stats").json()["marked_correct"] == 1


def test_other_install_cannot_change_a_scan(client):
    first = scan()
    client.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [first]})
    r = client.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [{**first, "correct": False}]})
    assert r.json() == {"stored": 0, "updated": 0, "ignored": 1}


def test_stats_empty(client):
    s = client.get("/stats").json()
    assert s["scans"] == 0 and s["share_marked_correct"] is None


def test_offset_times_are_stored_in_utc(client):
    ist = timezone(timedelta(hours=5, minutes=30))
    old = (datetime.now(ist) - timedelta(days=31)).replace(minute=0, second=0, microsecond=0)
    client.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [scan(scanned_at=old.isoformat())]})
    s = client.get("/stats").json()
    assert s["installs"] == 1 and s["active_installs_30d"] == 0


@pytest.mark.parametrize("bad", [
    {"predicted_class": "tomato_rot"},
    {"confidence": 1.5},
    {"confidence": -0.1},
    {"phone_number": "9999999999"},
    {"scan_id": "not-a-uuid"},
    {"model_version": "1.0 <script>"},
    {"scanned_at": "2026-10-22T10:00:00"},
    {"scanned_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()},
])
def test_invalid_scans_rejected(client, bad):
    r = client.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [scan(**bad)]})
    assert r.status_code == 422


def test_batch_limits(client):
    install = str(uuid.uuid4())
    assert client.post("/feedback", json={"install_id": install, "scans": []}).status_code == 422
    assert client.post("/feedback", json={"install_id": install, "scans": [scan() for _ in range(51)]}).status_code in (413, 422)
    assert client.post("/feedback", json={"install_id": install, "scans": [scan() for _ in range(50)]}).status_code == 200


def test_oversized_body_rejected(client):
    r = client.post("/feedback", content=b"x" * (33 * 1024), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_rate_limit(tmp_path):
    c = TestClient(create_app(f"sqlite:///{tmp_path / 'rl.db'}", admin_token="t", rate_limit=2))
    body = {"install_id": str(uuid.uuid4()), "scans": [scan()]}
    codes = [c.post("/feedback", json={**body, "scans": [scan()]}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def _advice(reviewed=True):
    return {
        "review": {"reviewed": reviewed, "reviewer": "Dr. Example, KVK" if reviewed else ""},
        "classes": {label: {"en": {"steps": ["x"]}, "hi": {"steps": ["x"]}} for label in LABELS},
    }


def test_advice_flow(client):
    assert client.get("/advice/version").json() == {"version": 0}
    assert client.get("/advice").status_code == 404
    auth = {"Authorization": "Bearer secret-token"}
    assert client.put("/advice", json=_advice(), headers=auth).json() == {"version": 1}
    assert client.put("/advice", json=_advice(), headers=auth).json() == {"version": 2}
    assert client.get("/advice/version").json() == {"version": 2}
    assert client.get("/advice").json()["version"] == 2


def test_advice_needs_token_and_review(client):
    assert client.put("/advice", json=_advice()).status_code == 401
    assert client.put("/advice", json=_advice(), headers={"Authorization": "Bearer wrong"}).status_code == 401
    auth = {"Authorization": "Bearer secret-token"}
    assert client.put("/advice", json=_advice(reviewed=False), headers=auth).status_code == 422
    partial = _advice()
    del partial["classes"]["maize_healthy"]
    assert client.put("/advice", json=partial, headers=auth).status_code == 422


def test_admin_disabled_without_token(tmp_path):
    c = TestClient(create_app(f"sqlite:///{tmp_path / 'n.db'}", admin_token=""))
    assert c.put("/advice", json=_advice(), headers={"Authorization": "Bearer "}).status_code == 401


def test_bundled_app_advice_covers_all_labels():
    advice = json.loads((ROOT / "app/assets/advice.json").read_text(encoding="utf-8"))
    assert set(advice["classes"]) == set(LABELS)
    for label, entry in advice["classes"].items():
        for lang in ("en", "hi"):
            assert entry[lang]["name"] and entry[lang]["steps"], f"{label} {lang}"


def test_rate_limit_ignores_spoofed_forwarded_for(tmp_path):
    body = lambda: {"install_id": str(uuid.uuid4()), "scans": [scan()]}  # noqa: E731
    # No trusted proxy: the header is ignored, so rotating fake addresses does not reset the limit.
    direct = TestClient(create_app(f"sqlite:///{tmp_path / 'a.db'}", admin_token="t", rate_limit=2, trusted_proxy_hops=0))
    codes = [direct.post("/feedback", json=body(), headers={"X-Forwarded-For": f"10.0.0.{i}"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]
    # One trusted proxy: the client's own leftmost entries are ignored; the proxy-appended one counts.
    proxied = TestClient(create_app(f"sqlite:///{tmp_path / 'b.db'}", admin_token="t", rate_limit=2, trusted_proxy_hops=1))
    codes = [proxied.post("/feedback", json=body(), headers={"X-Forwarded-For": f"6.6.6.{i}, 203.0.113.7"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]
    other = proxied.post("/feedback", json=body(), headers={"X-Forwarded-For": "203.0.113.8"})
    assert other.status_code == 200


def test_metrics_count_requests_without_personal_data(client, caplog):
    import logging

    caplog.set_level(logging.INFO, logger="cropcare")
    client.get("/health")
    client.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [scan()]}, headers={"X-Forwarded-For": "198.51.100.9"})
    client.post("/feedback", json={"install_id": "bad"})
    m = client.get("/metrics").json()
    assert m["routes"]["GET /health"]["requests"] == 1
    assert m["routes"]["POST /feedback"]["requests"] == 2
    assert m["routes"]["POST /feedback"]["server_errors"] == 0
    assert m["uptime_s"] >= 0
    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert '"route": "/feedback"' in logged and '"status": 422' in logged
    assert "198.51.100.9" not in logged and "install_id" not in logged


def test_metrics_include_rejected_requests(tmp_path):
    c = TestClient(create_app(f"sqlite:///{tmp_path / 'm.db'}", admin_token="t", rate_limit=1))
    c.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [scan()]})
    assert c.post("/feedback", json={"install_id": str(uuid.uuid4()), "scans": [scan()]}).status_code == 429
    routes = c.get("/metrics").json()["routes"]
    assert sum(v["requests"] for k, v in routes.items() if k.startswith("POST")) == 2
