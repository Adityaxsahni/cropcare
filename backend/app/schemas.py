"""Request and response bodies. Unknown fields are rejected everywhere."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

LABELS: list[str] = json.loads((Path(__file__).parent / "labels.json").read_text(encoding="utf-8"))["labels"]
Label = Enum("Label", {name: name for name in LABELS}, type=str)

MAX_BATCH = 50


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Scan(Strict):
    scan_id: UUID
    predicted_class: Label
    confidence: float = Field(ge=0.0, le=1.0)
    correct: bool | None = None
    model_version: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9._-]+$")
    app_version: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9._-]+$")
    scanned_at: datetime

    @field_validator("scanned_at")
    @classmethod
    def not_in_future(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("scanned_at needs a timezone")
        if v > datetime.now(timezone.utc) + timedelta(days=1):
            raise ValueError("scanned_at is in the future")
        return v.astimezone(timezone.utc)


class FeedbackBatch(Strict):
    install_id: UUID
    scans: list[Scan] = Field(min_length=1, max_length=MAX_BATCH)


class FeedbackResult(Strict):
    stored: int
    updated: int
    ignored: int


class Stats(Strict):
    installs: int
    active_installs_30d: int
    scans: int
    answered: int
    marked_correct: int
    share_marked_correct: float | None
    scans_by_class: dict[str, int]


class AdviceVersion(Strict):
    version: int
