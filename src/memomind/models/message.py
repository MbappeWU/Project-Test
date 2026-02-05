"""Message and Session models for conversation history."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional
import uuid


@dataclass
class Message:
    """
    Represents a single message in a conversation.

    Messages can be from the user, assistant, or system.
    """

    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Optional[dict] = None

    def to_dict(self) -> dict:
        """Convert message to dictionary."""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Message":
        """Create message from dictionary."""
        return cls(
            role=data["role"],
            content=data["content"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata"),
        )

    def to_llm_format(self) -> dict:
        """Convert to format expected by LLM APIs."""
        return {
            "role": self.role,
            "content": self.content,
        }


@dataclass
class Session:
    """
    Represents a conversation session.

    Sessions maintain the conversation history and can be
    persisted for later retrieval.
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    messages: list[Message] = field(default_factory=list)
    summary: Optional[str] = None
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str, metadata: Optional[dict] = None) -> Message:
        """Add a new message to the session."""
        message = Message(role=role, content=content, metadata=metadata)
        self.messages.append(message)
        self.updated_at = datetime.now()
        return message

    def get_recent_messages(self, count: int = 10) -> list[Message]:
        """Get the most recent messages."""
        return self.messages[-count:]

    def to_llm_format(self, max_messages: Optional[int] = None) -> list[dict]:
        """Convert session history to LLM API format."""
        messages = self.messages if max_messages is None else self.messages[-max_messages:]
        return [msg.to_llm_format() for msg in messages]

    def to_dict(self) -> dict:
        """Convert session to dictionary for storage."""
        return {
            "id": self.id,
            "messages": [msg.to_dict() for msg in self.messages],
            "summary": self.summary,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Session":
        """Create session from dictionary."""
        return cls(
            id=data["id"],
            messages=[Message.from_dict(m) for m in data["messages"]],
            summary=data.get("summary"),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
        )
