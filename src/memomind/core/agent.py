"""Agent Orchestrator - Central coordinator for the MemoMind agent."""

from dataclasses import dataclass, field
from typing import Optional

from memomind.config import get_settings
from memomind.models import Memory, Message, Session


@dataclass
class AgentResponse:
    """Response from the agent."""

    content: str
    sources: list[Memory] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


SYSTEM_PROMPT = """你是 MemoMind，一个具有记忆能力的个人AI助手。

## 你的能力
- 记住用户告诉你的重要信息
- 基于知识库内容回答问题
- 保持对话的连贯性和个性化

## 当前上下文
{context_section}

## 回答指南
1. 如果问题涉及知识库内容，优先使用检索到的信息
2. 如果记忆中有相关信息，自然地融入回答
3. 如果信息来源明确，标注来源
4. 保持回答简洁、准确、有帮助
"""


class AgentOrchestrator:
    """
    Central orchestrator for the MemoMind agent.

    Coordinates between memory retrieval, context building,
    LLM calls, and memory updates.
    """

    def __init__(
        self,
        memory_manager: Optional["MemoryManager"] = None,
        knowledge_processor: Optional["KnowledgeProcessor"] = None,
        llm_client: Optional["LLMClient"] = None,
    ):
        self.settings = get_settings()
        self._memory_manager = memory_manager
        self._knowledge_processor = knowledge_processor
        self._llm_client = llm_client
        self._current_session: Optional[Session] = None

    @property
    def memory_manager(self) -> "MemoryManager":
        """Lazy-load memory manager."""
        if self._memory_manager is None:
            from memomind.core.memory import MemoryManager

            self._memory_manager = MemoryManager()
        return self._memory_manager

    @property
    def knowledge_processor(self) -> "KnowledgeProcessor":
        """Lazy-load knowledge processor."""
        if self._knowledge_processor is None:
            from memomind.core.knowledge import KnowledgeProcessor

            self._knowledge_processor = KnowledgeProcessor()
        return self._knowledge_processor

    @property
    def llm_client(self) -> "LLMClient":
        """Lazy-load LLM client."""
        if self._llm_client is None:
            from memomind.llm.client import LLMClient

            self._llm_client = LLMClient()
        return self._llm_client

    @property
    def current_session(self) -> Session:
        """Get or create current session."""
        if self._current_session is None:
            self._current_session = Session()
        return self._current_session

    def new_session(self) -> Session:
        """Start a new conversation session."""
        self._current_session = Session()
        return self._current_session

    def process(self, user_input: str) -> AgentResponse:
        """
        Process user input and generate a response.

        Args:
            user_input: The user's message

        Returns:
            AgentResponse with the assistant's reply and sources
        """
        # 1. Retrieve relevant memories
        relevant_memories = self.memory_manager.retrieve(
            query=user_input,
            top_k=self.settings.memory.retrieval_top_k,
        )

        # 2. Get session context (short-term memory)
        session_messages = self.current_session.get_recent_messages(
            count=self.settings.memory.short_term_max_messages
        )

        # 3. Build context for LLM
        context = self._build_context(
            memories=relevant_memories,
            session_messages=session_messages,
        )

        # 4. Build messages for LLM
        messages = self._build_messages(
            context=context,
            session_messages=session_messages,
            user_input=user_input,
        )

        # 5. Call LLM
        response_content = self.llm_client.chat(messages)

        # 6. Update session (short-term memory)
        self.current_session.add_message("user", user_input)
        self.current_session.add_message(
            "assistant",
            response_content,
            metadata={"memories_used": [m.id for m in relevant_memories]},
        )

        # 7. Maybe persist to long-term memory
        self._maybe_persist_memory(user_input, response_content)

        return AgentResponse(
            content=response_content,
            sources=relevant_memories,
        )

    def _build_context(
        self,
        memories: list[Memory],
        session_messages: list[Message],
    ) -> str:
        """Build context section for the system prompt."""
        parts = []

        if memories:
            memory_text = "\n".join(
                f"- [{m.memory_type.value}] {m.content}" for m in memories
            )
            parts.append(f"### 相关记忆\n{memory_text}")

        if not parts:
            return "无特定上下文"

        return "\n\n".join(parts)

    def _build_messages(
        self,
        context: str,
        session_messages: list[Message],
        user_input: str,
    ) -> list[dict]:
        """Build message list for LLM API."""
        messages = []

        # System prompt with context
        system_prompt = SYSTEM_PROMPT.format(context_section=context)
        messages.append({"role": "system", "content": system_prompt})

        # Session history (excluding current input)
        for msg in session_messages:
            messages.append(msg.to_llm_format())

        # Current user input
        messages.append({"role": "user", "content": user_input})

        return messages

    def _maybe_persist_memory(self, user_input: str, response: str) -> None:
        """
        Evaluate and possibly persist important information to long-term memory.

        This is a simplified implementation. A more sophisticated version
        would use the LLM to extract and evaluate importance.
        """
        # Simple heuristics for MVP
        importance_keywords = [
            "记住",
            "别忘了",
            "重要",
            "我是",
            "我的",
            "我喜欢",
            "我不喜欢",
            "remember",
            "important",
            "my name is",
            "i am",
            "i like",
        ]

        content_lower = user_input.lower()
        should_persist = any(kw in content_lower for kw in importance_keywords)

        if should_persist:
            self.memory_manager.add_memory(
                content=user_input,
                memory_type="semantic",
                importance=0.7,
                source_session_id=self.current_session.id,
            )

    def save_session(self) -> None:
        """Save current session to disk."""
        if self._current_session:
            self.memory_manager.save_session(self._current_session)

    def load_session(self, session_id: str) -> Optional[Session]:
        """Load a previous session."""
        session = self.memory_manager.load_session(session_id)
        if session:
            self._current_session = session
        return session
