from __future__ import annotations

from typing import Dict, List, Protocol, Tuple


class VectorStore(Protocol):
    """Protocol for vector storage backends."""

    def upsert(self, item_id: str, vector: List[float], payload: Dict[str, str]) -> None:
        ...

    def search(self, vector: List[float], limit: int = 5) -> List[Tuple[str, float]]:
        ...
