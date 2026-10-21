"""Lets each script import the `cropcare` package when run as `python scripts/x.py`."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
