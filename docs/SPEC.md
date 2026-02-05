# MemoMind Specification (Draft)

## Goals
- Collect multimodal data (text, image, audio, structured) into a personal knowledge base.
- Provide short/long-term memory with retrieval for Q&A.
- Run locally with optional pluggable LLM backends.

## MVP Scope
- Text ingestion pipeline.
- Memory data models (document, memory, message).
- In-memory or SQLite-backed vector search interface.
- Simple agent orchestrator for storing and retrieving memories.
