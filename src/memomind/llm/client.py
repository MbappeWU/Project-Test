from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LlmClient:
    """Placeholder LLM client implementation."""

    model: str = "local-llm"

    def complete(self, prompt: str) -> str:
        return f"[stubbed response from {self.model}] {prompt}"
