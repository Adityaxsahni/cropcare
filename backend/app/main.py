"""CropCare backend: anonymous scan feedback, aggregate stats and advice updates.

Run locally:  uvicorn app.main:create_app --factory --reload
"""

from __future__ import annotations

import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, insert, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from . import db
from .schemas import LABELS, AdviceVersion, FeedbackBatch, FeedbackResult, Stats

MAX_BODY_BYTES = 32 * 1024
MAX_ADVICE_BYTES = 512 * 1024


class RateLimiter:
    """At most `limit` requests per `window` seconds per client IP, in memory."""

    def __init__(self, limit: int, window: float = 60.0) -> None:
        self.limit, self.window = limit, window
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        if len(self.hits) > 10_000:
            for k in [k for k, v in self.hits.items() if not v or now - v[-1] > self.window]:
                del self.hits[k]
        return True


def client_ip(request: Request, trusted_hops: int) -> str:
    """The caller's address for rate limiting.

    X-Forwarded-For is written left to right by each hop, so only the entries
    added by our own proxies can be trusted: with N trusted proxies, the client
    is the Nth entry from the right. Anything further left is whatever the
    caller chose to send. With no trusted proxy the header is ignored.
    """
    peer = request.client.host if request.client else "unknown"
    if trusted_hops <= 0:
        return peer
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    return parts[-trusted_hops] if len(parts) >= trusted_hops else peer


def create_app(
    database_url: str | None = None, admin_token: str | None = None, rate_limit: int = 60, trusted_proxy_hops: int | None = None
) -> FastAPI:
    engine: Engine = db.make_engine(database_url or os.environ.get("DATABASE_URL", "sqlite:///./cropcare.db"))
    admin_token = admin_token if admin_token is not None else os.environ.get("ADMIN_TOKEN", "")
    hops = trusted_proxy_hops if trusted_proxy_hops is not None else int(os.environ.get("TRUSTED_PROXY_HOPS", "0"))
    limiter = RateLimiter(rate_limit)
    app = FastAPI(title="CropCare", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def guard(request: Request, call_next):
        if request.method in ("POST", "PUT"):
            limit = MAX_ADVICE_BYTES if request.url.path == "/advice" else MAX_BODY_BYTES
            length = request.headers.get("content-length")
            if length is None or not length.isdigit():
                return JSONResponse({"detail": "Content-Length required"}, status_code=411)
            if int(length) > limit:
                return JSONResponse({"detail": "body too large"}, status_code=413)
            if not limiter.allow(client_ip(request, hops)):
                return JSONResponse({"detail": "too many requests"}, status_code=429)
        return await call_next(request)

    def require_admin(authorization: str = Header(default="")) -> None:
        expected = f"Bearer {admin_token}"
        if not admin_token or not secrets.compare_digest(authorization.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="admin token required")

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.post("/feedback", response_model=FeedbackResult)
    def feedback(batch: FeedbackBatch) -> FeedbackResult:
        stored = updated = ignored = 0
        now = datetime.now(timezone.utc)
        install = str(batch.install_id)
        with engine.begin() as conn:
            for scan in batch.scans:
                sid = str(scan.scan_id)
                # Insert first and fall back on a duplicate key, so two uploads of the same
                # scan arriving together cannot both pass a "does it exist?" check.
                try:
                    with conn.begin_nested():
                        conn.execute(insert(db.scans).values(
                            scan_id=sid, install_id=install, predicted_class=scan.predicted_class.value,
                            confidence=scan.confidence, correct=scan.correct, model_version=scan.model_version,
                            app_version=scan.app_version, scanned_at=scan.scanned_at, received_at=now,
                        ))
                    stored += 1
                    continue
                except IntegrityError:
                    pass
                existing = conn.execute(select(db.scans.c.install_id).where(db.scans.c.scan_id == sid)).first()
                if existing.install_id == install and scan.correct is not None:
                    # The farmer answered "Was this correct?" after the scan was first sent.
                    conn.execute(update(db.scans).where(db.scans.c.scan_id == sid).values(correct=scan.correct))
                    updated += 1
                else:
                    ignored += 1
        return FeedbackResult(stored=stored, updated=updated, ignored=ignored)

    @app.get("/stats", response_model=Stats)
    def stats() -> Stats:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        s = db.scans.c
        with engine.connect() as conn:
            installs = conn.execute(select(func.count(func.distinct(s.install_id)))).scalar_one()
            active = conn.execute(select(func.count(func.distinct(s.install_id))).where(s.scanned_at >= since)).scalar_one()
            total = conn.execute(select(func.count()).select_from(db.scans)).scalar_one()
            answered = conn.execute(select(func.count()).where(s.correct.is_not(None))).scalar_one()
            yes = conn.execute(select(func.count()).where(s.correct.is_(True))).scalar_one()
            by_class = dict(conn.execute(select(s.predicted_class, func.count()).group_by(s.predicted_class)).all())
        return Stats(
            installs=installs, active_installs_30d=active, scans=total, answered=answered, marked_correct=yes,
            share_marked_correct=(yes / answered) if answered else None,
            scans_by_class={label: int(by_class.get(label, 0)) for label in LABELS},
        )

    def latest_advice(conn):
        return conn.execute(select(db.advice).order_by(db.advice.c.version.desc()).limit(1)).first()

    @app.get("/advice/version", response_model=AdviceVersion)
    def advice_version() -> AdviceVersion:
        with engine.connect() as conn:
            row = latest_advice(conn)
        return AdviceVersion(version=row.version if row else 0)

    @app.get("/advice")
    def get_advice() -> dict:
        with engine.connect() as conn:
            row = latest_advice(conn)
        if row is None:
            raise HTTPException(status_code=404, detail="no advice published; the app keeps its bundled copy")
        return row.body

    @app.put("/advice", response_model=AdviceVersion, dependencies=[Depends(require_admin)])
    def put_advice(body: dict) -> AdviceVersion:
        missing = [label for label in LABELS if label not in body.get("classes", {})]
        if missing:
            raise HTTPException(status_code=422, detail=f"advice is missing classes: {missing}")
        review = body.get("review", {})
        if review.get("reviewed") is not True or not review.get("reviewer"):
            raise HTTPException(status_code=422, detail="only expert-reviewed advice can be published")
        with engine.begin() as conn:
            row = latest_advice(conn)
            version = (row.version if row else 0) + 1
            body = {**body, "version": version}
            conn.execute(insert(db.advice).values(version=version, body=body, published_at=datetime.now(timezone.utc)))
        return AdviceVersion(version=version)

    return app
