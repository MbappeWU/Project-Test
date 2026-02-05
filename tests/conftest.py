"""Pytest configuration and fixtures."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_settings(temp_dir):
    """Create mock settings with temporary directories."""
    with patch("memomind.config.settings.Settings") as mock:
        settings = MagicMock()
        settings.base_dir = temp_dir
        settings.data_dir = temp_dir / "data"
        settings.chroma_dir = temp_dir / "chroma"
        settings.sessions_dir = temp_dir / "sessions"
        settings.documents_dir = temp_dir / "documents"

        # Create directories
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        settings.chroma_dir.mkdir(parents=True, exist_ok=True)
        settings.sessions_dir.mkdir(parents=True, exist_ok=True)
        settings.documents_dir.mkdir(parents=True, exist_ok=True)

        # LLM settings
        settings.llm.provider = "anthropic"
        settings.llm.model = "claude-sonnet-4-20250514"
        settings.llm.temperature = 0.7
        settings.llm.max_tokens = 4096
        settings.llm.api_key = None

        # Memory settings
        settings.memory.short_term_max_messages = 20
        settings.memory.retrieval_top_k = 5
        settings.memory.importance_threshold = 0.6

        # Knowledge settings
        settings.knowledge.chunk_size = 500
        settings.knowledge.chunk_overlap = 50

        # Embedding settings
        settings.embeddings.provider = "local"
        settings.embeddings.model = "all-MiniLM-L6-v2"

        settings.ensure_directories = MagicMock()

        mock.return_value = settings
        yield settings


@pytest.fixture
def sample_text_file(temp_dir):
    """Create a sample text file for testing."""
    file_path = temp_dir / "sample.txt"
    content = """这是一个测试文档。

它包含多个段落，用于测试文本分块功能。

第三段内容在这里。这段话稍微长一些，
可以用来测试句子分割的功能是否正常工作。

最后一段是结尾。"""
    file_path.write_text(content, encoding="utf-8")
    return file_path


@pytest.fixture
def sample_markdown_file(temp_dir):
    """Create a sample markdown file for testing."""
    file_path = temp_dir / "sample.md"
    content = """# 测试标题

这是一个 Markdown 文档。

## 第二节

包含一些**粗体**和*斜体*文字。

- 列表项 1
- 列表项 2
- 列表项 3

## 代码示例

```python
def hello():
    print("Hello, World!")
```
"""
    file_path.write_text(content, encoding="utf-8")
    return file_path


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    with patch("memomind.llm.client.LLMClient") as mock:
        client = MagicMock()
        client.chat.return_value = "这是一个模拟的回复。"
        client.describe_image.return_value = "这是一张测试图片的描述。"
        client.validate_connection.return_value = True
        mock.return_value = client
        yield client


@pytest.fixture
def mock_embedding_model():
    """Create a mock embedding model."""
    with patch("memomind.llm.embeddings.EmbeddingModel") as mock:
        model = MagicMock()
        # Return a 384-dimension vector (like all-MiniLM-L6-v2)
        model.embed.return_value = [0.1] * 384
        model.embed_batch.return_value = [[0.1] * 384, [0.2] * 384]
        model.dimension = 384
        mock.return_value = model
        yield model
