from __future__ import annotations

import base64
import json
import math
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from mistralai import Mistral, models
from mistralai.types import UNSET

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env")


def _require_mistral_api_key() -> str:
    key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "MISTRAL_API_KEY is not set. Add it to `.env` in the backend folder "
            "(see `.env.example`) or export it in your environment."
        )
    return key


client = Mistral(api_key=_require_mistral_api_key())

print(client.models.list())
