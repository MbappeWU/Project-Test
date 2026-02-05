from __future__ import annotations

import json
from typing import Any, Dict, List


def dumps_vector(vector: List[float]) -> str:
    return json.dumps(vector)


def loads_vector(value: str) -> List[float]:
    return [float(item) for item in json.loads(value)]


def dumps_payload(payload: Dict[str, str]) -> str:
    return json.dumps(payload)


def loads_payload(value: str) -> Dict[str, str]:
    return {str(key): str(val) for key, val in json.loads(value).items()}
