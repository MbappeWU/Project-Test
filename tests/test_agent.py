"""Tests for Agent Orchestrator."""

from unittest.mock import MagicMock, patch

import pytest

from memomind.models import Memory, MemoryType


class TestAgentOrchestrator:
    """Tests for AgentOrchestrator class."""

    @pytest.fixture
    def agent(self, mock_settings, mock_llm_client, mock_embedding_model):
        """Create an AgentOrchestrator with mocked dependencies."""
        with patch("memomind.config.get_settings", return_value=mock_settings):
            from memomind.core.agent import AgentOrchestrator

            agent = AgentOrchestrator()

            # Mock the memory manager
            agent._memory_manager = MagicMock()
            agent._memory_manager.retrieve.return_value = []
            agent._memory_manager.add_to_session = MagicMock()
            agent._memory_manager.add_memory = MagicMock()
            agent._memory_manager.save_session = MagicMock()

            # Mock the LLM client
            agent._llm_client = mock_llm_client

            yield agent

    def test_new_session(self, agent):
        """Test creating a new session."""
        session = agent.new_session()

        assert session is not None
        assert session.id is not None
        assert len(session.messages) == 0

    def test_current_session_creates_on_demand(self, agent):
        """Test that current_session creates a session if none exists."""
        agent._current_session = None
        session = agent.current_session

        assert session is not None

    def test_process_basic(self, agent, mock_llm_client):
        """Test basic message processing."""
        mock_llm_client.chat.return_value = "Hello! How can I help you?"

        response = agent.process("Hello")

        assert response.content == "Hello! How can I help you?"
        mock_llm_client.chat.assert_called_once()

    def test_process_retrieves_memories(self, agent, mock_settings):
        """Test that processing retrieves relevant memories."""
        mock_settings.memory.retrieval_top_k = 3

        agent.process("What did we talk about?")

        agent._memory_manager.retrieve.assert_called()

    def test_process_with_memories(self, agent, mock_llm_client):
        """Test processing when memories are retrieved."""
        # Setup mock memories
        mock_memory = Memory(
            content="User likes Python",
            memory_type=MemoryType.SEMANTIC,
        )
        agent._memory_manager.retrieve.return_value = [mock_memory]
        mock_llm_client.chat.return_value = "I remember you like Python!"

        response = agent.process("What do I like?")

        assert response.content == "I remember you like Python!"
        assert len(response.sources) == 1

    def test_build_context_empty(self, agent):
        """Test building context with no memories."""
        context = agent._build_context(memories=[], session_messages=[])

        assert context == "无特定上下文"

    def test_build_context_with_memories(self, agent):
        """Test building context with memories."""
        memories = [
            Memory(content="Fact 1", memory_type=MemoryType.SEMANTIC),
            Memory(content="Fact 2", memory_type=MemoryType.EPISODIC),
        ]

        context = agent._build_context(memories=memories, session_messages=[])

        assert "Fact 1" in context
        assert "Fact 2" in context
        assert "相关记忆" in context

    def test_build_messages_structure(self, agent):
        """Test that messages are built correctly."""
        from memomind.models import Message

        session_messages = [
            Message(role="user", content="Hi"),
            Message(role="assistant", content="Hello!"),
        ]

        messages = agent._build_messages(
            context="Test context",
            session_messages=session_messages,
            user_input="New message",
        )

        # Should have: system, history (2), current user
        assert len(messages) >= 3
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"] == "New message"

    def test_maybe_persist_memory_important(self, agent):
        """Test that important information is persisted."""
        agent._maybe_persist_memory("记住我叫小明", "好的，我记住了")

        agent._memory_manager.add_memory.assert_called_once()

    def test_maybe_persist_memory_not_important(self, agent):
        """Test that non-important information is not persisted."""
        agent._maybe_persist_memory("今天天气怎么样？", "今天是晴天")

        agent._memory_manager.add_memory.assert_not_called()

    def test_save_session(self, agent):
        """Test saving the current session."""
        # Ensure there's a session
        _ = agent.current_session

        agent.save_session()

        agent._memory_manager.save_session.assert_called_once()


class TestAgentResponse:
    """Tests for AgentResponse class."""

    def test_response_creation(self):
        """Test creating an AgentResponse."""
        from memomind.core.agent import AgentResponse

        response = AgentResponse(content="Test response")

        assert response.content == "Test response"
        assert response.sources == []
        assert response.metadata == {}

    def test_response_with_sources(self):
        """Test creating an AgentResponse with sources."""
        from memomind.core.agent import AgentResponse

        sources = [
            Memory(content="Source 1", memory_type=MemoryType.SEMANTIC),
        ]

        response = AgentResponse(
            content="Based on your memory...",
            sources=sources,
        )

        assert len(response.sources) == 1
