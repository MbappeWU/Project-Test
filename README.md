# MemoMind

MemoMind is a local-first starter kit for building a multimodal personal knowledge agent. It provides a minimal set of Python modules for ingesting content, representing memories, and querying vector stores.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Project layout

- `src/memomind` - core package
- `docs` - specifications and architecture notes

## Storage options

- `InMemoryVectorStore` for prototyping.
- `SqliteVectorStore` for local persistence.
