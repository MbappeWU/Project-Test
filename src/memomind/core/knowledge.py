from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from memomind.models.document import Document


@dataclass
class KnowledgeBase:
    """Tracks ingested documents for later processing."""

    documents: List[Document] = field(default_factory=list)

    def add(self, document: Document) -> None:
        self.documents.append(document)

    def list_sources(self) -> List[str]:
        return [doc.source for doc in self.documents]
