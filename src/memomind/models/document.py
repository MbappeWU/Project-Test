"""Document model for knowledge base entries."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid


class ModalityType(Enum):
    """Type of data modality."""

    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    PDF = "pdf"


@dataclass
class Document:
    """
    Represents a document in the knowledge base.

    A document can be text, image, audio, or any supported modality.
    It stores the content, metadata, and vector embedding for retrieval.
    """

    content: str
    modality: ModalityType
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_path: Optional[str] = None
    title: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    embedding: Optional[list[float]] = None
    chunk_index: int = 0
    total_chunks: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        """Convert document to dictionary for storage."""
        return {
            "id": self.id,
            "content": self.content,
            "modality": self.modality.value,
            "source_path": self.source_path,
            "title": self.title,
            "tags": self.tags,
            "metadata": self.metadata,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Document":
        """Create document from dictionary."""
        return cls(
            id=data["id"],
            content=data["content"],
            modality=ModalityType(data["modality"]),
            source_path=data.get("source_path"),
            title=data.get("title"),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            chunk_index=data.get("chunk_index", 0),
            total_chunks=data.get("total_chunks", 1),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
        )
