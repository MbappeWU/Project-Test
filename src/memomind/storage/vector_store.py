"""Vector Store - ChromaDB-based vector storage for documents and memories."""

from datetime import datetime
from typing import Optional

from memomind.config import get_settings
from memomind.models import Document, Memory, MemoryType, ModalityType


class VectorStore:
    """
    Vector database using ChromaDB for storing and retrieving
    documents and memories.
    """

    DOCUMENTS_COLLECTION = "documents"
    MEMORIES_COLLECTION = "memories"

    def __init__(self):
        self.settings = get_settings()
        self.settings.ensure_directories()
        self._client = None
        self._embedding_model = None
        self._documents_collection = None
        self._memories_collection = None

    @property
    def client(self):
        """Lazy-load ChromaDB client."""
        if self._client is None:
            try:
                import chromadb
                from chromadb.config import Settings as ChromaSettings

                self._client = chromadb.PersistentClient(
                    path=str(self.settings.chroma_dir),
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
            except ImportError:
                raise ImportError("chromadb required. Install with: pip install chromadb")
        return self._client

    @property
    def embedding_model(self):
        """Lazy-load embedding model."""
        if self._embedding_model is None:
            from memomind.llm.embeddings import EmbeddingModel
            self._embedding_model = EmbeddingModel()
        return self._embedding_model

    @property
    def documents_collection(self):
        """Get or create documents collection."""
        if self._documents_collection is None:
            self._documents_collection = self.client.get_or_create_collection(
                name=self.DOCUMENTS_COLLECTION,
                metadata={"description": "Knowledge base documents"},
            )
        return self._documents_collection

    @property
    def memories_collection(self):
        """Get or create memories collection."""
        if self._memories_collection is None:
            self._memories_collection = self.client.get_or_create_collection(
                name=self.MEMORIES_COLLECTION,
                metadata={"description": "Long-term memories"},
            )
        return self._memories_collection

    # Document Operations

    def add_document(self, document: Document) -> str:
        """Add a document to the vector store."""
        embedding = self.embedding_model.embed(document.content)

        self.documents_collection.add(
            ids=[document.id],
            embeddings=[embedding],
            documents=[document.content],
            metadatas=[{
                "modality": document.modality.value,
                "source_path": document.source_path or "",
                "title": document.title or "",
                "tags": ",".join(document.tags),
                "chunk_index": document.chunk_index,
                "total_chunks": document.total_chunks,
                "created_at": document.created_at.isoformat(),
            }],
        )

        return document.id

    def search_documents(
        self,
        query: str,
        top_k: int = 5,
        modality: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> list[Document]:
        """Search documents by semantic similarity."""
        query_embedding = self.embedding_model.embed(query)

        # Build where filter
        where_filter = None
        if modality:
            where_filter = {"modality": modality}

        results = self.documents_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
        )

        documents = []
        if results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i]
                content = results["documents"][0][i]

                # Filter by tags if specified
                if tags:
                    doc_tags = metadata.get("tags", "").split(",")
                    if not any(t in doc_tags for t in tags):
                        continue

                doc = Document(
                    id=doc_id,
                    content=content,
                    modality=ModalityType(metadata["modality"]),
                    source_path=metadata.get("source_path") or None,
                    title=metadata.get("title") or None,
                    tags=metadata.get("tags", "").split(",") if metadata.get("tags") else [],
                    chunk_index=metadata.get("chunk_index", 0),
                    total_chunks=metadata.get("total_chunks", 1),
                    created_at=datetime.fromisoformat(metadata["created_at"]),
                )
                documents.append(doc)

        return documents

    def get_document(self, doc_id: str) -> Optional[Document]:
        """Get a document by ID."""
        results = self.documents_collection.get(ids=[doc_id])
        if not results["ids"]:
            return None

        metadata = results["metadatas"][0]
        content = results["documents"][0]

        return Document(
            id=doc_id,
            content=content,
            modality=ModalityType(metadata["modality"]),
            source_path=metadata.get("source_path") or None,
            title=metadata.get("title") or None,
            tags=metadata.get("tags", "").split(",") if metadata.get("tags") else [],
            chunk_index=metadata.get("chunk_index", 0),
            total_chunks=metadata.get("total_chunks", 1),
            created_at=datetime.fromisoformat(metadata["created_at"]),
        )

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document by ID."""
        try:
            self.documents_collection.delete(ids=[doc_id])
            return True
        except Exception:
            return False

    def get_all_documents(
        self,
        limit: int = 100,
        modality: Optional[str] = None,
    ) -> list[Document]:
        """Get all documents."""
        where_filter = {"modality": modality} if modality else None

        results = self.documents_collection.get(
            limit=limit,
            where=where_filter,
        )

        documents = []
        if results["ids"]:
            for i, doc_id in enumerate(results["ids"]):
                metadata = results["metadatas"][i]
                content = results["documents"][i]

                doc = Document(
                    id=doc_id,
                    content=content,
                    modality=ModalityType(metadata["modality"]),
                    source_path=metadata.get("source_path") or None,
                    title=metadata.get("title") or None,
                    tags=metadata.get("tags", "").split(",") if metadata.get("tags") else [],
                    chunk_index=metadata.get("chunk_index", 0),
                    total_chunks=metadata.get("total_chunks", 1),
                    created_at=datetime.fromisoformat(metadata["created_at"]),
                )
                documents.append(doc)

        return documents

    def get_document_stats(self) -> dict:
        """Get document collection statistics."""
        count = self.documents_collection.count()
        return {
            "total_documents": count,
            "collection_name": self.DOCUMENTS_COLLECTION,
        }

    # Memory Operations

    def add_memory(self, memory: Memory) -> str:
        """Add a memory to the vector store."""
        embedding = self.embedding_model.embed(memory.content)

        self.memories_collection.add(
            ids=[memory.id],
            embeddings=[embedding],
            documents=[memory.content],
            metadatas=[{
                "memory_type": memory.memory_type.value,
                "importance": memory.importance,
                "access_count": memory.access_count,
                "last_accessed": memory.last_accessed.isoformat(),
                "source_doc_id": memory.source_doc_id or "",
                "source_session_id": memory.source_session_id or "",
                "created_at": memory.created_at.isoformat(),
            }],
        )

        return memory.id

    def search_memories(
        self,
        query: str,
        top_k: int = 5,
        memory_type: Optional[str] = None,
    ) -> list[Memory]:
        """Search memories by semantic similarity."""
        query_embedding = self.embedding_model.embed(query)

        where_filter = {"memory_type": memory_type} if memory_type else None

        results = self.memories_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where_filter,
        )

        memories = []
        if results["ids"] and results["ids"][0]:
            for i, mem_id in enumerate(results["ids"][0]):
                metadata = results["metadatas"][0][i]
                content = results["documents"][0][i]
                distance = results["distances"][0][i] if results.get("distances") else 0

                memory = Memory(
                    id=mem_id,
                    content=content,
                    memory_type=MemoryType(metadata["memory_type"]),
                    importance=metadata.get("importance", 0.5),
                    access_count=metadata.get("access_count", 0),
                    last_accessed=datetime.fromisoformat(metadata["last_accessed"]),
                    source_doc_id=metadata.get("source_doc_id") or None,
                    source_session_id=metadata.get("source_session_id") or None,
                    created_at=datetime.fromisoformat(metadata["created_at"]),
                )
                # Convert distance to similarity score (lower distance = higher similarity)
                memory.relevance_score = 1 / (1 + distance)
                memories.append(memory)

        return memories

    def update_memory_access(self, memory_id: str) -> None:
        """Update memory access count and timestamp."""
        results = self.memories_collection.get(ids=[memory_id])
        if not results["ids"]:
            return

        metadata = results["metadatas"][0]
        metadata["access_count"] = metadata.get("access_count", 0) + 1
        metadata["last_accessed"] = datetime.now().isoformat()

        self.memories_collection.update(
            ids=[memory_id],
            metadatas=[metadata],
        )

    def delete_memory(self, memory_id: str) -> bool:
        """Delete a memory by ID."""
        try:
            self.memories_collection.delete(ids=[memory_id])
            return True
        except Exception:
            return False

    def get_all_memories(
        self,
        limit: int = 100,
        memory_type: Optional[str] = None,
    ) -> list[Memory]:
        """Get all memories."""
        where_filter = {"memory_type": memory_type} if memory_type else None

        results = self.memories_collection.get(
            limit=limit,
            where=where_filter,
        )

        memories = []
        if results["ids"]:
            for i, mem_id in enumerate(results["ids"]):
                metadata = results["metadatas"][i]
                content = results["documents"][i]

                memory = Memory(
                    id=mem_id,
                    content=content,
                    memory_type=MemoryType(metadata["memory_type"]),
                    importance=metadata.get("importance", 0.5),
                    access_count=metadata.get("access_count", 0),
                    last_accessed=datetime.fromisoformat(metadata["last_accessed"]),
                    source_doc_id=metadata.get("source_doc_id") or None,
                    source_session_id=metadata.get("source_session_id") or None,
                    created_at=datetime.fromisoformat(metadata["created_at"]),
                )
                memories.append(memory)

        return memories

    def get_stats(self) -> dict:
        """Get memory statistics."""
        count = self.memories_collection.count()
        return {
            "total_memories": count,
            "collection_name": self.MEMORIES_COLLECTION,
        }

    def clear_all(self) -> None:
        """Clear all data (use with caution)."""
        self.client.delete_collection(self.DOCUMENTS_COLLECTION)
        self.client.delete_collection(self.MEMORIES_COLLECTION)
        self._documents_collection = None
        self._memories_collection = None
