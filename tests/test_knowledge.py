"""Tests for Knowledge Processor."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestKnowledgeProcessor:
    """Tests for KnowledgeProcessor class."""

    @pytest.fixture
    def processor(self, mock_settings):
        """Create a KnowledgeProcessor with mocked dependencies."""
        with patch("memomind.config.get_settings", return_value=mock_settings):
            with patch("memomind.core.knowledge.KnowledgeProcessor.vector_store") as mock_vs:
                mock_vs.add_document = MagicMock()
                mock_vs.search_documents = MagicMock(return_value=[])
                mock_vs.get_all_documents = MagicMock(return_value=[])
                mock_vs.get_document_stats = MagicMock(return_value={"total": 0})

                from memomind.core.knowledge import KnowledgeProcessor
                proc = KnowledgeProcessor()
                proc._vector_store = mock_vs
                yield proc

    def test_detect_modality_text(self, processor):
        """Test modality detection for text files."""
        from memomind.models import ModalityType

        assert processor._detect_modality(Path("test.txt")) == ModalityType.TEXT
        assert processor._detect_modality(Path("test.md")) == ModalityType.TEXT
        assert processor._detect_modality(Path("test.json")) == ModalityType.TEXT
        assert processor._detect_modality(Path("test.yaml")) == ModalityType.TEXT

    def test_detect_modality_pdf(self, processor):
        """Test modality detection for PDF files."""
        from memomind.models import ModalityType

        assert processor._detect_modality(Path("test.pdf")) == ModalityType.PDF

    def test_detect_modality_image(self, processor):
        """Test modality detection for image files."""
        from memomind.models import ModalityType

        assert processor._detect_modality(Path("test.jpg")) == ModalityType.IMAGE
        assert processor._detect_modality(Path("test.jpeg")) == ModalityType.IMAGE
        assert processor._detect_modality(Path("test.png")) == ModalityType.IMAGE
        assert processor._detect_modality(Path("test.gif")) == ModalityType.IMAGE
        assert processor._detect_modality(Path("test.webp")) == ModalityType.IMAGE

    def test_detect_modality_audio(self, processor):
        """Test modality detection for audio files."""
        from memomind.models import ModalityType

        assert processor._detect_modality(Path("test.mp3")) == ModalityType.AUDIO
        assert processor._detect_modality(Path("test.wav")) == ModalityType.AUDIO
        assert processor._detect_modality(Path("test.m4a")) == ModalityType.AUDIO
        assert processor._detect_modality(Path("test.flac")) == ModalityType.AUDIO

    def test_chunk_text_short(self, processor):
        """Test chunking short text (no split needed)."""
        text = "This is a short text."
        chunks = processor._chunk_text(text)

        assert len(chunks) == 1
        assert chunks[0] == text

    def test_chunk_text_paragraphs(self, processor, mock_settings):
        """Test chunking by paragraphs."""
        mock_settings.knowledge.chunk_size = 100
        mock_settings.knowledge.chunk_overlap = 10

        text = """First paragraph here.

Second paragraph is also here.

Third paragraph follows."""

        chunks = processor._chunk_text(text)

        assert len(chunks) >= 1
        assert "First paragraph" in chunks[0]

    def test_chunk_text_long_paragraph(self, processor, mock_settings):
        """Test chunking a very long paragraph."""
        mock_settings.knowledge.chunk_size = 50
        mock_settings.knowledge.chunk_overlap = 5

        text = "This is a very long sentence that should be split. " * 10

        chunks = processor._chunk_text(text)

        assert len(chunks) > 1
        for chunk in chunks:
            # Each chunk should be within size limit (approximately)
            assert len(chunk) <= 100  # Some tolerance for sentence boundaries

    def test_add_note(self, processor):
        """Test adding a note."""
        doc = processor.add_note(
            content="Test note content",
            title="Test Note",
            tags=["test", "note"],
        )

        assert doc.content == "Test note content"
        assert doc.title == "Test Note"
        assert "test" in doc.tags
        processor.vector_store.add_document.assert_called_once()

    def test_process_text_file(self, processor, sample_text_file):
        """Test processing a text file."""
        docs = processor._process_text_file(sample_text_file, tags=["test"])

        assert len(docs) >= 1
        assert docs[0].source_path == str(sample_text_file)
        assert "test" in docs[0].tags

    def test_add_file_not_found(self, processor):
        """Test adding a non-existent file."""
        with pytest.raises(FileNotFoundError):
            processor.add_file("/nonexistent/path/file.txt")

    def test_search(self, processor):
        """Test searching documents."""
        processor.vector_store.search_documents.return_value = []

        results = processor.search("test query", top_k=5)

        assert results == []
        processor.vector_store.search_documents.assert_called_once_with(
            query="test query",
            top_k=5,
            modality=None,
            tags=None,
        )

    def test_list_documents(self, processor):
        """Test listing documents."""
        processor.vector_store.get_all_documents.return_value = []

        results = processor.list_documents(limit=10)

        assert results == []
        processor.vector_store.get_all_documents.assert_called_once()

    def test_delete_document(self, processor):
        """Test deleting a document."""
        processor.vector_store.delete_document.return_value = True

        result = processor.delete_document("doc-123")

        assert result is True
        processor.vector_store.delete_document.assert_called_once_with("doc-123")

    def test_get_stats(self, processor):
        """Test getting statistics."""
        processor.vector_store.get_document_stats.return_value = {"total": 10}

        stats = processor.get_stats()

        assert stats == {"total": 10}


class TestTextChunking:
    """Focused tests for text chunking functionality."""

    @pytest.fixture
    def processor(self, mock_settings):
        """Create processor for chunking tests."""
        mock_settings.knowledge.chunk_size = 100
        mock_settings.knowledge.chunk_overlap = 20

        with patch("memomind.config.get_settings", return_value=mock_settings):
            from memomind.core.knowledge import KnowledgeProcessor
            proc = KnowledgeProcessor()
            proc._vector_store = MagicMock()
            yield proc

    def test_empty_text(self, processor):
        """Test chunking empty text."""
        chunks = processor._chunk_text("")
        assert chunks == [""]

    def test_whitespace_only(self, processor):
        """Test chunking whitespace-only text."""
        chunks = processor._chunk_text("   \n\n   ")
        assert len(chunks) == 1

    def test_single_word(self, processor):
        """Test chunking a single word."""
        chunks = processor._chunk_text("Hello")
        assert chunks == ["Hello"]

    def test_preserves_content(self, processor, mock_settings):
        """Test that chunking preserves all content."""
        mock_settings.knowledge.chunk_size = 500
        mock_settings.knowledge.chunk_overlap = 0

        original = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
        chunks = processor._chunk_text(original)

        # All content should be in chunks (allowing for whitespace differences)
        combined = " ".join(chunks)
        assert "Paragraph one" in combined
        assert "Paragraph two" in combined
        assert "Paragraph three" in combined
