from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class EmbeddingClient:
    """Placeholder embedding client implementation."""

    model: str = "local-embedding"

    def embed(self, text: str) -> List[float]:
        if not text:
            return [0.0]
        return [float(sum(bytearray(text, "utf-8")) % 997) / 997.0]
