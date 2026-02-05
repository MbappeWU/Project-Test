from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from memomind.config.settings import Settings
from memomind.core.knowledge import KnowledgeBase
from memomind.core.memory import MemoryStore
from memomind.llm.client import LlmClient
from memomind.llm.embeddings import EmbeddingClient
from memomind.models.document import Document
from memomind.models.memory import Memory


@dataclass
class MemoAgent:
    """Coordinates ingestion, memory storage, and retrieval."""

    settings: Settings = field(default_factory=Settings)
    knowledge_base: KnowledgeBase = field(default_factory=KnowledgeBase)
    memory_store: MemoryStore = field(default_factory=MemoryStore)
    llm_client: LlmClient = field(default_factory=LlmClient)
    embedding_client: EmbeddingClient = field(default_factory=EmbeddingClient)

    def ingest(self, document: Document) -> None:
        embedding = self.embedding_client.embed(document.content)
        enriched = Document(
            content=document.content,
            source=document.source,
            created_at=document.created_at,
            metadata=document.metadata,
            tags=document.tags,
            embedding=embedding,
        )
        self.knowledge_base.add(enriched)

    def remember(self, memory_id: str, memory: Memory) -> None:
        embedding = self.embedding_client.embed(memory.summary)
        self.memory_store.add_memory(memory_id, memory, embedding=embedding)

    def recall(self, query: str, limit: int = 5) -> List[Memory]:
        embedding = self.embedding_client.embed(query)
        return list(self.memory_store.search(embedding, limit=limit))

    def answer(self, query: str) -> Optional[str]:
        memories = self.recall(query)
        if not memories:
            return None
        context = "\n".join(memory.summary for memory in memories)
        prompt = f"Use the following memories to answer the question:\n{context}\nQuestion: {query}"
        return self.llm_client.complete(prompt)
