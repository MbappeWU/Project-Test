# MemoMind Architecture (Draft)

## Components
- `core.agent`: orchestrates ingestion, retrieval, and LLM calls.
- `core.memory`: manages short/long-term memory stores.
- `storage.vector_store`: in-memory similarity search.
- `storage.sqlite_store`: SQLite-backed vector persistence.
- `llm`: pluggable LLM and embedding clients.

## Data Flow
1. Raw input -> `models.Document`
2. Document -> embeddings via `llm.embeddings`
3. Embeddings -> `storage.vector_store` or `storage.sqlite_store`
4. Retrieval results -> `core.agent` response
