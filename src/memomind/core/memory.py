"""Memory Manager - Handles short-term and long-term memory."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from memomind.config import get_settings
from memomind.models import Memory, MemoryType, Session


class MemoryManager:
    """
    Manages the memory system including short-term (session)
    and long-term (vector store) memory.
    """

    def __init__(self, vector_store: Optional["VectorStore"] = None):
        self.settings = get_settings()
        self._vector_store = vector_store
        self.settings.ensure_directories()

    @property
    def vector_store(self) -> "VectorStore":
        """Lazy-load vector store."""
        if self._vector_store is None:
            from memomind.storage.vector_store import VectorStore

            self._vector_store = VectorStore()
        return self._vector_store

    def add_memory(
        self,
        content: str,
        memory_type: str = "semantic",
        importance: float = 0.5,
        source_doc_id: Optional[str] = None,
        source_session_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> Memory:
        """
        Add a new memory to long-term storage.

        Args:
            content: The memory content
            memory_type: Type of memory (episodic, semantic, procedural)
            importance: Importance score (0-1)
            source_doc_id: Optional source document ID
            source_session_id: Optional source session ID
            metadata: Additional metadata

        Returns:
            The created Memory object
        """
        memory = Memory(
            content=content,
            memory_type=MemoryType(memory_type),
            importance=importance,
            source_doc_id=source_doc_id,
            source_session_id=source_session_id,
            metadata=metadata or {},
        )

        # Store in vector database
        self.vector_store.add_memory(memory)

        return memory

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        memory_type: Optional[str] = None,
        min_importance: float = 0.0,
    ) -> list[Memory]:
        """
        Retrieve relevant memories based on query.

        Args:
            query: Search query
            top_k: Maximum number of results
            memory_type: Filter by memory type
            min_importance: Minimum importance threshold

        Returns:
            List of relevant Memory objects
        """
        # Retrieve from vector store
        memories = self.vector_store.search_memories(
            query=query,
            top_k=top_k * 2,  # Get more for filtering
            memory_type=memory_type,
        )

        # Filter by importance
        memories = [m for m in memories if m.importance >= min_importance]

        # Apply time decay and recalculate scores
        for memory in memories:
            recency_score = self._calculate_recency_score(memory.last_accessed)
            # Combine semantic similarity (0.6), recency (0.2), and importance (0.2)
            memory.relevance_score = (
                memory.relevance_score * 0.6
                + recency_score * 0.2
                + memory.importance * 0.2
            )

        # Sort by combined score and return top_k
        memories.sort(key=lambda m: m.relevance_score, reverse=True)
        result = memories[:top_k]

        # Mark memories as accessed
        for memory in result:
            memory.access()
            self.vector_store.update_memory_access(memory.id)

        return result

    def _calculate_recency_score(self, last_accessed: datetime) -> float:
        """Calculate recency score (0-1) based on last access time."""
        days_ago = (datetime.now() - last_accessed).days
        # Exponential decay: score halves every 7 days
        return 0.5 ** (days_ago / 7)

    def delete_memory(self, memory_id: str) -> bool:
        """Delete a memory by ID."""
        return self.vector_store.delete_memory(memory_id)

    def get_all_memories(
        self,
        limit: int = 100,
        memory_type: Optional[str] = None,
    ) -> list[Memory]:
        """Get all memories, optionally filtered by type."""
        return self.vector_store.get_all_memories(limit=limit, memory_type=memory_type)

    # Session (Short-term Memory) Management

    def save_session(self, session: Session) -> None:
        """Save a session to disk."""
        session_file = self.settings.sessions_dir / f"{session.id}.json"
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)

    def load_session(self, session_id: str) -> Optional[Session]:
        """Load a session from disk."""
        session_file = self.settings.sessions_dir / f"{session_id}.json"
        if not session_file.exists():
            return None

        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Session.from_dict(data)

    def list_sessions(self, limit: int = 20) -> list[dict]:
        """List recent sessions with basic info."""
        sessions = []
        session_files = sorted(
            self.settings.sessions_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )[:limit]

        for session_file in session_files:
            with open(session_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            sessions.append({
                "id": data["id"],
                "created_at": data["created_at"],
                "updated_at": data["updated_at"],
                "message_count": len(data["messages"]),
                "summary": data.get("summary"),
            })

        return sessions

    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        session_file = self.settings.sessions_dir / f"{session_id}.json"
        if session_file.exists():
            session_file.unlink()
            return True
        return False

    def clear_all_memories(self) -> None:
        """Clear all long-term memories (use with caution)."""
        self.vector_store.clear_all()

    def get_memory_stats(self) -> dict:
        """Get statistics about the memory system."""
        return self.vector_store.get_stats()
