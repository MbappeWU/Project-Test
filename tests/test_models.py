"""Tests for data models."""

from datetime import datetime

import pytest

from memomind.models import Document, Memory, MemoryType, Message, ModalityType, Session


class TestDocument:
    """Tests for Document model."""

    def test_document_creation(self):
        """Test creating a document with default values."""
        doc = Document(content="Test content", modality=ModalityType.TEXT)

        assert doc.content == "Test content"
        assert doc.modality == ModalityType.TEXT
        assert doc.id is not None
        assert doc.created_at is not None
        assert doc.tags == []
        assert doc.chunk_index == 0
        assert doc.total_chunks == 1

    def test_document_with_all_fields(self):
        """Test creating a document with all fields."""
        doc = Document(
            content="Full document",
            modality=ModalityType.PDF,
            source_path="/path/to/file.pdf",
            title="Test Title",
            tags=["tag1", "tag2"],
            chunk_index=1,
            total_chunks=3,
            metadata={"key": "value"},
        )

        assert doc.content == "Full document"
        assert doc.modality == ModalityType.PDF
        assert doc.source_path == "/path/to/file.pdf"
        assert doc.title == "Test Title"
        assert doc.tags == ["tag1", "tag2"]
        assert doc.chunk_index == 1
        assert doc.total_chunks == 3
        assert doc.metadata == {"key": "value"}

    def test_document_serialization(self):
        """Test document to_dict and from_dict."""
        doc = Document(
            content="Serialization test",
            modality=ModalityType.IMAGE,
            title="Test",
            tags=["test"],
        )

        # Convert to dict
        data = doc.to_dict()
        assert data["content"] == "Serialization test"
        assert data["modality"] == "image"
        assert data["title"] == "Test"

        # Convert back from dict
        restored = Document.from_dict(data)
        assert restored.content == doc.content
        assert restored.modality == doc.modality
        assert restored.id == doc.id


class TestMemory:
    """Tests for Memory model."""

    def test_memory_creation(self):
        """Test creating a memory with default values."""
        memory = Memory(content="Remember this", memory_type=MemoryType.SEMANTIC)

        assert memory.content == "Remember this"
        assert memory.memory_type == MemoryType.SEMANTIC
        assert memory.importance == 0.5
        assert memory.access_count == 0
        assert memory.id is not None

    def test_memory_access(self):
        """Test memory access updates."""
        memory = Memory(content="Test", memory_type=MemoryType.EPISODIC)
        initial_time = memory.last_accessed

        memory.access()

        assert memory.access_count == 1
        assert memory.last_accessed >= initial_time

    def test_memory_importance_decay(self):
        """Test memory importance decay."""
        memory = Memory(
            content="Test",
            memory_type=MemoryType.SEMANTIC,
            importance=0.8,
        )

        memory.decay_importance(factor=0.1)

        assert memory.importance == pytest.approx(0.72)

    def test_memory_reinforcement(self):
        """Test memory reinforcement."""
        memory = Memory(
            content="Test",
            memory_type=MemoryType.SEMANTIC,
            importance=0.5,
        )

        memory.reinforce(boost=0.2)

        assert memory.importance == pytest.approx(0.7)
        # Should not exceed 1.0
        memory.reinforce(boost=0.5)
        assert memory.importance == 1.0

    def test_memory_serialization(self):
        """Test memory to_dict and from_dict."""
        memory = Memory(
            content="Test memory",
            memory_type=MemoryType.PROCEDURAL,
            importance=0.7,
        )

        data = memory.to_dict()
        restored = Memory.from_dict(data)

        assert restored.content == memory.content
        assert restored.memory_type == memory.memory_type
        assert restored.importance == memory.importance


class TestMessage:
    """Tests for Message model."""

    def test_message_creation(self):
        """Test creating a message."""
        msg = Message(role="user", content="Hello")

        assert msg.role == "user"
        assert msg.content == "Hello"
        assert msg.timestamp is not None

    def test_message_to_llm_format(self):
        """Test message LLM format conversion."""
        msg = Message(role="assistant", content="Hi there")

        llm_format = msg.to_llm_format()

        assert llm_format == {"role": "assistant", "content": "Hi there"}


class TestSession:
    """Tests for Session model."""

    def test_session_creation(self):
        """Test creating a session."""
        session = Session()

        assert session.id is not None
        assert session.messages == []
        assert session.created_at is not None

    def test_session_add_message(self):
        """Test adding messages to session."""
        session = Session()

        session.add_message("user", "Hello")
        session.add_message("assistant", "Hi!")

        assert len(session.messages) == 2
        assert session.messages[0].content == "Hello"
        assert session.messages[1].content == "Hi!"

    def test_session_get_recent_messages(self):
        """Test getting recent messages."""
        session = Session()

        for i in range(15):
            session.add_message("user", f"Message {i}")

        recent = session.get_recent_messages(count=5)

        assert len(recent) == 5
        assert recent[0].content == "Message 10"
        assert recent[4].content == "Message 14"

    def test_session_to_llm_format(self):
        """Test session LLM format conversion."""
        session = Session()
        session.add_message("user", "Question")
        session.add_message("assistant", "Answer")

        llm_format = session.to_llm_format()

        assert len(llm_format) == 2
        assert llm_format[0]["role"] == "user"
        assert llm_format[1]["role"] == "assistant"

    def test_session_serialization(self):
        """Test session to_dict and from_dict."""
        session = Session()
        session.add_message("user", "Test")

        data = session.to_dict()
        restored = Session.from_dict(data)

        assert restored.id == session.id
        assert len(restored.messages) == 1
        assert restored.messages[0].content == "Test"
