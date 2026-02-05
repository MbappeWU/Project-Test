"""Knowledge Processor - Handles document processing and knowledge base management."""

from pathlib import Path
from typing import Optional

from memomind.config import get_settings
from memomind.models import Document, ModalityType


class KnowledgeProcessor:
    """
    Processes and manages knowledge base documents.

    Handles text, image, and audio files, converting them
    to a unified format for storage and retrieval.
    """

    def __init__(self, vector_store: Optional["VectorStore"] = None):
        self.settings = get_settings()
        self._vector_store = vector_store
        self.settings.ensure_directories()

    @property
    def vector_store(self) -> "VectorStore":
        """Lazy-load vector store."""
        if self._vector_store is None:
            from memomind.storage.vector_store import VectorStore

            self._vector_store = VectorStore()
        return self._vector_store

    def add_file(self, file_path: str, tags: Optional[list[str]] = None) -> list[Document]:
        """
        Add a file to the knowledge base.

        Args:
            file_path: Path to the file
            tags: Optional tags for categorization

        Returns:
            List of created Document objects (multiple for chunked files)
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Detect modality
        modality = self._detect_modality(path)

        # Process based on modality
        if modality == ModalityType.TEXT:
            documents = self._process_text_file(path, tags)
        elif modality == ModalityType.PDF:
            documents = self._process_pdf_file(path, tags)
        elif modality == ModalityType.IMAGE:
            documents = self._process_image_file(path, tags)
        elif modality == ModalityType.AUDIO:
            documents = self._process_audio_file(path, tags)
        else:
            raise ValueError(f"Unsupported file type: {path.suffix}")

        # Store documents in vector database
        for doc in documents:
            self.vector_store.add_document(doc)

        return documents

    def add_note(
        self,
        content: str,
        title: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> Document:
        """
        Add a text note directly to the knowledge base.

        Args:
            content: Note content
            title: Optional title
            tags: Optional tags

        Returns:
            Created Document object
        """
        document = Document(
            content=content,
            modality=ModalityType.TEXT,
            title=title,
            tags=tags or [],
        )

        self.vector_store.add_document(document)
        return document

    def search(
        self,
        query: str,
        top_k: int = 5,
        modality: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """
        Search the knowledge base.

        Args:
            query: Search query
            top_k: Maximum number of results
            modality: Filter by modality type
            tags: Filter by tags

        Returns:
            List of matching Document objects
        """
        return self.vector_store.search_documents(
            query=query,
            top_k=top_k,
            modality=modality,
            tags=tags,
        )

    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        return self.vector_store.get_document(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document by ID."""
        return self.vector_store.delete_document(doc_id)

    def list_documents(
        self,
        limit: int = 100,
        modality: Optional[str] = None,
    ) -> list[Document]:
        """List documents in the knowledge base."""
        return self.vector_store.get_all_documents(limit=limit, modality=modality)

    def get_stats(self) -> dict:
        """Get knowledge base statistics."""
        return self.vector_store.get_document_stats()

    def _detect_modality(self, path: Path) -> ModalityType:
        """Detect file modality based on extension."""
        suffix = path.suffix.lower()
        text_extensions = {".txt", ".md", ".markdown", ".rst", ".json", ".yaml", ".yml"}
        image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
        audio_extensions = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}

        if suffix == ".pdf":
            return ModalityType.PDF
        elif suffix in text_extensions:
            return ModalityType.TEXT
        elif suffix in image_extensions:
            return ModalityType.IMAGE
        elif suffix in audio_extensions:
            return ModalityType.AUDIO
        else:
            # Default to text for unknown types
            return ModalityType.TEXT

    def _process_text_file(
        self,
        path: Path,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """Process a text file into documents."""
        content = path.read_text(encoding="utf-8")
        chunks = self._chunk_text(content)

        documents = []
        for i, chunk in enumerate(chunks):
            doc = Document(
                content=chunk,
                modality=ModalityType.TEXT,
                source_path=str(path),
                title=path.stem,
                tags=tags or [],
                chunk_index=i,
                total_chunks=len(chunks),
            )
            documents.append(doc)

        return documents

    def _process_pdf_file(
        self,
        path: Path,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """Process a PDF file into documents."""
        try:
            from pypdf import PdfReader

            reader = PdfReader(path)
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)

            content = "\n\n".join(text_parts)
            chunks = self._chunk_text(content)

            documents = []
            for i, chunk in enumerate(chunks):
                doc = Document(
                    content=chunk,
                    modality=ModalityType.PDF,
                    source_path=str(path),
                    title=path.stem,
                    tags=tags or [],
                    chunk_index=i,
                    total_chunks=len(chunks),
                )
                documents.append(doc)

            return documents

        except ImportError:
            raise ImportError("pypdf is required for PDF processing. Install with: pip install pypdf")

    def _process_image_file(
        self,
        path: Path,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """
        Process an image file.

        For MVP, we store metadata and a placeholder.
        Full implementation would use Vision LLM for description.
        """
        # For MVP: store basic metadata
        # TODO: Integrate Vision LLM for image description
        doc = Document(
            content=f"[Image: {path.name}]",
            modality=ModalityType.IMAGE,
            source_path=str(path),
            title=path.stem,
            tags=tags or [],
            metadata={"original_file": str(path)},
        )
        return [doc]

    def _process_audio_file(
        self,
        path: Path,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """
        Process an audio file.

        For MVP, we store metadata.
        Full implementation would use Whisper for transcription.
        """
        # For MVP: store basic metadata
        # TODO: Integrate Whisper for audio transcription
        doc = Document(
            content=f"[Audio: {path.name}]",
            modality=ModalityType.AUDIO,
            source_path=str(path),
            title=path.stem,
            tags=tags or [],
            metadata={"original_file": str(path)},
        )
        return [doc]

    def _chunk_text(
        self,
        text: str,
        chunk_size: Optional[int] = None,
        overlap: Optional[int] = None,
    ) -> list[str]:
        """
        Split text into chunks.

        Uses paragraph-aware chunking with overlap.
        """
        chunk_size = chunk_size or self.settings.knowledge.chunk_size
        overlap = overlap or self.settings.knowledge.chunk_overlap

        # Split by paragraphs first
        paragraphs = text.split("\n\n")

        chunks = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk += ("\n\n" if current_chunk else "") + para
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                    # Keep overlap from the end of current chunk
                    overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                    current_chunk = overlap_text + ("\n\n" if overlap_text else "") + para
                else:
                    # Single paragraph is too long, split by sentences
                    chunks.extend(self._chunk_by_sentences(para, chunk_size, overlap))
                    current_chunk = ""

        if current_chunk:
            chunks.append(current_chunk)

        return chunks if chunks else [text]

    def _chunk_by_sentences(
        self,
        text: str,
        chunk_size: int,
        overlap: int,
    ) -> list[str]:
        """Split text by sentences when paragraphs are too long."""
        # Simple sentence splitting
        sentences = []
        current = ""
        for char in text:
            current += char
            if char in ".!?" and len(current) > 10:
                sentences.append(current.strip())
                current = ""
        if current:
            sentences.append(current.strip())

        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                current_chunk += (" " if current_chunk else "") + sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence

        if current_chunk:
            chunks.append(current_chunk)

        return chunks
