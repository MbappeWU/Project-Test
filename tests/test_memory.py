"""Tests for Memory Manager."""

import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from memomind.models import Memory, MemoryType, Session


class TestMemoryManager:
    """Tests for MemoryManager class."""

    @pytest.fixture
    def manager(self, mock_settings, temp_dir):
        """Create a MemoryManager with mocked dependencies."""
        mock_settings.sessions_dir = temp_dir / "sessions"
        mock_settings.sessions_dir.mkdir(parents=True, exist_ok=True)

        with patch("memomind.config.get_settings", return_value=mock_settings):
            with patch("memomind.core.memory.MemoryManager.vector_store") as mock_vs:
                mock_vs.add_memory = MagicMock(return_value="mem-123")
                mock_vs.search_memories = MagicMock(return_value=[])
                mock_vs.update_memory_access = MagicMock()
                mock_vs.get_all_memories = MagicMock(return_value=[])
                mock_vs.delete_memory = MagicMock(return_value=True)
                mock_vs.get_stats = MagicMock(return_value={"total_memories": 0})

                from memomind.core.memory import MemoryManager
                mgr = MemoryManager()
                mgr._vector_store = mock_vs
                yield mgr

    def test_add_memory(self, manager):
        """Test adding a memory."""
        memory = manager.add_memory(
            content="Remember this fact",
            memory_type="semantic",
            importance=0.8,
        )

        assert memory.content == "Remember this fact"
        assert memory.memory_type == MemoryType.SEMANTIC
        assert memory.importance == 0.8
        manager.vector_store.add_memory.assert_called_once()

    def test_add_memory_defaults(self, manager):
        """Test adding a memory with default values."""
        memory = manager.add_memory(content="Default memory")

        assert memory.memory_type == MemoryType.SEMANTIC
        assert memory.importance == 0.5

    def test_retrieve_memories(self, manager):
        """Test retrieving memories."""
        # Setup mock return value
        mock_memory = Memory(
            content="Retrieved memory",
            memory_type=MemoryType.EPISODIC,
        )
        mock_memory.relevance_score = 0.9
        manager.vector_store.search_memories.return_value = [mock_memory]

        results = manager.retrieve("test query", top_k=5)

        assert len(results) == 1
        assert results[0].content == "Retrieved memory"
        manager.vector_store.search_memories.assert_called_once()
        manager.vector_store.update_memory_access.assert_called_once()

    def test_retrieve_with_ranking(self, manager):
        """Test memory retrieval applies ranking."""
        # Create memories with different attributes
        mem1 = Memory(content="Old memory", memory_type=MemoryType.SEMANTIC, importance=0.5)
        mem1.relevance_score = 0.8
        mem1.last_accessed = datetime.now() - timedelta(days=30)

        mem2 = Memory(content="Recent memory", memory_type=MemoryType.SEMANTIC, importance=0.9)
        mem2.relevance_score = 0.7
        mem2.last_accessed = datetime.now()

        manager.vector_store.search_memories.return_value = [mem1, mem2]

        results = manager.retrieve("query")

        # Results should be ranked by combined score
        assert len(results) == 2
        # Each memory should have a final_score attribute
        assert hasattr(results[0], "final_score")

    def test_get_all_memories(self, manager):
        """Test getting all memories."""
        manager.vector_store.get_all_memories.return_value = []

        results = manager.get_all_memories(limit=10)

        assert results == []
        manager.vector_store.get_all_memories.assert_called_once()

    def test_delete_memory(self, manager):
        """Test deleting a memory."""
        result = manager.delete_memory("mem-123")

        assert result is True
        manager.vector_store.delete_memory.assert_called_once_with("mem-123")

    def test_get_stats(self, manager):
        """Test getting memory statistics."""
        manager.vector_store.get_stats.return_value = {"total_memories": 42}

        stats = manager.get_stats()

        assert stats["total_memories"] == 42


class TestSessionManagement:
    """Tests for session management in MemoryManager."""

    @pytest.fixture
    def manager(self, mock_settings, temp_dir):
        """Create a MemoryManager for session tests."""
        mock_settings.sessions_dir = temp_dir / "sessions"
        mock_settings.sessions_dir.mkdir(parents=True, exist_ok=True)

        with patch("memomind.config.get_settings", return_value=mock_settings):
            from memomind.core.memory import MemoryManager
            mgr = MemoryManager()
            mgr._vector_store = MagicMock()
            yield mgr

    def test_save_session(self, manager, mock_settings):
        """Test saving a session."""
        session = Session()
        session.add_message("user", "Hello")
        session.add_message("assistant", "Hi there!")

        manager.save_session(session)

        # Check file was created
        session_file = mock_settings.sessions_dir / f"{session.id}.json"
        assert session_file.exists()

        # Check content
        with open(session_file) as f:
            data = json.load(f)
        assert data["id"] == session.id
        assert len(data["messages"]) == 2

    def test_load_session(self, manager, mock_settings):
        """Test loading a session."""
        # Create and save a session first
        session = Session()
        session.add_message("user", "Test message")
        manager.save_session(session)

        # Load it back
        loaded = manager.load_session(session.id)

        assert loaded is not None
        assert loaded.id == session.id
        assert len(loaded.messages) == 1
        assert loaded.messages[0].content == "Test message"

    def test_load_nonexistent_session(self, manager):
        """Test loading a non-existent session."""
        loaded = manager.load_session("nonexistent-id")
        assert loaded is None

    def test_list_sessions(self, manager, mock_settings):
        """Test listing sessions."""
        # Create multiple sessions
        for i in range(3):
            session = Session()
            session.add_message("user", f"Message {i}")
            manager.save_session(session)

        sessions = manager.list_sessions(limit=10)

        assert len(sessions) == 3
        for s in sessions:
            assert "id" in s
            assert "created_at" in s
            assert "message_count" in s

    def test_delete_session(self, manager, mock_settings):
        """Test deleting a session."""
        session = Session()
        manager.save_session(session)

        result = manager.delete_session(session.id)

        assert result is True
        session_file = mock_settings.sessions_dir / f"{session.id}.json"
        assert not session_file.exists()

    def test_delete_nonexistent_session(self, manager):
        """Test deleting a non-existent session."""
        result = manager.delete_session("nonexistent-id")
        assert result is False

    def test_clear_all_sessions(self, manager, mock_settings):
        """Test clearing all sessions."""
        # Create sessions
        for i in range(5):
            session = Session()
            manager.save_session(session)

        count = manager.clear_all_sessions()

        assert count == 5
        assert len(list(mock_settings.sessions_dir.glob("*.json"))) == 0
