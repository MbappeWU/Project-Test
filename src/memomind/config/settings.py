"""Application settings and configuration."""

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
import yaml


class LLMSettings(BaseSettings):
    """LLM provider settings."""

    provider: Literal["anthropic", "openai", "ollama"] = "anthropic"
    model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.7
    max_tokens: int = 4096
    api_key: Optional[str] = None


class EmbeddingSettings(BaseSettings):
    """Embedding model settings."""

    provider: Literal["local", "openai"] = "local"
    model: str = "all-MiniLM-L6-v2"


class MemorySettings(BaseSettings):
    """Memory system settings."""

    short_term_max_messages: int = 20
    long_term_importance_threshold: float = 0.6
    retrieval_top_k: int = 5
    consolidation_enabled: bool = True
    consolidation_interval_hours: int = 24


class KnowledgeSettings(BaseSettings):
    """Knowledge base settings."""

    chunk_size: int = 500
    chunk_overlap: int = 50
    max_file_size_mb: int = 50


class StorageSettings(BaseSettings):
    """Storage settings."""

    base_path: Path = Path.home() / ".memomind"
    vector_db: Literal["chroma"] = "chroma"


class Settings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_prefix="MEMOMIND_",
        env_nested_delimiter="__",
        extra="ignore",
    )

    # Sub-settings
    llm: LLMSettings = Field(default_factory=LLMSettings)
    embeddings: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    memory: MemorySettings = Field(default_factory=MemorySettings)
    knowledge: KnowledgeSettings = Field(default_factory=KnowledgeSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    @property
    def data_dir(self) -> Path:
        """Get the data directory path."""
        return self.storage.base_path / "data"

    @property
    def documents_dir(self) -> Path:
        """Get the documents directory path."""
        return self.data_dir / "documents"

    @property
    def sessions_dir(self) -> Path:
        """Get the sessions directory path."""
        return self.data_dir / "sessions"

    @property
    def chroma_dir(self) -> Path:
        """Get the ChromaDB directory path."""
        return self.data_dir / "chroma"

    @property
    def logs_dir(self) -> Path:
        """Get the logs directory path."""
        return self.storage.base_path / "logs"

    @property
    def config_file(self) -> Path:
        """Get the config file path."""
        return self.storage.base_path / "config.yaml"

    def ensure_directories(self) -> None:
        """Create all necessary directories."""
        for directory in [
            self.storage.base_path,
            self.data_dir,
            self.documents_dir / "text",
            self.documents_dir / "images",
            self.documents_dir / "audio",
            self.sessions_dir,
            self.chroma_dir,
            self.logs_dir,
        ]:
            directory.mkdir(parents=True, exist_ok=True)

    def save(self) -> None:
        """Save settings to config file."""
        self.ensure_directories()
        config_data = {
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model,
                "temperature": self.llm.temperature,
                "max_tokens": self.llm.max_tokens,
            },
            "embeddings": {
                "provider": self.embeddings.provider,
                "model": self.embeddings.model,
            },
            "memory": {
                "short_term_max_messages": self.memory.short_term_max_messages,
                "long_term_importance_threshold": self.memory.long_term_importance_threshold,
                "retrieval_top_k": self.memory.retrieval_top_k,
            },
            "knowledge": {
                "chunk_size": self.knowledge.chunk_size,
                "chunk_overlap": self.knowledge.chunk_overlap,
            },
            "log_level": self.log_level,
        }
        with open(self.config_file, "w") as f:
            yaml.dump(config_data, f, default_flow_style=False)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "Settings":
        """Load settings from config file."""
        settings = cls()
        config_file = config_path or settings.config_file

        if config_file.exists():
            with open(config_file) as f:
                config_data = yaml.safe_load(f) or {}

            # Update settings from config file
            if "llm" in config_data:
                settings.llm = LLMSettings(**config_data["llm"])
            if "embeddings" in config_data:
                settings.embeddings = EmbeddingSettings(**config_data["embeddings"])
            if "memory" in config_data:
                settings.memory = MemorySettings(**config_data["memory"])
            if "knowledge" in config_data:
                settings.knowledge = KnowledgeSettings(**config_data["knowledge"])
            if "log_level" in config_data:
                settings.log_level = config_data["log_level"]

        return settings


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings.load()
