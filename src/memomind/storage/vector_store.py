from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass
class InMemoryVectorStore:
    """Minimal vector store for prototyping similarity search."""

    vectors: Dict[str, List[float]] = field(default_factory=dict)
    payloads: Dict[str, Dict[str, str]] = field(default_factory=dict)

    def upsert(self, item_id: str, vector: List[float], payload: Dict[str, str]) -> None:
        self.vectors[item_id] = vector
        self.payloads[item_id] = payload

    def search(self, vector: List[float], limit: int = 5) -> List[Tuple[str, float]]:
        scores = []
        for item_id, candidate in self.vectors.items():
            score = cosine_similarity(vector, candidate)
            scores.append((item_id, score))
        scores.sort(key=lambda pair: pair[1], reverse=True)
        return scores[:limit]
