"""LLM Client - Unified interface for various LLM providers."""

import os
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from memomind.config import get_settings


class LLMError(Exception):
    """LLM-related error."""
    pass


class LLMClient:
    """
    Unified LLM client supporting multiple providers.

    Supports:
    - Anthropic Claude
    - OpenAI GPT
    - Ollama (local models)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.settings = get_settings()
        self._api_key = api_key
        self._client = None

    @property
    def api_key(self) -> Optional[str]:
        """Get API key from settings or environment."""
        if self._api_key:
            return self._api_key
        if self.settings.llm.api_key:
            return self.settings.llm.api_key

        # Try environment variables
        provider = self.settings.llm.provider
        if provider == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY")
        elif provider == "openai":
            return os.getenv("OPENAI_API_KEY")
        return None

    def _get_client(self):
        """Get or create the LLM client."""
        if self._client is not None:
            return self._client

        provider = self.settings.llm.provider

        if provider == "anthropic":
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError("anthropic package required. Install with: pip install anthropic")

        elif provider == "openai":
            try:
                from openai import OpenAI
                self._client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError("openai package required. Install with: pip install openai")

        elif provider == "ollama":
            # Ollama uses HTTP API, we'll use litellm for simplicity
            try:
                import litellm
                self._client = litellm
            except ImportError:
                raise ImportError("litellm package required. Install with: pip install litellm")

        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def chat(self, messages: list[dict]) -> str:
        """
        Send a chat request to the LLM.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            The assistant's response text
        """
        provider = self.settings.llm.provider
        model = self.settings.llm.model
        max_tokens = self.settings.llm.max_tokens
        temperature = self.settings.llm.temperature

        try:
            if provider == "anthropic":
                return self._chat_anthropic(messages, model, max_tokens, temperature)
            elif provider == "openai":
                return self._chat_openai(messages, model, max_tokens, temperature)
            elif provider == "ollama":
                return self._chat_ollama(messages, model, max_tokens, temperature)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
        except Exception as e:
            raise LLMError(f"LLM request failed: {e}") from e

    def _chat_anthropic(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Chat using Anthropic Claude."""
        client = self._get_client()

        # Separate system message from conversation
        system_message = ""
        conversation = []
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                conversation.append(msg)

        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message,
            messages=conversation,
        )

        return response.content[0].text

    def _chat_openai(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Chat using OpenAI."""
        client = self._get_client()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        return response.choices[0].message.content

    def _chat_ollama(
        self,
        messages: list[dict],
        model: str,
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Chat using Ollama (via litellm)."""
        import litellm

        response = litellm.completion(
            model=f"ollama/{model}",
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        return response.choices[0].message.content

    def validate_connection(self) -> bool:
        """Test if the LLM connection is valid."""
        try:
            response = self.chat([
                {"role": "user", "content": "Say 'ok' if you can hear me."}
            ])
            return "ok" in response.lower()
        except Exception:
            return False
