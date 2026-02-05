from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for MemoMind."""

    embedding_model: str = "local-embedding"
    llm_model: str = "local-llm"
    max_context_messages: int = 12
