"""Embedding Model - Generate vector embeddings for text."""

from typing import Optional

from memomind.config import get_settings


class EmbeddingModel:
    """
    Embedding model for generating vector representations.

    Supports:
    - Local: sentence-transformers (default, privacy-focused)
    - OpenAI: text-embedding-ada-002
    """

    def __init__(self):
        self.settings = get_settings()
        self._model = None

    def _get_model(self):
        """Lazy-load the embedding model."""
        if self._model is not None:
            return self._model

        provider = self.settings.embeddings.provider

        if provider == "local":
            try:
                from sentence_transformers import SentenceTransformer
                model_name = self.settings.embeddings.model
                self._model = SentenceTransformer(model_name)
            except ImportError:
                raise ImportError(
                    "sentence-transformers required. Install with: pip install sentence-transformers"
                )

        elif provider == "openai":
            # For OpenAI, we'll handle it in the embed method
            self._model = "openai"

        else:
            raise ValueError(f"Unsupported embedding provider: {provider}")

        return self._model

    def embed(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Input text

        Returns:
            List of floats representing the embedding vector
        """
        model = self._get_model()

        if model == "openai":
            return self._embed_openai(text)
        else:
            # Local sentence-transformers model
            embedding = model.encode(text, convert_to_numpy=True)
            return embedding.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts.

        Args:
            texts: List of input texts

        Returns:
            List of embedding vectors
        """
        model = self._get_model()

        if model == "openai":
            return [self._embed_openai(text) for text in texts]
        else:
            # Local sentence-transformers model (batch processing)
            embeddings = model.encode(texts, convert_to_numpy=True)
            return embeddings.tolist()

    def _embed_openai(self, text: str) -> list[float]:
        """Generate embedding using OpenAI API."""
        import os
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = client.embeddings.create(
                model="text-embedding-ada-002",
                input=text,
            )
            return response.data[0].embedding
        except ImportError:
            raise ImportError("openai package required. Install with: pip install openai")

    @property
    def dimension(self) -> int:
        """Get the embedding dimension."""
        model = self._get_model()

        if model == "openai":
            return 1536  # text-embedding-ada-002 dimension
        else:
            # sentence-transformers model
            return model.get_sentence_embedding_dimension()
