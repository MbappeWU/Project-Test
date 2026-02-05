from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional

from memomind.models.memory import Memory
from memomind.storage.base import VectorStore
from memomind.storage.vector_store import InMemoryVectorStore


@dataclass
class MemoryStore:
    """Manages short and long-term memory collections."""

    vector_store: VectorStore = field(default_factory=InMemoryVectorStore)
    memories: Dict[str, Memory] = field(default_factory=dict)

    def add_memory(self, memory_id: str, memory: Memory, embedding: Optional[List[float]] = None) -> None:
        self.memories[memory_id] = memory
        if embedding is not None:
            self.vector_store.upsert(memory_id, embedding, payload={"summary": memory.summary})

    def get_memory(self, memory_id: str) -> Optional[Memory]:
        return self.memories.get(memory_id)

    def search(self, embedding: List[float], limit: int = 5) -> Iterable[Memory]:
        results = self.vector_store.search(embedding, limit=limit)
        for memory_id, _score in results:
            memory = self.memories.get(memory_id)
            if memory:
                yield memory
