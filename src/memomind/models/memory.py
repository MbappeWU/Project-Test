"""Memory model for long-term memory entries."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid


class MemoryType(Enum):
    """Type of memory."""

    EPISODIC = "episodic"  # Specific events and experiences
    SEMANTIC = "semantic"  # Factual knowledge and concepts
    PROCEDURAL = "procedural"  # Skills, habits, and preferences


@dataclass
class Memory:
    """
    Represents a memory entry in long-term storage.

    Memories are extracted from conversations and documents,
    scored by importance, and can be retrieved based on relevance.
    """

    content: str
    memory_type: MemoryType
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    importance: float = 0.5  # Score from 0 to 1
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.now)
    source_doc_id: Optional[str] = None
    source_session_id: Optional[str] = None
    embedding: Optional[list[float]] = None
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    # Transient field for retrieval scoring
    relevance_score: float = field(default=0.0, compare=False)

    def access(self) -> None:
        """Record an access to this memory."""
        self.access_count += 1
        self.last_accessed = datetime.now()

    def decay_importance(self, decay_rate: float = 0.01) -> None:
        """Apply time-based decay to importance score."""
        days_since_access = (datetime.now() - self.last_accessed).days
        decay = decay_rate * days_since_access
        self.importance = max(0.0, self.importance - decay)

    def reinforce(self, amount: float = 0.1) -> None:
        """Reinforce this memory, increasing its importance."""
        self.importance = min(1.0, self.importance + amount)

    def to_dict(self) -> dict:
        """Convert memory to dictionary for storage."""
        return {
            "id": self.id,
            "content": self.content,
            "memory_type": self.memory_type.value,
            "importance": self.importance,
            "access_count": self.access_count,
            "last_accessed": self.last_accessed.isoformat(),
            "source_doc_id": self.source_doc_id,
            "source_session_id": self.source_session_id,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Memory":
        """Create memory from dictionary."""
        return cls(
            id=data["id"],
            content=data["content"],
            memory_type=MemoryType(data["memory_type"]),
            importance=data.get("importance", 0.5),
            access_count=data.get("access_count", 0),
            last_accessed=datetime.fromisoformat(data["last_accessed"]),
            source_doc_id=data.get("source_doc_id"),
            source_session_id=data.get("source_session_id"),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]),
        )
