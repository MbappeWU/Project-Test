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

    Authentication methods:
    - API Key (direct or via environment variable)
    - OAuth (via OAuthManager)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.settings = get_settings()
        self._api_key = api_key
        self._client = None
        self._oauth_manager = None

    @property
    def oauth_manager(self):
        """Lazy-load OAuth manager."""
        if self._oauth_manager is None:
            from memomind.auth import OAuthManager
            self._oauth_manager = OAuthManager()
        return self._oauth_manager

    @property
    def api_key(self) -> Optional[str]:
        """Get API key from OAuth, settings, or environment."""
        if self._api_key:
            return self._api_key
        if self.settings.llm.api_key:
            return self.settings.llm.api_key

        provider = self.settings.llm.provider

        # Check if OAuth is configured for this provider
        if self.settings.llm.auth_method == "oauth":
            try:
                oauth_key = self.oauth_manager.get_api_key(provider)
                if oauth_key:
                    return oauth_key
            except Exception:
                pass  # Fall back to env vars

        # Try environment variables
        if provider == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY")
        elif provider == "openai":
            return os.getenv("OPENAI_API_KEY")
        return None

    def is_authenticated(self) -> bool:
        """Check if the client has valid authentication."""
        return self.api_key is not None

    def get_auth_method(self) -> str:
        """Get the current authentication method being used."""
        provider = self.settings.llm.provider

        # Check OAuth first
        if self.settings.llm.auth_method == "oauth":
            if self.oauth_manager.is_logged_in(provider):
                return "oauth"

        # Check explicit API key
        if self._api_key or self.settings.llm.api_key:
            return "api_key"

        # Check environment variable
        if provider == "anthropic" and os.getenv("ANTHROPIC_API_KEY"):
            return "api_key (env)"
        elif provider == "openai" and os.getenv("OPENAI_API_KEY"):
            return "api_key (env)"

        return "none"

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

    def describe_image(self, image_path: str, prompt: Optional[str] = None) -> str:
        """
        Generate a description for an image using Vision LLM.

        Args:
            image_path: Path to the image file
            prompt: Optional custom prompt for description

        Returns:
            Text description of the image
        """
        import base64
        from pathlib import Path

        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Read and encode image
        with open(path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # Detect media type
        suffix = path.suffix.lower()
        media_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_types.get(suffix, "image/jpeg")

        default_prompt = (
            "请详细描述这张图片的内容，包括：\n"
            "1. 图片的主要内容和主题\n"
            "2. 图片中的重要元素、人物或物体\n"
            "3. 图片的场景或背景\n"
            "4. 任何可见的文字内容\n"
            "5. 图片可能传达的信息或用途\n\n"
            "请用中文回答，描述要详细但简洁。"
        )
        prompt = prompt or default_prompt

        provider = self.settings.llm.provider

        try:
            if provider == "anthropic":
                return self._describe_image_anthropic(image_data, media_type, prompt)
            elif provider == "openai":
                return self._describe_image_openai(image_data, media_type, prompt)
            else:
                # Fallback for providers without vision support
                return f"[Image: {path.name}] (Vision not supported for provider: {provider})"
        except Exception as e:
            raise LLMError(f"Image description failed: {e}") from e

    def _describe_image_anthropic(
        self,
        image_data: str,
        media_type: str,
        prompt: str,
    ) -> str:
        """Describe image using Anthropic Claude Vision."""
        client = self._get_client()

        response = client.messages.create(
            model=self.settings.llm.model,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": prompt,
                        },
                    ],
                }
            ],
        )

        return response.content[0].text

    def _describe_image_openai(
        self,
        image_data: str,
        media_type: str,
        prompt: str,
    ) -> str:
        """Describe image using OpenAI Vision."""
        client = self._get_client()

        response = client.chat.completions.create(
            model="gpt-4o",  # Use vision-capable model
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_data}",
                            },
                        },
                    ],
                }
            ],
        )

        return response.choices[0].message.content
