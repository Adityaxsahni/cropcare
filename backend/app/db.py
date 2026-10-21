"""Database tables and access. SQLite locally, Postgres in production (DATABASE_URL)."""

from __future__ import annotations

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Float, Integer, MetaData, String, Table, create_engine,
)
from sqlalchemy.engine import Engine

metadata = MetaData()

scans = Table(
    "scans",
    metadata,
    Column("scan_id", String(36), primary_key=True),
    Column("install_id", String(36), nullable=False, index=True),
    Column("predicted_class", String(64), nullable=False),
    Column("confidence", Float, nullable=False),
    Column("correct", Boolean, nullable=True),
    Column("model_version", String(32), nullable=False),
    Column("app_version", String(32), nullable=False),
    Column("scanned_at", DateTime(timezone=True), nullable=False, index=True),
    Column("received_at", DateTime(timezone=True), nullable=False),
)

advice = Table(
    "advice",
    metadata,
    Column("version", Integer, primary_key=True),
    Column("body", JSON, nullable=False),
    Column("published_at", DateTime(timezone=True), nullable=False),
)


def normalise_url(url: str) -> str:
    """Render and Heroku hand out postgres:// URLs; SQLAlchemy needs a driver name."""
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def make_engine(url: str) -> Engine:
    url = normalise_url(url)
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    engine = create_engine(url, **kwargs)
    metadata.create_all(engine)
    return engine
